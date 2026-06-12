import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// PUT /api/incidencias/[id] - Update incidencia (approve, reject, apply)
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
            valor_nuevo: JSON.stringify({ estado: body.estado }),
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

      return NextResponse.json({ data: resultWithRelations });
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
