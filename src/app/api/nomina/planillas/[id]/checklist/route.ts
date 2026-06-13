import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRoles } from '@/lib/auth-middleware';

// ============================================================
// GET /api/nomina/planillas/[id]/checklist
// Get checklist items for planilla approval
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = requireRoles('ADMIN', 'APROBADOR', 'AUDITOR')(request);
  if ('error' in authCheck) return authCheck.error;

  try {
    const { id } = await params;

    const checklist = await db.checklistAprobacionPlanilla.findMany({
      where: { planilla_id: id },
      include: {
        completado_por: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fecha_creacion: 'asc' },
    });

    return NextResponse.json({ checklist });
  } catch (error) {
    console.error('Error getting checklist:', error);
    return NextResponse.json({ error: 'Error al obtener checklist' }, { status: 500 });
  }
}

// ============================================================
// POST /api/nomina/planillas/[id]/checklist
// Complete a checklist item
// ============================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = requireRoles('ADMIN', 'APROBADOR')(request);
  if ('error' in authCheck) return authCheck.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { item_id, completado, observaciones } = body as {
      item_id: string;
      completado: boolean;
      observaciones?: string;
    };

    if (!item_id) {
      return NextResponse.json({ error: 'item_id es requerido' }, { status: 400 });
    }

    // Verify planilla exists and is in correct state
    const planilla = await db.planilla.findUnique({ where: { id } });
    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 });
    }

    if (planilla.estado !== 'CALCULADA' && planilla.estado !== 'EN_CORRECCION') {
      return NextResponse.json(
        { error: 'Solo se puede completar checklist en planillas en estado CALCULADA o EN_CORRECCION' },
        { status: 400 }
      );
    }

    const updated = await db.checklistAprobacionPlanilla.update({
      where: { id: item_id },
      data: {
        completado,
        completado_por_id: completado ? authCheck.user.userId : null,
        fecha_completado: completado ? new Date() : null,
        observaciones,
      },
    });

    // Log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: authCheck.user.userId,
        usuario_email: authCheck.user.email,
        accion: completado ? 'CHECKLIST_COMPLETADO' : 'CHECKLIST_DESMARCADO',
        tabla_afectada: 'checklist_aprobacion_planilla',
        registro_id: item_id,
        valor_nuevo: `${updated.item}: ${completado ? 'Completado' : 'Pendiente'}`,
        resultado: 'EXITOSO',
        nivel_criticidad: 'NORMAL',
        detalle_adicional: `Planilla ${planilla.codigo_planilla}`,
      },
    });

    return NextResponse.json({ checklist_item: updated });
  } catch (error) {
    console.error('Error updating checklist:', error);
    return NextResponse.json({ error: 'Error al actualizar checklist' }, { status: 500 });
  }
}
