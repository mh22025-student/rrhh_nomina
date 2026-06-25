import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

const ALLOWED_ROLES: UserRole[] = ['ADMIN', 'ANALISTA'];

// ============================================================
// POST /api/reportes/isr/entero
// Registra (o actualiza) el entero del Formulario F-910 ante la DGII
// Body: { planilla_id, fecha_entero, formulario_f910?, observaciones? }
// ============================================================
export async function POST(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json({ error: 'No tiene permisos para registrar enteros de ISR' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { planilla_id, fecha_entero, formulario_f910, observaciones } = body;

    if (!planilla_id || !fecha_entero) {
      return NextResponse.json({ error: 'planilla_id y fecha_entero son obligatorios' }, { status: 400 });
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

    // Check if an entero record already exists for this planilla + period
    const existing = await db.historialEnteroISR.findFirst({
      where: { planilla_id, periodo_mes, periodo_anio },
    });

    // Compute total retenciones from planilla details
    const detalles = await db.detallePlanilla.findMany({
      where: { planilla_id },
      select: { isr_retenido: true },
    });
    const totalRetenciones = detalles.reduce((s, d) => s + (d.isr_retenido || 0), 0);

    const valorAnterior = existing ? JSON.stringify({
      estado: existing.estado,
      fecha_entero: existing.fecha_entero,
      formulario_f910: existing.formulario_f910,
    }) : null;

    let entero;
    if (existing) {
      entero = await db.historialEnteroISR.update({
        where: { id: existing.id },
        data: {
          estado: 'ENTERADO',
          fecha_entero: new Date(fecha_entero),
          formulario_f910: formulario_f910 || existing.formulario_f910,
          total_retenciones: totalRetenciones,
          observaciones: observaciones ?? existing.observaciones,
        },
      });
    } else {
      entero = await db.historialEnteroISR.create({
        data: {
          planilla_id,
          periodo_mes,
          periodo_anio,
          fecha_entero: new Date(fecha_entero),
          estado: 'ENTERADO',
          formulario_f910: formulario_f910 || null,
          total_retenciones: totalRetenciones,
          observaciones: observaciones || null,
        },
      });
    }

    // Log to bitácora
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'ENTERO_ISR',
        tabla_afectada: 'historial_enteros_isr',
        registro_id: entero.id,
        valor_anterior: valorAnterior,
        valor_nuevo: JSON.stringify({
          estado: 'ENTERADO',
          fecha_entero,
          formulario_f910: formulario_f910 || null,
          periodo: `${periodo_mes}/${periodo_anio}`,
          total_retenciones: totalRetenciones,
        }),
        resultado: 'EXITOSO',
        nivel_criticidad: 'ALTA',
      },
    });

    return NextResponse.json({
      success: true,
      entero: {
        id: entero.id,
        estado: entero.estado,
        fecha_entero: entero.fecha_entero,
        formulario_f910: entero.formulario_f910,
      },
    });
  } catch (error) {
    console.error('Error registrando entero ISR:', error);
    return NextResponse.json({ error: 'Error al registrar entero ISR' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/reportes/isr/entero?id=xxx
// Revierte el entero (vuelve a PENDIENTE).
// ============================================================
export async function DELETE(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json({ error: 'No tiene permisos para revertir enteros de ISR' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
    }

    const existing = await db.historialEnteroISR.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Registro de entero no encontrado' }, { status: 404 });
    }

    const valorAnterior = JSON.stringify({
      estado: existing.estado,
      fecha_entero: existing.fecha_entero,
      formulario_f910: existing.formulario_f910,
    });

    const updated = await db.historialEnteroISR.update({
      where: { id },
      data: {
        estado: 'PENDIENTE',
        fecha_entero: null,
        formulario_f910: null,
      },
    });

    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'REVERSION_ENTERO_ISR',
        tabla_afectada: 'historial_enteros_isr',
        registro_id: id,
        valor_anterior: valorAnterior,
        valor_nuevo: JSON.stringify({ estado: 'PENDIENTE', fecha_entero: null }),
        resultado: 'EXITOSO',
        nivel_criticidad: 'ALTA',
      },
    });

    return NextResponse.json({
      success: true,
      entero: {
        id: updated.id,
        estado: updated.estado,
        fecha_entero: updated.fecha_entero,
        formulario_f910: updated.formulario_f910,
      },
    });
  } catch (error) {
    console.error('Error revirtiendo entero ISR:', error);
    return NextResponse.json({ error: 'Error al revertir entero ISR' }, { status: 500 });
  }
}
