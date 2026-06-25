import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// GET /api/incidencias - List incidencias with filters
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const empleadoId = searchParams.get('empleado_id') || '';
  const tipo = searchParams.get('tipo') || '';
  const estado = searchParams.get('estado') || '';
  const periodoId = searchParams.get('periodo_id') || '';
  const fechaDesde = searchParams.get('fechaDesde') || searchParams.get('from') || '';
  const fechaHasta = searchParams.get('fechaHasta') || searchParams.get('to') || '';

  const where: Record<string, unknown> = {};

  // EMPLEADO role can only see their own incidencias
  if (user.rol === 'EMPLEADO') {
    const empleado = await db.empleado.findFirst({
      where: { usuario: { id: user.userId } },
      select: { id: true },
    });
    if (empleado) {
      where.empleado_id = empleado.id;
    }
  }

  if (empleadoId) where.empleado_id = empleadoId;
  if (tipo) where.tipo = tipo;
  if (estado) where.estado = estado;
  if (periodoId) where.periodo_id = periodoId;

  // Date range filter on fecha_inicio (inclusive on both ends).
  // The frontend sends fechaDesde/fechaHasta as YYYY-MM-DD.
  if (fechaDesde || fechaHasta) {
    const dateFilter: Record<string, Date> = {};
    if (fechaDesde) {
      const from = new Date(fechaDesde + 'T00:00:00');
      if (!isNaN(from.getTime())) dateFilter.gte = from;
    }
    if (fechaHasta) {
      // Inclusive end of day
      const to = new Date(fechaHasta + 'T23:59:59.999');
      if (!isNaN(to.getTime())) dateFilter.lte = to;
    }
    if (Object.keys(dateFilter).length > 0) {
      where.fecha_inicio = dateFilter;
    }
  }

  const skip = (page - 1) * pageSize;

  // ── Stats globales por estado y tipo ──────────────────────────────────────
  // Los KPIs y gráficos del frontend deben reflejar el universo filtrado SIN
  // el filtro de `estado` (el filtro de estado se usa para navegar entre los
  // KPIs, no para reducir el panorama). También ignoran la paginación, pues
  // son agregados sobre el total. Así, la suma de pendientes + aprobadas +
  // rechazadas siempre coincide con `stats.total` y con la suma del gráfico
  // de torta, evitando la discrepancia que ocurría cuando se calculaban
  // sobre el array de la página actual.
  const statsWhere: Record<string, unknown> = { ...where };
  delete statsWhere.estado;

  const [
    data,
    total,
    statsTotal,
    statsPendientes,
    statsAprobadas,
    statsRechazadas,
    byTypeRows,
    fechasInicio,
    processingRows,
  ] = await Promise.all([
    db.incidenciaNomina.findMany({
      where,
      include: {
        empleado: {
          select: {
            id: true,
            codigo_empleado: true,
            primer_nombre: true,
            segundo_nombre: true,
            primer_apellido: true,
            segundo_apellido: true,
          },
        },
        aprobada_por: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fecha_creacion: 'desc' },
      skip,
      take: pageSize,
    }),
    db.incidenciaNomina.count({ where }),
    db.incidenciaNomina.count({ where: statsWhere }),
    db.incidenciaNomina.count({ where: { ...statsWhere, estado: 'PENDIENTE' } }),
    db.incidenciaNomina.count({ where: { ...statsWhere, estado: 'APROBADA' } }),
    db.incidenciaNomina.count({ where: { ...statsWhere, estado: 'RECHAZADA' } }),
    db.incidenciaNomina.groupBy({ by: ['tipo'], where: statsWhere, _count: { _all: true } }),
    db.incidenciaNomina.findMany({ where: statsWhere, select: { fecha_inicio: true } }),
    db.incidenciaNomina.findMany({
      where: { ...statsWhere, estado: { not: 'PENDIENTE' } },
      select: { fecha_creacion: true, fecha_actualizacion: true },
    }),
  ]);

  // byType: { HORAS_EXTRA: 4, BONO: 4, ... }
  const byType: Record<string, number> = {};
  byTypeRows.forEach(r => { byType[r.tipo] = r._count._all; });

  // byMonth: { '2025-05': 4, '2025-06': 6, ... } (últimos 6 meses)
  const byMonth: Record<string, number> = {};
  fechasInicio.forEach(({ fecha_inicio }) => {
    const d = new Date(fecha_inicio);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  });

  // Tiempo promedio de procesamiento (horas) para incidencias ya resueltas
  let totalProcessingHours = 0;
  let processedCount = 0;
  processingRows.forEach(({ fecha_creacion, fecha_actualizacion }) => {
    if (fecha_creacion && fecha_actualizacion) {
      const hours = (new Date(fecha_actualizacion).getTime() - new Date(fecha_creacion).getTime()) / (1000 * 60 * 60);
      if (hours >= 0) {
        totalProcessingHours += hours;
        processedCount++;
      }
    }
  });
  const avgProcessingHours = processedCount > 0 ? totalProcessingHours / processedCount : 0;

  const approvalRate = statsTotal > 0 ? Math.round((statsAprobadas / statsTotal) * 100) : 0;

  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    stats: {
      total: statsTotal,
      pendientes: statsPendientes,
      aprobadas: statsAprobadas,
      rechazadas: statsRechazadas,
      byType,
      byMonth,
      avgProcessingHours,
      approvalRate,
      approved: statsAprobadas,
    },
  });
}

