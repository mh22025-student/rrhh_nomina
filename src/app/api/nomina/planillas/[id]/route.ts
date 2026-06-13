import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// ============================================================
// Valid state transitions per role (Segregation of Duties)
// ============================================================
const WORKFLOW_TRANSITIONS: Record<string, Record<string, string[]>> = {
  ANALISTA: {
    CALCULADA: ['EN_CORRECCION'],  // Analyst can only send for correction (not approve)
  },
  APROBADOR: {
    CALCULADA: ['APROBADA', 'EN_CORRECCION'],  // Approver can approve or reject
    EN_CORRECCION: ['APROBADA', 'EN_CORRECCION'], // After correction, can approve or re-reject
    APROBADA: ['PAGADA'],  // Approver can mark as paid
  },
  ADMIN: {
    CALCULADA: ['APROBADA', 'EN_CORRECCION'],
    EN_CORRECCION: ['APROBADA', 'EN_CORRECCION', 'CALCULADA'],
    APROBADA: ['PAGADA', 'EN_CORRECCION'],
  },
  GERENCIA: {
    CALCULADA: ['APROBADA', 'EN_CORRECCION'],
    APROBADA: ['PAGADA'],
  },
};

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

    // For non-EMPLEADO, also fetch the workflow timeline from bitacora
    const timeline = await db.bitacoraAuditoria.findMany({
      where: {
        tabla_afectada: 'planillas',
        registro_id: id,
        accion: { in: ['APROBACION_PLANILLA', 'PAGO_PLANILLA', 'RECHAZO_PLANILLA', 'CORRECCION_PLANILLA', 'CALCULO_PLANILLA', 'CALCULO_AGUINALDO', 'ENVIO_APROBACION'] },
      },
      orderBy: { fecha_accion: 'asc' },
      select: {
        id: true,
        accion: true,
        usuario_email: true,
        valor_anterior: true,
        valor_nuevo: true,
        detalle_adicional: true,
        fecha_accion: true,
      },
    });

    return NextResponse.json({ planilla, timeline });
  } catch (error) {
    console.error('Error getting planilla:', error);
    return NextResponse.json({ error: 'Error al obtener planilla' }, { status: 500 });
  }
}

