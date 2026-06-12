import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comparePassword, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import crypto from 'crypto';

const MAX_ATTEMPTS_PER_IP = 10;
const LOCKOUT_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Rate limiting: check attempts from this IP
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentAttempts = await db.intentoLogin.count({
      where: {
        ip_origen: clientIp,
        exitoso: false,
        created_at: { gte: oneMinuteAgo },
      },
    });

    if (recentAttempts >= MAX_ATTEMPTS_PER_IP) {
      // Log this attempt
      await db.intentoLogin.create({
        data: { email, ip_origen: clientIp, exitoso: false },
      });
      return NextResponse.json(
        { error: 'Demasiados intentos. Intente nuevamente en un minuto.' },
        { status: 429 }
      );
    }

    // Find user by email
    const usuario = await db.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Generic error message — never reveal if user exists
    const genericError = 'Credenciales inválidas. Verifique su email y contraseña.';

    if (!usuario) {
      await db.intentoLogin.create({
        data: { email, ip_origen: clientIp, exitoso: false },
      });
      return NextResponse.json({ error: genericError }, { status: 401 });
    }

    // Check account lockout
    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
      await db.intentoLogin.create({
        data: { email, ip_origen: clientIp, exitoso: false },
      });
      const remainingMin = Math.ceil(
        (new Date(usuario.bloqueado_hasta).getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        { error: `Cuenta bloqueada. Intente en ${remainingMin} minutos.` },
        { status: 423 }
      );
    }

    // If lockout period has expired, reset failed attempts
    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) <= new Date()) {
      await db.usuario.update({
        where: { id: usuario.id },
        data: { intentos_fallidos: 0, bloqueado_hasta: null },
      });
    }

    // Check if account is active
    if (usuario.estado !== 'ACTIVO') {
      await db.intentoLogin.create({
        data: { email, ip_origen: clientIp, exitoso: false },
      });
      return NextResponse.json({ error: genericError }, { status: 401 });
    }

    // Verify password
    const passwordValid = await comparePassword(password, usuario.password_hash);

    if (!passwordValid) {
      const newFailedAttempts = usuario.intentos_fallidos + 1;
      const updateData: Record<string, unknown> = {
        intentos_fallidos: newFailedAttempts,
      };

      // Lock account if threshold reached
      if (newFailedAttempts >= LOCKOUT_FAILED_ATTEMPTS) {
        const lockoutUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        updateData.bloqueado_hasta = lockoutUntil;
      }

      await db.usuario.update({
        where: { id: usuario.id },
        data: updateData,
      });

      await db.intentoLogin.create({
        data: { email, ip_origen: clientIp, exitoso: false },
      });

      return NextResponse.json({ error: genericError }, { status: 401 });
    }

    // Successful login — reset failed attempts and update last login
    await db.usuario.update({
      where: { id: usuario.id },
      data: {
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        ultimo_login: new Date(),
      },
    });

    // Log successful attempt
    await db.intentoLogin.create({
      data: { email, ip_origen: clientIp, exitoso: true },
    });

    // Generate tokens
    const tokenPayload = {
      userId: usuario.id,
      email: usuario.email,
      rol: usuario.rol as 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO',
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      empleadoId: usuario.empleado_id ?? undefined,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: usuario.id });

    // Store refresh token in DB
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await db.refreshToken.create({
      data: {
        usuario_id: usuario.id,
        token: refreshTokenHash,
        expires_at: getRefreshTokenExpiry(),
      },
    });

    // Set refresh token as HttpOnly cookie
    const response = NextResponse.json({
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        debe_cambiar_password: usuario.debe_cambiar_password,
        empleadoId: usuario.empleado_id,
      },
      accessToken,
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
