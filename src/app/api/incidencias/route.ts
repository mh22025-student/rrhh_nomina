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

  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
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
  ]);

  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

// POST /api/incidencias - Create incidencia
export async function POST(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN', 'ANALISTA' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user } = roleCheck;

  try {
    const body = await request.json();

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
