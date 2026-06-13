import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { otp_id, email, new_password } = body;

    if (!otp_id || !email || !new_password) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    if (new_password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Verify the OTP was used (verified) and belongs to this email
    const otpRecord = await db.otpToken.findFirst({
      where: {
        id: otp_id,
        email: email.toLowerCase().trim(),
        tipo: 'RECUPERACION',
        usado: true,
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Verificación inválida. Inicie el proceso nuevamente.' },
        { status: 400 }
      );
    }

    // Find user
    const usuario = await db.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(new_password);

    // Update user password
    await db.usuario.update({
      where: { id: usuario.id },
      data: {
        password_hash: passwordHash,
        debe_cambiar_password: false,
        intentos_fallidos: 0,
        bloqueado_hasta: null,
      },
    });

    // Revoke all refresh tokens for this user (force re-login)
    await db.refreshToken.updateMany({
      where: { usuario_id: usuario.id, revoked: false },
      data: { revoked: true },
    });

    return NextResponse.json({
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
