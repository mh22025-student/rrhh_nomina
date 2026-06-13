import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/admin/parametros/[id] - Get single parametro with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const parametro = await db.parametroLegal.findUnique({
      where: { id },
      include: {
        tramos_isr: { orderBy: { numero_tramo: 'asc' } },
        salarios_minimos: { orderBy: { sector: 'asc' } },
        creado_por: { select: { nombre: true, apellido: true, email: true } },
      },
    });

    if (!parametro) {
      return NextResponse.json({ error: 'Parámetro no encontrado' }, { status: 404 });
    }

    return NextResponse.json(parametro);
  } catch (error) {
    console.error('Error fetching parametro:', error);
    return NextResponse.json({ error: 'Error al obtener parámetro' }, { status: 500 });
  }
}
