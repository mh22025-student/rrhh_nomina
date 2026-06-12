import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const MAX_OTP_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email y código OTP son requeridos' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find the most recent valid OTP for this email
    const otpRecord = await db.otpToken.findFirst({
      where: {
        email: normalizedEmail,
        tipo: 'RECUPERACION',
        usado: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Código inválido o expirado. Solicite uno nuevo.' },
        { status: 400 }
      );
    }

    // Check attempt count
    if (otpRecord.intentos >= MAX_OTP_ATTEMPTS) {
      await db.otpToken.update({
        where: { id: otpRecord.id },
        data: { usado: true },
      });
      return NextResponse.json(
        { error: 'Demasiados intentos. Solicite un nuevo código.' },
        { status: 400 }
      );
    }

    // Verify OTP hash
    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (inputHash !== otpRecord.token_hash) {
      await db.otpToken.update({
        where: { id: otpRecord.id },
        data: { intentos: otpRecord.intentos + 1 },
      });

      const remaining = MAX_OTP_ATTEMPTS - (otpRecord.intentos + 1);
      return NextResponse.json(
        { error: `Código incorrecto. ${remaining} intento(s) restante(s).` },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await db.otpToken.update({
      where: { id: otpRecord.id },
      data: { usado: true },
    });

    return NextResponse.json({
      message: 'Código verificado exitosamente',
      otp_id: otpRecord.id,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
