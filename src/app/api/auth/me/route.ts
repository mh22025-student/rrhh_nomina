import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = verifyAuth(request);

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Fetch fresh user data from DB
    const usuario = await db.usuario.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        estado: true,
        debe_cambiar_password: true,
        ultimo_login: true,
        empleado_id: true,
      },
    });

    if (!usuario || usuario.estado !== 'ACTIVO') {
      return NextResponse.json(
        { error: 'Usuario no encontrado o inactivo' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        debe_cambiar_password: usuario.debe_cambiar_password,
        ultimoLogin: usuario.ultimo_login,
        empleadoId: usuario.empleado_id,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
