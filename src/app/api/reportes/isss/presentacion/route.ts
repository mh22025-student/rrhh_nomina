import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

const ALLOWED_ROLES: UserRole[] = ['ADMIN', 'ANALISTA'];

// ============================================================
// POST /api/reportes/isss/presentacion
// Registra (o actualiza) la presentación de la planilla OIS ante el ISSS
// Body: { planilla_id, fecha_presentacion, numero_planilla_isss?, observaciones?, archivo_ois? }
// ============================================================
export async function POST(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json({ error: 'No tiene permisos para registrar presentaciones ISSS' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { planilla_id, fecha_presentacion, numero_planilla_isss, observaciones, archivo_ois } = body;

    if (!planilla_id || !fecha_presentacion) {
      return NextResponse.json({ error: 'planilla_id y fecha_presentacion son obligatorios' }, { status: 400 });
    }

    // Resolve periodo from planilla
    const planilla = await db.planilla.findUnique({ where: { id: planilla_id } });
    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 });
    }

    // Determine period from planilla dates (fallback to current month)
    const periodo_mes = planilla.fecha_fin_periodo
      ? planilla.fecha_fin_periodo.getMonth() + 1
      : new Date().getMonth() + 1;
    const periodo_anio = planilla.fecha_fin_periodo
      ? planilla.fecha_fin_periodo.getFullYear()
      : new Date().getFullYear();

    // Check if a presentation record already exists for this planilla + period
    const existing = await db.historialPresentacionISSS.findFirst({
      where: { planilla_id, periodo_mes, periodo_anio },
    });

    // Compute totals from planilla details for auditability
    const detalles = await db.detallePlanilla.findMany({
      where: { planilla_id },
      select: { isss_laboral: true, isss_patronal: true },
    });
    const totalLaboral = detalles.reduce((s, d) => s + (d.isss_laboral || 0), 0);
    const totalPatronal = detalles.reduce((s, d) => s + (d.isss_patronal || 0), 0);

    const valorAnterior = existing ? JSON.stringify({
      estado: existing.estado,
      fecha_presentacion: existing.fecha_presentacion,
      numero_planilla_isss: existing.numero_planilla_isss,
    }) : null;

    let presentacion;
    if (existing) {
      // Update existing record → mark as PRESENTADO
      presentacion = await db.historialPresentacionISSS.update({
        where: { id: existing.id },
        data: {
          estado: 'PRESENTADO',
          fecha_presentacion: new Date(fecha_presentacion),
          numero_planilla_isss: numero_planilla_isss || existing.numero_planilla_isss,
          archivo_ois: archivo_ois || existing.archivo_ois,
          total_cotizacion_laboral: totalLaboral,
          total_cotizacion_patronal: totalPatronal,
          observaciones: observaciones ?? existing.observaciones,
        },
      });
    } else {
      // Create new record
      presentacion = await db.historialPresentacionISSS.create({
        data: {
          planilla_id,
          periodo_mes,
          periodo_anio,
          numero_planilla_isss: numero_planilla_isss || null,
          fecha_presentacion: new Date(fecha_presentacion),
          estado: 'PRESENTADO',
          archivo_ois: archivo_ois || null,
          total_cotizacion_laboral: totalLaboral,
          total_cotizacion_patronal: totalPatronal,
          observaciones: observaciones || null,
        },
      });
    }

    // Log to bitácora (immutable audit trail)
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'PRESENTACION_ISSS',
        tabla_afectada: 'historial_presentaciones_isss',
        registro_id: presentacion.id,
        valor_anterior: valorAnterior,
        valor_nuevo: JSON.stringify({
          estado: 'PRESENTADO',
          fecha_presentacion,
          numero_planilla_isss: numero_planilla_isss || null,
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
        archivo_ois: presentacion.archivo_ois,
      },
    });
  } catch (error) {
    console.error('Error registrando presentación ISSS:', error);
    return NextResponse.json({ error: 'Error al registrar presentación ISSS' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/reportes/isss/presentacion?id=xxx
// Revierte la presentación (vuelve a PENDIENTE). Solo ADMIN/ANALISTA.
// ============================================================
export async function DELETE(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json({ error: 'No tiene permisos para revertir presentaciones ISSS' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
    }

    const existing = await db.historialPresentacionISSS.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Registro de presentación no encontrado' }, { status: 404 });
    }

    const valorAnterior = JSON.stringify({
      estado: existing.estado,
      fecha_presentacion: existing.fecha_presentacion,
      numero_planilla_isss: existing.numero_planilla_isss,
    });

    // Revert to PENDIENTE (preserve record for audit, clear presentation data)
    const updated = await db.historialPresentacionISSS.update({
      where: { id },
      data: {
        estado: 'PENDIENTE',
        fecha_presentacion: null,
        numero_planilla_isss: null,
      },
    });

    // Log reversal to bitácora
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'REVERSION_PRESENTACION_ISSS',
        tabla_afectada: 'historial_presentaciones_isss',
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
        archivo_ois: updated.archivo_ois,
      },
    });
  } catch (error) {
    console.error('Error revirtiendo presentación ISSS:', error);
    return NextResponse.json({ error: 'Error al revertir presentación ISSS' }, { status: 500 });
  }
}
