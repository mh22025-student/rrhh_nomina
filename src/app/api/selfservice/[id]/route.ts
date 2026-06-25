import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';
import { notifyEmpleado } from '@/lib/notifications';

// ============================================================
// GET /api/selfservice/[id]
// Fetch a single solicitud (ADMIN/ANALISTA/APROBADOR for the bandeja).
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const roleCheck = requireRoles('ADMIN', 'ANALISTA', 'APROBADOR' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const { id } = await params;
    const solicitud = await db.solicitudSelfService.findUnique({
      where: { id },
      include: {
        empleado: {
          select: {
            id: true,
            codigo_empleado: true,
            primer_nombre: true,
            segundo_nombre: true,
            primer_apellido: true,
            segundo_apellido: true,
            email_personal: true,
            telefono: true,
            perfil_puesto: { select: { nombre_puesto: true } },
            area: { select: { nombre: true } },
          },
        },
        aprobada_por: { select: { nombre: true, apellido: true } },
      },
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: solicitud });
  } catch (error) {
    console.error('Error fetching solicitud:', error);
    return NextResponse.json({ error: 'Error al obtener solicitud' }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/selfservice/[id]
// Approve or reject a solicitud.
// Body: { estado: 'APROBADA' | 'RECHAZADA', comentario?: string }
// Only ADMIN / APROBADOR / ANALISTA can do this.
// Notifies the employee when the solicitud is resolved.
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const roleCheck = requireRoles('ADMIN', 'APROBADOR', 'ANALISTA' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user: approver } = roleCheck;

  try {
    const { id } = await params;
    const body = await request.json();
    const { estado, comentario } = body;

    if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
      return NextResponse.json(
        { error: "Estado inválido. Debe ser 'APROBADA' o 'RECHAZADA'" },
        { status: 400 }
      );
    }

    const comment = typeof comentario === 'string' ? comentario.trim().slice(0, 500) : '';

    const existing = await db.solicitudSelfService.findUnique({
      where: { id },
      include: {
        empleado: {
          select: {
            id: true,
            codigo_empleado: true,
            primer_nombre: true,
            primer_apellido: true,
            usuario: { select: { id: true } },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (existing.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { error: `La solicitud ya fue ${existing.estado.toLowerCase()} y no se puede modificar` },
        { status: 400 }
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.solicitudSelfService.update({
        where: { id },
        data: {
          estado,
          aprobada_por_id: approver.userId,
          fecha_resolucion: new Date(),
        },
      });

      await tx.bitacoraAuditoria.create({
        data: {
          usuario_id: approver.userId,
          usuario_email: approver.email,
          accion: estado === 'APROBADA' ? 'APROBAR_SOLICITUD' : 'RECHAZAR_SOLICITUD',
          tabla_afectada: 'solicitudes_self_service',
          registro_id: id,
          valor_anterior: JSON.stringify({ estado: existing.estado }),
          valor_nuevo: JSON.stringify({ estado, comentario: comment || null }),
          detalle_adicional: comment || null,
          nivel_criticidad: estado === 'APROBADA' ? 'NORMAL' : 'BAJO',
        },
      });

      return result;
    });

    // ── For CONSTANCIA_* approvals, create a DocumentoEmpleado record ──
    // so the employee can see & download the generated document.
    const isConstancia =
      estado === 'APROBADA' &&
      ['CONSTANCIA_EMPLEO', 'CONSTANCIA_SALARIAL', 'CONSTANCIA_ISR'].includes(existing.tipo);

    if (isConstancia) {
      const tipoDocMap: Record<string, { tipoDoc: string; nombre: string }> = {
        CONSTANCIA_EMPLEO: {
          tipoDoc: 'CONSTANCIA_EMPLEO',
          nombre: `Constancia de Empleo - ${existing.empleado.codigo_empleado}.pdf`,
        },
        CONSTANCIA_SALARIAL: {
          tipoDoc: 'CONSTANCIA_SALARIAL',
          nombre: `Constancia Salarial - ${existing.empleado.codigo_empleado}.pdf`,
        },
        CONSTANCIA_ISR: {
          tipoDoc: 'CONSTANCIA_ISR',
          nombre: `Constancia ISR - ${existing.empleado.codigo_empleado}.pdf`,
        },
      };
      const docInfo = tipoDocMap[existing.tipo];
      // Virtual path: stores a reference to the solicitud so the PDF can be
      // regenerated on demand by /api/selfservice/[id]/descargar
      const virtualPath = `selfservice:${id}`;

      await db.documentoEmpleado.create({
        data: {
          empleado_id: existing.empleado.id,
          tipo_documento: docInfo.tipoDoc,
          nombre_archivo: docInfo.nombre,
          ruta_archivo: virtualPath,
          tipo_mime: 'application/pdf',
          descripcion: `Documento generado automáticamente al aprobarse la solicitud ${id}. Tipo: ${existing.tipo}.`,
          subido_por_id: approver.userId,
        },
      });
    }

    // ── Notify the employee that their solicitud was resolved ──
    const tipoLabels: Record<string, string> = {
      VACACION: 'Vacaciones',
      CONSTANCIA_EMPLEO: 'Constancia de Empleo',
      CONSTANCIA_SALARIAL: 'Constancia Salarial',
      CONSTANCIA_ISR: 'Constancia ISR',
      CAMBIO_DATOS: 'Cambio de Datos',
    };
    const tipoLabel = tipoLabels[existing.tipo] || existing.tipo;
    const empleadoNombre = `${existing.empleado.primer_nombre} ${existing.empleado.primer_apellido}`;

    const titulo =
      estado === 'APROBADA'
        ? `Solicitud de ${tipoLabel} aprobada`
        : `Solicitud de ${tipoLabel} rechazada`;

    // For constancias aprobadas, mention the document is ready to download
    let mensaje: string;
    if (estado === 'APROBADA') {
      if (isConstancia) {
        mensaje = `Hola ${empleadoNombre}, tu solicitud de ${tipoLabel.toLowerCase()} ha sido aprobada. El documento PDF está disponible para descarga en la sección "Mis Solicitudes".`;
      } else {
        mensaje = `Hola ${empleadoNombre}, tu solicitud de ${tipoLabel.toLowerCase()} ha sido aprobada.`;
      }
    } else {
      mensaje = `Hola ${empleadoNombre}, tu solicitud de ${tipoLabel.toLowerCase()} ha sido rechazada.${comment ? ` Motivo: ${comment}` : ' Sin comentario adicional.'}`;
    }

    await notifyEmpleado(existing.empleado.id, {
      tipo: 'SOLICITUD',
      titulo,
      mensaje,
      link: '06-05',
      entidad_tipo: 'SolicitudSelfService',
      entidad_id: id,
      prioridad: estado === 'APROBADA' ? 'MEDIA' : 'ALTA',
    });

    const resultWithRelations = await db.solicitudSelfService.findUnique({
      where: { id },
      include: {
        empleado: {
          select: {
            id: true,
            codigo_empleado: true,
            primer_nombre: true,
            primer_apellido: true,
          },
        },
        aprobada_por: { select: { nombre: true, apellido: true } },
      },
    });

    return NextResponse.json({ data: resultWithRelations, comentario: comment || null });
  } catch (error) {
    console.error('Error updating solicitud:', error);
    return NextResponse.json({ error: 'Error al actualizar solicitud' }, { status: 500 });
  }
}
