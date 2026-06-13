import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

function generateOtp(): string {
  // Generate a 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const usuario = await db.usuario.findUnique({
      where: { email: normalizedEmail },
    });

    // Always return success to avoid revealing if user exists
    if (!usuario) {
      return NextResponse.json({
        message: 'Si el email existe, se enviará un código de verificación',
        // Demo: indicate no user found so the UI can handle it
        demo_otp: null,
      });
    }

    // Invalidate any existing OTPs for this email
    await db.otpToken.updateMany({
      where: { email: normalizedEmail, usado: false },
      data: { usado: true },
    });

    // Generate new OTP
    const otp = generateOtp();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.otpToken.create({
      data: {
        usuario_id: usuario.id,
        email: normalizedEmail,
        token_hash: otpHash,
        tipo: 'RECUPERACION',
        expires_at: expiresAt,
      },
    });

    return NextResponse.json({
      message: 'Si el email existe, se enviará un código de verificación',
      // For demo purposes only — return the OTP so it can be tested
      demo_otp: otp,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
