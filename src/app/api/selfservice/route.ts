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
        periodo_inicio: d.planilla.fecha_inicio_periodo,
        periodo_fin: d.planilla.fecha_fin_periodo,
        tipo: d.planilla.tipo,
        salario_bruto: d.salario_bruto,
        total_descuentos: d.total_descuentos,
        salario_neto: d.salario_neto,
        isss_laboral: d.isss_laboral,
        afp_laboral: d.afp_laboral,
        isr_retenido: d.isr_retenido,
      })),
      documentos,
      solicitudes,
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
