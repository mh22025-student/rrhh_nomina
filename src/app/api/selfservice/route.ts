import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// GET /api/selfservice - Get self-service data for current employee
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    // Find employee linked to this user
    const usuario = await db.usuario.findUnique({
      where: { id: user.userId },
      include: { empleado: true },
    });

    if (!usuario?.empleado) {
      return NextResponse.json({ error: 'No tiene perfil de empleado asociado' }, { status: 404 });
    }

    const emp = usuario.empleado;

    // Get vacation balance
    const vacaciones = await db.vacacionEmpleado.findMany({
      where: { empleado_id: emp.id },
      orderBy: { anio: 'desc' },
    });

    // Get recent pay slips (last 6 months)
    const detalles = await db.detallePlanilla.findMany({
      where: {
        empleado_id: emp.id,
        planilla: { estado: { in: ['APROBADA', 'PAGADA'] } },
      },
      include: {
        planilla: {
          select: {
            codigo_planilla: true,
            fecha_inicio_periodo: true,
            fecha_fin_periodo: true,
            tipo: true,
            estado: true,
          },
        },
      },
      orderBy: { fecha_creacion: 'desc' },
      take: 6,
    });

    // Get documents
    const documentos = await db.documentoEmpleado.findMany({
      where: { empleado_id: emp.id },
      orderBy: { fecha_creacion: 'desc' },
      take: 10,
    });

    // Get solicitudes
    const solicitudes = await db.solicitudSelfService.findMany({
      where: { empleado_id: emp.id },
      orderBy: { fecha_solicitud: 'desc' },
      take: 10,
    });

    // Get perfil info
    const perfilInfo = emp.perfil_puesto_id
      ? await db.perfilPuesto.findUnique({
          where: { id: emp.perfil_puesto_id },
          include: { banda_salarial: true, area: true },
        })
      : null;

    // Generate dynamic notifications for this employee
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const notificaciones: Array<{ id: string; titulo: string; mensaje: string; prioridad: string; fecha: string; leida: boolean }> = [];

    // Check for pending solicitudes
    const pendingSolicitudes = solicitudes.filter(s => s.estado === 'PENDIENTE');
    if (pendingSolicitudes.length > 0) {
      notificaciones.push({
        id: `solicitudes-pendientes-${emp.id}`,
        titulo: 'Solicitudes Pendientes',
        mensaje: `Tiene ${pendingSolicitudes.length} solicitud(es) pendiente(s) de respuesta`,
        prioridad: 'MEDIA',
        fecha: now.toISOString(),
        leida: false,
      });
    }

    // Check for upcoming vacation balance
    const currentYearVacation = vacaciones.find(v => v.anio === currentYear);
    if (currentYearVacation && currentYearVacation.dias_pendientes > 0) {
      notificaciones.push({
        id: `vacation-balance-${emp.id}-${currentYear}`,
        titulo: 'Vacaciones Disponibles',
        mensaje: `Tiene ${currentYearVacation.dias_pendientes} día(s) de vacaciones disponibles para el periodo ${currentYear}`,
        prioridad: 'BAJA',
        fecha: now.toISOString(),
        leida: false,
      });
    }

    // Compliance deadline reminder
    const day15 = new Date(currentYear, currentMonth - 1, 15);
    const daysUntilISSS = Math.ceil((day15.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilISSS > 0 && daysUntilISSS <= 10) {
      notificaciones.push({
        id: `isss-deadline-${currentYear}-${currentMonth}`,
        titulo: 'Vencimiento ISSS',
        mensaje: `La planilla ISSS vence en ${daysUntilISSS} día(s)`,
        prioridad: 'ALTA',
        fecha: now.toISOString(),
        leida: false,
      });
    }

    return NextResponse.json({
      empleado: {
        id: emp.id,
        codigo_empleado: emp.codigo_empleado,
        primer_nombre: emp.primer_nombre,
        segundo_nombre: emp.segundo_nombre,
        primer_apellido: emp.primer_apellido,
        segundo_apellido: emp.segundo_apellido,
        dui: emp.dui,
        email_personal: emp.email_personal,
        telefono: emp.telefono,
        fecha_ingreso: emp.fecha_ingreso,
        salario_base: emp.salario_base,
        genero: emp.genero,
        estado: emp.estado,
      },
      area: emp.area_id
        ? await db.area.findUnique({ where: { id: emp.area_id } })
        : null,
      perfil_puesto: perfilInfo,
      vacaciones,
      recibos: detalles.map((d) => ({
        id: d.id,
        planilla_id: d.planilla_id,
        codigo_planilla: d.planilla.codigo_planilla,
        periodo_inicio: d.planilla.fecha_inicio_periodo,
        periodo_fin: d.planilla.fecha_fin_periodo,
        tipo: d.planilla.tipo,
        estado: d.planilla.estado,
        salario_bruto: d.salario_bruto,
        total_descuentos: d.total_descuentos,
        salario_neto: d.salario_neto,
        isss_laboral: d.isss_laboral,
        afp_laboral: d.afp_laboral,
        isr_retenido: d.isr_retenido,
      })),
      documentos,
      solicitudes,
      notificaciones: notificaciones.map((n) => ({
        id: n.id,
        titulo: n.titulo,
        mensaje: n.mensaje,
        prioridad: n.prioridad || 'MEDIA',
        fecha: n.fecha,
        leida: n.leida,
      })),
    });
  } catch (error) {
    console.error('Error fetching self-service data:', error);
    return NextResponse.json({ error: 'Error al obtener datos del portal' }, { status: 500 });
  }
}

