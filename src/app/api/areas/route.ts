import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/areas - List areas
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const areas = await db.area.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    include: {
      _count: { select: { empleados: true, perfiles_puesto: true } },
    },
  });

  return NextResponse.json({ data: areas });
}
