import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No se encontró token de refresco' },
        { status: 401 }
      );
    }

    // Verify the refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token de refresco inválido o expirado' },
        { status: 401 }
      );
    }

    // Check if token is revoked in DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await db.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken || storedToken.revoked || new Date(storedToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token de refresco revocado o expirado' },
        { status: 401 }
      );
    }

    // Get user
    const usuario = await db.usuario.findUnique({
      where: { id: decoded.userId },
    });

    if (!usuario || usuario.estado !== 'ACTIVO') {
      return NextResponse.json(
        { error: 'Usuario no encontrado o inactivo' },
        { status: 401 }
      );
    }

    // Revoke old refresh token (rotation)
    await db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Generate new tokens
    const tokenPayload = {
      userId: usuario.id,
      email: usuario.email,
      rol: usuario.rol as 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO',
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      empleadoId: usuario.empleado_id ?? undefined,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken({ userId: usuario.id });

    // Store new refresh token
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await db.refreshToken.create({
      data: {
        usuario_id: usuario.id,
        token: newTokenHash,
        expires_at: getRefreshTokenExpiry(),
      },
    });

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
      accessToken: newAccessToken,
    });

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