// POST /api/selfservice - Create solicitud
export async function POST(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // EMPLEADO role can create solicitudes
  const roleCheck = requireRoles('EMPLEADO', 'ADMIN')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const body = await request.json();
    const { tipo, detalle } = body;

    if (!tipo) {
      return NextResponse.json({ error: 'Tipo de solicitud requerido' }, { status: 400 });
    }

    // Find employee linked to this user
    const usuario = await db.usuario.findUnique({
      where: { id: user.userId },
      include: { empleado: true },
    });

    if (!usuario?.empleado) {
      return NextResponse.json({ error: 'No tiene perfil de empleado asociado' }, { status: 404 });
    }

    const solicitud = await db.solicitudSelfService.create({
      data: {
        empleado_id: usuario.empleado.id,
        tipo,
        detalle: detalle || null,
        estado: 'PENDIENTE',
      },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'CREAR',
        tabla_afectada: 'solicitudes_self_service',
        registro_id: solicitud.id,
        valor_nuevo: JSON.stringify(solicitud),
        nivel_criticidad: 'NORMAL',
        detalle_adicional: `Solicitud creada: ${tipo}`,
      },
    });

    return NextResponse.json(solicitud, { status: 201 });
  } catch (error) {
    console.error('Error creating solicitud:', error);
    return NextResponse.json({ error: 'Error al crear solicitud' }, { status: 500 });
  }
}

// PATCH /api/selfservice - Cancel a pending solicitud
export async function PATCH(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const roleCheck = requireRoles('EMPLEADO', 'ADMIN')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const body = await request.json();
    const { solicitud_id, estado } = body;

    if (!solicitud_id || estado !== 'CANCELADA') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Find employee linked to this user
    const usuario = await db.usuario.findUnique({
      where: { id: user.userId },
      include: { empleado: true },
    });

    if (!usuario?.empleado) {
      return NextResponse.json({ error: 'No tiene perfil de empleado asociado' }, { status: 404 });
    }

    // Find the solicitud and verify ownership + pending status
    const solicitud = await db.solicitudSelfService.findUnique({
      where: { id: solicitud_id },
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (solicitud.empleado_id !== usuario.empleado.id) {
      return NextResponse.json({ error: 'No tiene permisos para cancelar esta solicitud' }, { status: 403 });
    }

    if (solicitud.estado !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Solo se pueden cancelar solicitudes pendientes' }, { status: 400 });
    }

    const updated = await db.solicitudSelfService.update({
      where: { id: solicitud_id },
      data: {
        estado: 'CANCELADA',
        fecha_resolucion: new Date().toISOString(),
      },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'CANCELAR',
        tabla_afectada: 'solicitudes_self_service',
        registro_id: solicitud_id,
        valor_anterior: JSON.stringify(solicitud),
        valor_nuevo: JSON.stringify(updated),
        nivel_criticidad: 'NORMAL',
        detalle_adicional: `Solicitud cancelada: ${solicitud.tipo}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error cancelling solicitud:', error);
    return NextResponse.json({ error: 'Error al cancelar solicitud' }, { status: 500 });
  }
}
