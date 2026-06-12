import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// PUT /api/usuarios/[id] - Update user role, estado (ADMIN only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = requireRoles('ADMIN' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user: adminUser } = roleCheck;
  const { id } = await params;

  try {
    const body = await request.json();

    const existing = await db.usuario.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.rol) {
      const validRoles = ['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR', 'EMPLEADO'];
      if (!validRoles.includes(body.rol)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
      }
      updateData.rol = body.rol;
    }

    if (body.estado) {
      const validEstados = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
      if (!validEstados.includes(body.estado)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
      }
      updateData.estado = body.estado;
    }

    if (body.reset_password) {
      if (!body.new_password || body.new_password.length < 8) {
        return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 });
      }
      updateData.password_hash = await hashPassword(body.new_password);
      updateData.debe_cambiar_password = true;
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.usuario.update({
        where: { id },
        data: updateData,
        select: {
          id: true, email: true, nombre: true, apellido: true,
          rol: true, estado: true, debe_cambiar_password: true,
          ultimo_login: true, fecha_creacion: true,
          empleado: { select: { codigo_empleado: true, primer_nombre: true, primer_apellido: true } },
        },
      });

      await tx.bitacoraAuditoria.create({
        data: {
          usuario_id: adminUser.userId,
          usuario_email: adminUser.email,
          accion: 'ACTUALIZAR_USUARIO',
          tabla_afectada: 'usuarios',
          registro_id: id,
          valor_anterior: JSON.stringify({ rol: existing.rol, estado: existing.estado }),
          valor_nuevo: JSON.stringify(updateData),
          nivel_criticidad: 'ALTO',
        },
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

// DELETE /api/usuarios/[id] - Deactivate user (ADMIN only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = requireRoles('ADMIN' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user: adminUser } = roleCheck;
  const { id } = await params;

  try {
    const existing = await db.usuario.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (existing.id === adminUser.userId) {
      return NextResponse.json({ error: 'No puede desactivar su propia cuenta' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.usuario.update({
        where: { id },
        data: { estado: 'INACTIVO' },
      });

      // Revoke all refresh tokens
      await tx.refreshToken.updateMany({
        where: { usuario_id: id, revoked: false },
        data: { revoked: true },
      });

      await tx.bitacoraAuditoria.create({
        data: {
          usuario_id: adminUser.userId,
          usuario_email: adminUser.email,
          accion: 'DESACTIVAR_USUARIO',
          tabla_afectada: 'usuarios',
          registro_id: id,
          valor_anterior: JSON.stringify({ estado: existing.estado }),
          valor_nuevo: JSON.stringify({ estado: 'INACTIVO' }),
          nivel_criticidad: 'ALTO',
          detalle_adicional: `Usuario ${existing.email} desactivado`,
        },
      });

      return updated;
    });

    return NextResponse.json({ data: { id: result.id, estado: result.estado } });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json({ error: 'Error al desactivar usuario' }, { status: 500 });
  }
}