// ============================================================
// PUT /api/nomina/planillas/[id]
// Update planilla estado — Full workflow with RBAC
// CALCULADA → EN_CORRECCION → APROBADA → PAGADA
// ============================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { estado, observaciones, motivo_rechazo, referencia_pago } = body as {
      estado?: string;
      observaciones?: string;
      motivo_rechazo?: string;
      referencia_pago?: string;
    };

    // Verify auth
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Get current planilla
    const planilla = await db.planilla.findUnique({ where: { id } });
    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 });
    }

    const currentEstado = planilla.estado;

    // If no estado change requested, just update observaciones
    if (!estado || estado === currentEstado) {
      if (observaciones) {
        const updated = await db.planilla.update({
          where: { id },
          data: { observaciones },
        });
        return NextResponse.json({ planilla: updated });
      }
      return NextResponse.json({ error: 'No se proporcionaron cambios válidos' }, { status: 400 });
    }

    // Validate state transition for user role
    const allowedTransitions = WORKFLOW_TRANSITIONS[user.rol];
    if (!allowedTransitions) {
      return NextResponse.json(
        { error: 'Su rol no tiene permisos para cambiar el estado de planillas' },
        { status: 403 }
      );
    }

    const allowedNextStates = allowedTransitions[currentEstado];
    if (!allowedNextStates || !allowedNextStates.includes(estado)) {
      return NextResponse.json(
        { error: `Transición no permitida: ${currentEstado} → ${estado} para rol ${user.rol}` },
        { status: 403 }
      );
    }

    // ============================================================
    // Transition: CALCULADA/EN_CORRECCION → EN_CORRECCION (Rejection)
    // ============================================================
    if (estado === 'EN_CORRECCION') {
      const authCheck = requireRoles('ADMIN', 'APROBADOR', 'GERENCIA')(request);
      if ('error' in authCheck) return authCheck.error;

      if (!motivo_rechazo && currentEstado === 'CALCULADA') {
        return NextResponse.json(
          { error: 'Debe indicar el motivo de rechazo/corrección' },
          { status: 400 }
        );
      }

      // Use raw SQL since cached Prisma client may not have motivo_rechazo
      await db.$executeRaw`
        UPDATE planilla
        SET estado = 'EN_CORRECCION',
            motivo_rechazo = COALESCE(${motivo_rechazo || null}, motivo_rechazo),
            observaciones = COALESCE(${observaciones || null}, observaciones),
            fecha_actualizacion = ${new Date()}
        WHERE id = ${id}
      `;
      const updated = await db.planilla.findUnique({ where: { id } });

      // Log to bitacora
      await db.bitacoraAuditoria.create({
        data: {
          usuario_id: user.userId,
          usuario_email: user.email,
          accion: 'RECHAZO_PLANILLA',
          tabla_afectada: 'planillas',
          registro_id: id,
          valor_anterior: `estado: ${currentEstado}`,
          valor_nuevo: 'estado: EN_CORRECCION',
          resultado: 'EXITOSO',
          nivel_criticidad: 'ALTO',
          detalle_adicional: `Planilla ${planilla.codigo_planilla} devuelta para corrección. Motivo: ${motivo_rechazo || 'N/A'}`,
        },
      });

      return NextResponse.json({ planilla: updated });
    }

    // ============================================================
    // Transition: CALCULADA/EN_CORRECCION → APROBADA
    // ============================================================
    if (estado === 'APROBADA') {
      const authCheck = requireRoles('ADMIN', 'APROBADOR', 'GERENCIA')(request);
      if ('error' in authCheck) return authCheck.error;
      const { user: authUser } = authCheck;

      // Verify all checklist items are completed
      const checklist = await db.checklistAprobacionPlanilla.findMany({
        where: { planilla_id: id },
      });
      if (checklist.length > 0) {
        const allCompleted = checklist.every(item => item.completado);
        if (!allCompleted) {
          return NextResponse.json(
            { error: 'Debe completar todos los items del checklist antes de aprobar' },
            { status: 400 }
          );
        }
      }

      // Segregation: analyst who calculated cannot approve (unless ADMIN)
      if (user.rol !== 'ADMIN' && planilla.calculada_por_id === authUser.userId) {
        return NextResponse.json(
          { error: 'El analista que calculó la planilla no puede aprobarla (segregación de funciones)' },
          { status: 403 }
        );
      }

      // Use raw SQL since cached Prisma client may not have new fields
      await db.$executeRaw`
        UPDATE planilla
        SET estado = 'APROBADA',
            aprobada_por_id = ${authUser.userId},
            fecha_aprobacion = ${new Date()},
            motivo_rechazo = NULL,
            observaciones = COALESCE(${observaciones || null}, observaciones),
            fecha_actualizacion = ${new Date()}
        WHERE id = ${id}
      `;

      const updated = await db.planilla.findUnique({ where: { id } });

      // Log to bitacora
      await db.bitacoraAuditoria.create({
        data: {
          usuario_id: authUser.userId,
          usuario_email: authUser.email,
          accion: 'APROBACION_PLANILLA',
          tabla_afectada: 'planillas',
          registro_id: id,
          valor_anterior: `estado: ${currentEstado}`,
          valor_nuevo: 'estado: APROBADA',
          resultado: 'EXITOSO',
          nivel_criticidad: 'ALTO',
          detalle_adicional: `Planilla ${planilla.codigo_planilla} aprobada por ${authUser.email}`,
        },
      });

      return NextResponse.json({ planilla: updated });
    }

    // ============================================================
    // Transition: APROBADA → PAGADA
    // ============================================================
    if (estado === 'PAGADA') {
      const authCheck = requireRoles('ADMIN', 'APROBADOR', 'GERENCIA')(request);
      if ('error' in authCheck) return authCheck.error;

      if (planilla.estado !== 'APROBADA') {
        return NextResponse.json(
          { error: 'Solo se puede pagar una planilla aprobada' },
          { status: 400 }
        );
      }

      // Use raw SQL since cached Prisma client may not have fecha_pago/referencia_pago
      await db.$executeRaw`
        UPDATE planilla
        SET estado = 'PAGADA',
            fecha_pago = ${new Date()},
            referencia_pago = ${referencia_pago || null},
            observaciones = COALESCE(${observaciones || null}, observaciones),
            fecha_actualizacion = ${new Date()}
        WHERE id = ${id}
      `;
      const updated = await db.planilla.findUnique({ where: { id } });

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
          detalle_adicional: `Planilla ${planilla.codigo_planilla} marcada como pagada. Referencia: ${referencia_pago || 'N/A'}`,
        },
      });

      return NextResponse.json({ planilla: updated });
    }

    // ============================================================
    // Transition: EN_CORRECCION → CALCULADA (re-calculate, ADMIN only)
    // ============================================================
    if (estado === 'CALCULADA') {
      const authCheck = requireRoles('ADMIN')(request);
      if ('error' in authCheck) return authCheck.error;

      // Use raw SQL since cached Prisma client may not have motivo_rechazo
      await db.$executeRaw`
        UPDATE planilla
        SET estado = 'CALCULADA',
            motivo_rechazo = NULL,
            observaciones = COALESCE(${observaciones || null}, observaciones),
            fecha_actualizacion = ${new Date()}
        WHERE id = ${id}
      `;
      const updated = await db.planilla.findUnique({ where: { id } });

      await db.bitacoraAuditoria.create({
        data: {
          usuario_id: authCheck.user.userId,
          usuario_email: authCheck.user.email,
          accion: 'CORRECCION_PLANILLA',
          tabla_afectada: 'planillas',
          registro_id: id,
          valor_anterior: `estado: ${currentEstado}`,
          valor_nuevo: 'estado: CALCULADA',
          resultado: 'EXITOSO',
          nivel_criticidad: 'ALTO',
          detalle_adicional: `Planilla ${planilla.codigo_planilla} devuelta a CALCULADA por ADMIN`,
        },
      });

      return NextResponse.json({ planilla: updated });
    }

    return NextResponse.json({ error: 'Transición no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('Error updating planilla:', error);
    return NextResponse.json({ error: 'Error al actualizar planilla' }, { status: 500 });
  }
}