// POST /api/incidencias - Create incidencia
export async function POST(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // EMPLEADO can create their own incidences; ADMIN/ANALISTA can create for anyone
  const isEmpleado = user.rol === 'EMPLEADO';
  if (!isEmpleado) {
    const roleCheck = requireRoles('ADMIN', 'ANALISTA' as UserRole)(request);
    if ('error' in roleCheck) {
      return roleCheck.error;
    }
  }

  try {
    const body = await request.json();

    // If EMPLEADO, force their own empleado_id
    if (isEmpleado) {
      const empleado = await db.empleado.findFirst({
        where: { usuario: { id: user.userId } },
        select: { id: true },
      });
      if (!empleado) {
        return NextResponse.json({ error: 'No tiene perfil de empleado asociado' }, { status: 404 });
      }
      body.empleado_id = empleado.id;
    }

    // Validate required fields
    const required = ['empleado_id', 'tipo', 'fecha_inicio'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `El campo ${field} es requerido` }, { status: 400 });
      }
    }

    // Validate tipo
    const validTipos = ['HORAS_EXTRA', 'AUSENCIA', 'INCAPACIDAD_ISSS', 'PERMISO', 'COMISION', 'BONO', 'DESCUENTO_ESPECIAL'];
    if (!validTipos.includes(body.tipo)) {
      return NextResponse.json({ error: `Tipo de incidencia inválido. Válidos: ${validTipos.join(', ')}` }, { status: 400 });
    }

    // Validate HORAS_EXTRA: max 10h/week (Art. 169 CT)
    if (body.tipo === 'HORAS_EXTRA') {
      if (!body.cantidad_horas || body.cantidad_horas <= 0) {
        return NextResponse.json({ error: 'Debe especificar la cantidad de horas para HORAS_EXTRA' }, { status: 400 });
      }
      if (!body.tipo_horas_extra) {
        return NextResponse.json({ error: 'Debe especificar el tipo de horas extra' }, { status: 400 });
      }

      // Check weekly total
      const fechaInicio = new Date(body.fecha_inicio);
      const weekStart = new Date(fechaInicio);
      weekStart.setDate(fechaInicio.getDate() - fechaInicio.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const existingExtras = await db.incidenciaNomina.findMany({
        where: {
          empleado_id: body.empleado_id,
          tipo: 'HORAS_EXTRA',
          fecha_inicio: { gte: weekStart, lt: weekEnd },
          estado: { not: 'RECHAZADA' },
        },
        select: { cantidad_horas: true },
      });

      const totalHoras = existingExtras.reduce((sum, inc) => sum + (inc.cantidad_horas || 0), 0);
      if (totalHoras + body.cantidad_horas > 10) {
        return NextResponse.json({
          error: `No se pueden exceder 10 horas extra semanales según Art. 169 CT. Horas ya registradas: ${totalHoras}, intentando agregar: ${body.cantidad_horas}`,
        }, { status: 400 });
      }
    }

    // Validate INCAPACIDAD_ISSS
    if (body.tipo === 'INCAPACIDAD_ISSS' && !body.numero_incapacidad) {
      return NextResponse.json({ error: 'Debe especificar el número de incapacidad' }, { status: 400 });
    }

    // Validate COMISION/BONO/DESCUENTO_ESPECIAL
    if (['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(body.tipo) && (!body.monto || body.monto <= 0)) {
      return NextResponse.json({ error: 'Debe especificar el monto' }, { status: 400 });
    }

    // Validate dates
    if (body.fecha_fin && new Date(body.fecha_fin) < new Date(body.fecha_inicio)) {
      return NextResponse.json({ error: 'La fecha fin no puede ser anterior a la fecha inicio' }, { status: 400 });
    }

    const incidencia = await db.incidenciaNomina.create({
      data: {
        empleado_id: body.empleado_id,
        tipo: body.tipo,
        estado: 'PENDIENTE',
        fecha_inicio: new Date(body.fecha_inicio),
        fecha_fin: body.fecha_fin ? new Date(body.fecha_fin) : null,
        cantidad_horas: body.cantidad_horas || null,
        tipo_horas_extra: body.tipo_horas_extra || null,
        monto: body.monto || null,
        descripcion: body.descripcion || null,
        numero_incapacidad: body.numero_incapacidad || null,
        periodo_id: body.periodo_id || null,
      },
    });

    // Log to bitacora
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'CREAR_INCIDENCIA',
        tabla_afectada: 'incidencias_nomina',
        registro_id: incidencia.id,
        valor_nuevo: JSON.stringify({ tipo: body.tipo, empleado_id: body.empleado_id }),
        nivel_criticidad: 'NORMAL',
      },
    });

    // Fetch with relations
    const result = await db.incidenciaNomina.findUnique({
      where: { id: incidencia.id },
      include: {
        empleado: {
          select: {
            id: true, codigo_empleado: true,
            primer_nombre: true, primer_apellido: true,
          },
        },
      },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating incidencia:', error);
    return NextResponse.json({ error: 'Error al crear incidencia' }, { status: 500 });
  }
}
