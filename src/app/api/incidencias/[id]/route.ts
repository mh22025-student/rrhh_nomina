import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// PUT /api/incidencias/[id] - Update incidencia (approve, reject, edit)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();

    const existing = await db.incidenciaNomina.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 });
    }

    // Approve/Reject - APROBADOR or ADMIN
    if (body.estado === 'APROBADA' || body.estado === 'RECHAZADA') {
      const roleCheck = requireRoles('ADMIN', 'APROBADOR' as UserRole)(request);
      if ('error' in roleCheck) {
        return roleCheck.error;
      }
      const { user: approver } = roleCheck;

      if (existing.estado !== 'PENDIENTE') {
        return NextResponse.json({ error: 'Solo se puede aprobar/rechazar incidencias pendientes' }, { status: 400 });
      }

      // The optional comment from the approver. It is stored in the audit log
      // (bitacora.detalle_adicional) so the incidence description is preserved
      // but the reviewer's rationale is still retrievable for audit purposes.
      const comment: string | undefined =
        typeof body.comentario === 'string'
          ? body.comentario.trim().slice(0, 500) || undefined
          : typeof body.descripcion === 'string'
            ? body.descripcion.trim().slice(0, 500) || undefined
            : undefined;

      const result = await db.$transaction(async (tx) => {
        const updated = await tx.incidenciaNomina.update({
          where: { id },
          data: {
            estado: body.estado,
            aprobada_por_id: approver.userId,
          },
        });

        await tx.bitacoraAuditoria.create({
          data: {
            usuario_id: approver.userId,
            usuario_email: approver.email,
            accion: body.estado === 'APROBADA' ? 'APROBAR_INCIDENCIA' : 'RECHAZAR_INCIDENCIA',
            tabla_afectada: 'incidencias_nomina',
            registro_id: id,
            valor_anterior: JSON.stringify({ estado: existing.estado }),
            valor_nuevo: JSON.stringify({ estado: body.estado, comentario: comment || null }),
            detalle_adicional: comment || null,
            nivel_criticidad: body.estado === 'APROBADA' ? 'NORMAL' : 'BAJO',
          },
        });

        return updated;
      });

      const resultWithRelations = await db.incidenciaNomina.findUnique({
        where: { id },
        include: {
          empleado: {
            select: {
              id: true, codigo_empleado: true,
              primer_nombre: true, primer_apellido: true,
            },
          },
          aprobada_por: { select: { nombre: true, apellido: true } },
        },
      });

      return NextResponse.json({ data: resultWithRelations, comentario: comment || null });
    }

    // Edit - ANALISTA or ADMIN
    if (body.estado === 'PENDIENTE' || !body.estado) {
      const roleCheck = requireRoles('ADMIN', 'ANALISTA' as UserRole)(request);
      if ('error' in roleCheck) {
        return roleCheck.error;
      }

      if (existing.estado !== 'PENDIENTE') {
        return NextResponse.json({ error: 'Solo se pueden editar incidencias pendientes' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {};
      const fields = ['tipo', 'fecha_inicio', 'fecha_fin', 'cantidad_horas', 'tipo_horas_extra', 'monto', 'descripcion', 'numero_incapacidad'];
      for (const field of fields) {
        if (body[field] !== undefined) {
          if (['fecha_inicio', 'fecha_fin'].includes(field) && body[field]) {
            updateData[field] = new Date(body[field]);
          } else {
            updateData[field] = body[field];
          }
        }
      }

      const updated = await db.incidenciaNomina.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
  } catch (error) {
    console.error('Error updating incidencia:', error);
    return NextResponse.json({ error: 'Error al actualizar incidencia' }, { status: 500 });
  }
}

// DELETE /api/incidencias/[id] - Delete a PENDING incidencia (ADMIN/ANALISTA only)
// Approved/rejected incidences cannot be deleted (they are part of the audit trail);
// they must be reverted to PENDING first if a correction is needed.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const roleCheck = requireRoles('ADMIN', 'ANALISTA' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user: actor } = roleCheck;

  const { id } = await params;

  try {
    const existing = await db.incidenciaNomina.findUnique({
      where: { id },
      include: {
        empleado: {
          select: { codigo_empleado: true, primer_nombre: true, primer_apellido: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 });
    }

    if (existing.estado !== 'PENDIENTE') {
      return NextResponse.json(
        {
          error:
            'No se puede eliminar una incidencia que ya fue aprobada o rechazada. ' +
            'Revierta el estado a PENDIENTE antes de eliminarla, o créela nuevamente.',
        },
        { status: 400 }
      );
    }

    // Snapshot for audit before hard-delete
    const snapshot = {
      tipo: existing.tipo,
      estado: existing.estado,
      empleado_id: existing.empleado_id,
      empleado: `${existing.empleado.primer_nombre} ${existing.empleado.primer_apellido} (${existing.empleado.codigo_empleado})`,
      fecha_inicio: existing.fecha_inicio,
      fecha_fin: existing.fecha_fin,
      cantidad_horas: existing.cantidad_horas,
      monto: existing.monto,
      descripcion: existing.descripcion,
    };

    await db.$transaction(async (tx) => {
      await tx.incidenciaNomina.delete({ where: { id } });

      await tx.bitacoraAuditoria.create({
        data: {
          usuario_id: actor.userId,
          usuario_email: actor.email,
          accion: 'ELIMINAR_INCIDENCIA',
          tabla_afectada: 'incidencias_nomina',
          registro_id: id,
          valor_anterior: JSON.stringify(snapshot),
          valor_nuevo: null,
          detalle_adicional: `Incidencia eliminada por ${actor.email}`,
          nivel_criticidad: 'ALTA',
        },
      });
    });

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    console.error('Error deleting incidencia:', error);
    return NextResponse.json({ error: 'Error al eliminar incidencia' }, { status: 500 });
  }
}
