import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { comparePassword, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Verify JWT token from Authorization header
    const user = verifyAuth(request);

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    // Validate new password minimum length
    if (new_password.length < 8) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Fetch user from database
    const usuario = await db.usuario.findUnique({
      where: { id: user.userId },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verify current password against bcrypt hash
    const isCurrentPasswordValid = await comparePassword(current_password, usuario.password_hash);

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'La contraseña actual es incorrecta' },
        { status: 400 }
      );
    }

    // Validate new password must be different from current
    const isSamePassword = await comparePassword(new_password, usuario.password_hash);

    if (isSamePassword) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe ser diferente a la actual' },
        { status: 400 }
      );
    }

    // Hash new password with bcrypt (factor 12)
    const newPasswordHash = await hashPassword(new_password);

    // Update password in database
    await db.usuario.update({
      where: { id: usuario.id },
      data: {
        password_hash: newPasswordHash,
        debe_cambiar_password: false,
      },
    });

    // Record action in audit log (bitácora_auditoria)
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: usuario.id,
        usuario_email: usuario.email,
        accion: 'CAMBIO_PASSWORD',
        tabla_afectada: 'usuario',
        registro_id: usuario.id,
        nivel_criticidad: 'ALTO',
        detalle_adicional: 'Cambio de contraseña exitoso',
      },
    });

    return NextResponse.json({
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
