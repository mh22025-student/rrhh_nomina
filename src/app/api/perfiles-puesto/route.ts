import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/perfiles-puesto - List perfiles de puesto
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const areaId = searchParams.get('area_id') || '';

  const where: Record<string, unknown> = { estado: { in: ['VIGENTE', 'APROBADO'] } };
  if (areaId) where.area_id = areaId;

  const perfiles = await db.perfilPuesto.findMany({
    where,
    orderBy: { nombre_puesto: 'asc' },
    include: {
      area: { select: { id: true, nombre: true } },
      banda_salarial: { select: { nombre: true, salario_minimo: true, salario_maximo: true } },
    },
  });

  return NextResponse.json({ data: perfiles });
}
