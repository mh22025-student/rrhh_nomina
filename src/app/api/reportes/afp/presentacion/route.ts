import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

const ALLOWED_ROLES: UserRole[] = ['ADMIN', 'ANALISTA'];

// ============================================================
// POST /api/reportes/afp/presentacion
// Registra (o actualiza) la presentación de la planilla SEPP ante una AFP
// Body: { planilla_id, administradora, fecha_presentacion, observaciones?, archivo_sepp? }
// ============================================================
export async function POST(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json({ error: 'No tiene permisos para registrar presentaciones AFP' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { planilla_id, administradora, fecha_presentacion, observaciones, archivo_sepp } = body;

    if (!planilla_id || !administradora || !fecha_presentacion) {
      return NextResponse.json({ error: 'planilla_id, administradora y fecha_presentacion son obligatorios' }, { status: 400 });
    }

    const adminUpper = String(administradora).toUpperCase().trim();
    if (!['CRECER', 'CONFIA', 'CONFIÁ'].includes(adminUpper)) {
      return NextResponse.json({ error: 'Administradora inválida (debe ser CRECER o CONFIA)' }, { status: 400 });
    }

    // Resolve periodo from planilla
    const planilla = await db.planilla.findUnique({ where: { id: planilla_id } });
    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 });
    }

    const periodo_mes = planilla.fecha_fin_periodo
      ? planilla.fecha_fin_periodo.getMonth() + 1
      : new Date().getMonth() + 1;
    const periodo_anio = planilla.fecha_fin_periodo
      ? planilla.fecha_fin_periodo.getFullYear()
      : new Date().getFullYear();

    // Check if a presentation record already exists for this planilla + period + admin
    const existing = await db.historialPresentacionAFP.findFirst({
      where: { planilla_id, periodo_mes, periodo_anio, administradora: adminUpper },
    });

    // Compute totals from planilla details for this AFP (filter by employee's AFP)
    const empleadosAdmin = await db.empleado.findMany({
      where: { afp_administradora: adminUpper, estado: 'ACTIVO' },
      select: { id: true },
    });
    const empIds = new Set(empleadosAdmin.map(e => e.id));
    const detalles = await db.detallePlanilla.findMany({
      where: { planilla_id },
      select: { empleado_id: true, afp_laboral: true, afp_patronal: true },
    });
    const detallesAdmin = detalles.filter(d => empIds.has(d.empleado_id));
    const totalLaboral = detallesAdmin.reduce((s, d) => s + (d.afp_laboral || 0), 0);
    const totalPatronal = detallesAdmin.reduce((s, d) => s + (d.afp_patronal || 0), 0);

    const valorAnterior = existing ? JSON.stringify({
      estado: existing.estado,
      fecha_presentacion: existing.fecha_presentacion,
      administradora: existing.administradora,
    }) : null;

    let presentacion;
    if (existing) {
      presentacion = await db.historialPresentacionAFP.update({
        where: { id: existing.id },
        data: {
          estado: 'PRESENTADO',
          fecha_presentacion: new Date(fecha_presentacion),
          archivo_sepp: archivo_sepp || existing.archivo_sepp,
          total_cotizacion_laboral: totalLaboral,
          total_cotizacion_patronal: totalPatronal,
          observaciones: observaciones ?? existing.observaciones,
        },
      });
    } else {
      presentacion = await db.historialPresentacionAFP.create({
        data: {
          planilla_id,
          administradora: adminUpper,
          periodo_mes,
          periodo_anio,
          fecha_presentacion: new Date(fecha_presentacion),
          estado: 'PRESENTADO',
          archivo_sepp: archivo_sepp || null,
          total_cotizacion_laboral: totalLaboral,
          total_cotizacion_patronal: totalPatronal,
          observaciones: observaciones || null,
        },
      });
    }

    // Log to bitácora
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'PRESENTACION_AFP',
        tabla_afectada: 'historial_presentaciones_afp',
        registro_id: presentacion.id,
        valor_anterior: valorAnterior,
        valor_nuevo: JSON.stringify({
          estado: 'PRESENTADO',
          administradora: adminUpper,
          fecha_presentacion,
          periodo: `${periodo_mes}/${periodo_anio}`,
          total_cotizacion_laboral: totalLaboral,
          total_cotizacion_patronal: totalPatronal,
        }),
        resultado: 'EXITOSO',
        nivel_criticidad: 'ALTA',
      },
    });

    return NextResponse.json({
      success: true,
      presentacion: {
        id: presentacion.id,
        estado: presentacion.estado,
        fecha_presentacion: presentacion.fecha_presentacion,
        administradora: presentacion.administradora,
        archivo_sepp: presentacion.archivo_sepp,
      },
    });
  } catch (error) {
    console.error('Error registrando presentación AFP:', error);
    return NextResponse.json({ error: 'Error al registrar presentación AFP' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/reportes/afp/presentacion?id=xxx
// Revierte la presentación de una AFP (vuelve a PENDIENTE).
// ============================================================
export async function DELETE(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json({ error: 'No tiene permisos para revertir presentaciones AFP' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
    }

    const existing = await db.historialPresentacionAFP.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Registro de presentación no encontrado' }, { status: 404 });
    }

    const valorAnterior = JSON.stringify({
      estado: existing.estado,
      fecha_presentacion: existing.fecha_presentacion,
      administradora: existing.administradora,
    });

    const updated = await db.historialPresentacionAFP.update({
      where: { id },
      data: {
        estado: 'PENDIENTE',
        fecha_presentacion: null,
      },
    });

    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'REVERSION_PRESENTACION_AFP',
        tabla_afectada: 'historial_presentaciones_afp',
        registro_id: id,
        valor_anterior: valorAnterior,
        valor_nuevo: JSON.stringify({ estado: 'PENDIENTE', fecha_presentacion: null }),
        resultado: 'EXITOSO',
        nivel_criticidad: 'ALTA',
      },
    });

    return NextResponse.json({
      success: true,
      presentacion: {
        id: updated.id,
        estado: updated.estado,
        fecha_presentacion: updated.fecha_presentacion,
        administradora: updated.administradora,
        archivo_sepp: updated.archivo_sepp,
      },
    });
  } catch (error) {
    console.error('Error revirtiendo presentación AFP:', error);
    return NextResponse.json({ error: 'Error al revertir presentación AFP' }, { status: 500 });
  }
}
