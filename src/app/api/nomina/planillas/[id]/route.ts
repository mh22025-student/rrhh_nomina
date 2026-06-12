import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// ============================================================
// GET /api/nomina/planillas/[id]
// Get planilla with all detalles
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const planilla = await db.planilla.findUnique({
      where: { id },
      include: {
        calculada_por: { select: { nombre: true, apellido: true, email: true } },
        aprobada_por: { select: { nombre: true, apellido: true, email: true } },
        detalles_planilla: {
          include: {
            empleado: {
              select: {
                id: true,
                codigo_empleado: true,
                primer_nombre: true,
                segundo_nombre: true,
                primer_apellido: true,
                segundo_apellido: true,
                numero_isss: true,
                numero_afp: true,
                dui: true,
                area: { select: { nombre: true } },
              },
            },
          },
          orderBy: { empleado: { primer_apellido: 'asc' } },
        },
        empleados_planilla: true,
        checklist_aprobacion: {
          include: {
            completado_por: { select: { nombre: true, apellido: true } },
          },
        },
        retornos_bancarios: { include: { banco: true } },
      },
    });

    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 });
    }

    // EMPLEADO role: only see own details
    if (user.rol === 'EMPLEADO' && user.empleadoId) {
      const ownDetail = planilla.detalles_planilla.find(
        d => d.empleado_id === user.empleadoId
      );
      return NextResponse.json({
        planilla: {
          id: planilla.id,
          codigo_planilla: planilla.codigo_planilla,
          tipo: planilla.tipo,
          estado: planilla.estado,
          fecha_inicio_periodo: planilla.fecha_inicio_periodo,
          fecha_fin_periodo: planilla.fecha_fin_periodo,
        },
        mi_detalle: ownDetail || null,
      });
    }

    return NextResponse.json({ planilla });
  } catch (error) {
    console.error('Error getting planilla:', error);
    return NextResponse.json({ error: 'Error al obtener planilla' }, { status: 500 });
  }
}

// ============================================================
// PUT /api/nomina/planillas/[id]
// Update planilla estado
// ============================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { estado, observaciones } = body as {
      estado?: string;
      observaciones?: string;
    };

    // Get current planilla
    const planilla = await db.planilla.findUnique({ where: { id } });
    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 });
    }

    // Inmutabilidad: Cannot modify APROBADA or PAGADA
    if (['APROBADA', 'PAGADA'].includes(planilla.estado) && estado !== planilla.estado) {
      // Only allow transition from APROBADA to PAGADA
      if (!(planilla.estado === 'APROBADA' && estado === 'PAGADA')) {
        return NextResponse.json(
          { error: `No se puede modificar una planilla en estado ${planilla.estado}` },
          { status: 400 }
        );
      }
    }

    // Role-based transitions
    if (estado === 'APROBADA') {
      const authCheck = requireRoles('ADMIN', 'APROBADOR')(request);
      if ('error' in authCheck) return authCheck.error;
      const { user } = authCheck;

      // Verify all checklist items are completed
      const checklist = await db.checklistAprobacionPlanilla.findMany({
        where: { planilla_id: id },
      });
      const allCompleted = checklist.every(item => item.completado);
      if (!allCompleted) {
        return NextResponse.json(
          { error: 'Debe completar todos los items del checklist antes de aprobar' },
          { status: 400 }
        );
      }

      // Segregation: analyst who calculated cannot approve
      if (planilla.calculada_por_id === user.userId) {
        return NextResponse.json(
          { error: 'El analista que calculó la planilla no puede aprobarla (segregación de funciones)' },
          { status: 403 }
        );
      }

      const updated = await db.planilla.update({
        where: { id },
        data: {
          estado: 'APROBADA',
          aprobada_por_id: user.userId,
          fecha_aprobacion: new Date(),
          observaciones: observaciones || planilla.observaciones,
        },
      });

      // Log to bitacora
      await db.bitacoraAuditoria.create({
        data: {
          usuario_id: user.userId,
          usuario_email: user.email,
          accion: 'APROBACION_PLANILLA',
          tabla_afectada: 'planillas',
          registro_id: id,
          valor_anterior: `estado: ${planilla.estado}`,
          valor_nuevo: 'estado: APROBADA',
          resultado: 'EXITOSO',
          nivel_criticidad: 'ALTO',
          detalle_adicional: `Planilla ${planilla.codigo_planilla} aprobada`,
        },
      });

      return NextResponse.json({ planilla: updated });
    }

    if (estado === 'PAGADA') {
      const authCheck = requireRoles('ADMIN', 'APROBADOR')(request);
      if ('error' in authCheck) return authCheck.error;

      if (planilla.estado !== 'APROBADA') {
        return NextResponse.json(
          { error: 'Solo se puede pagar una planilla aprobada' },
          { status: 400 }
        );
      }

      const updated = await db.planilla.update({
        where: { id },
        data: {
          estado: 'PAGADA',
          observaciones: observaciones || planilla.observaciones,
        },
      });

      await db.bitacoraAuditoria.create({
        data: {
          usuario_id: authCheck.user.userId,
          usuario_email: authCheck.user.email,
          accion: 'PAGO_PLANILLA',
          tabla_afectada: 'planillas',
          registro_id: id,
          valor_anterior: 'estado: APROBADA',
          valor_nuevo: 'estado: PAGADA',
          resultado: 'EXITOSO',
          nivel_criticidad: 'ALTO',
        },
      });

      return NextResponse.json({ planilla: updated });
    }

    if (estado === 'EN_CORRECCION') {
      const authCheck = requireRoles('ADMIN', 'APROBADOR')(request);
      if ('error' in authCheck) return authCheck.error;

      const updated = await db.planilla.update({
        where: { id },
        data: {
          estado: 'EN_CORRECCION',
          observaciones: observaciones || planilla.observaciones,
        },
      });

      return NextResponse.json({ planilla: updated });
    }

    // Generic update (observaciones only)
    if (observaciones) {
      const updated = await db.planilla.update({
        where: { id },
        data: { observaciones },
      });
      return NextResponse.json({ planilla: updated });
    }

    return NextResponse.json({ error: 'No se proporcionaron cambios válidos' }, { status: 400 });
  } catch (error) {
    console.error('Error updating planilla:', error);
    return NextResponse.json({ error: 'Error al actualizar planilla' }, { status: 500 });
  }
}
