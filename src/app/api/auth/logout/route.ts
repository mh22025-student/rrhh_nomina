import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (refreshToken) {
      // Revoke the refresh token in DB
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.refreshToken.updateMany({
        where: { token: tokenHash, revoked: false },
        data: { revoked: true },
      });
    }

    const response = NextResponse.json({ message: 'Sesión cerrada exitosamente' });

    // Clear the refresh token cookie
    response.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
