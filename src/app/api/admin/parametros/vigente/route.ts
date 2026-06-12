import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/admin/parametros/vigente - Get currently active parametro_legal
export async function GET(request: Request) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const parametro = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      include: {
        tramos_isr: { orderBy: { numero_tramo: 'asc' } },
        salarios_minimos: { orderBy: { sector: 'asc' } },
        creado_por: { select: { nombre: true, apellido: true } },
      },
    });

    if (!parametro) {
      return NextResponse.json({ error: 'No hay parámetro legal vigente' }, { status: 404 });
    }

    return NextResponse.json(parametro);
  } catch (error) {
    console.error('Error fetching parametro vigente:', error);
    return NextResponse.json({ error: 'Error al obtener parámetro vigente' }, { status: 500 });
  }
}
