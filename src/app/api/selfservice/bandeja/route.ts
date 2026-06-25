import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// ============================================================
// GET /api/selfservice/bandeja
// Returns all solicitudes (paginated + filtered) for the RRHH/ADMIN
// inbox. Includes stats by estado and tipo.
// ============================================================
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const roleCheck = requireRoles('ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const estado = searchParams.get('estado') || '';
    const tipo = searchParams.get('tipo') || '';
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;

    // Text search by employee name or code
    if (q) {
      where.OR = [
        { empleado: { primer_nombre: { contains: q } } },
        { empleado: { primer_apellido: { contains: q } } },
        { empleado: { codigo_empleado: { contains: q } } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      db.solicitudSelfService.findMany({
        where,
        include: {
          empleado: {
            select: {
              id: true,
              codigo_empleado: true,
              primer_nombre: true,
              segundo_nombre: true,
              primer_apellido: true,
              segundo_apellido: true,
              email_personal: true,
              telefono: true,
              perfil_puesto: { select: { nombre_puesto: true } },
              area: { select: { nombre: true } },
            },
          },
          aprobada_por: { select: { nombre: true, apellido: true, email: true } },
        },
        orderBy: { fecha_solicitud: 'desc' },
        skip,
        take: pageSize,
      }),
      db.solicitudSelfService.count({ where }),
    ]);

    // ── Stats ─────────────────────────────────────────────────
    const statsWhere: Record<string, unknown> = {};
    if (tipo) statsWhere.tipo = tipo;

    const [
      totalAll,
      pendientes,
      aprobadas,
      rechazadas,
      canceladas,
      byTipoRows,
    ] = await Promise.all([
      db.solicitudSelfService.count({ where: statsWhere }),
      db.solicitudSelfService.count({ where: { ...statsWhere, estado: 'PENDIENTE' } }),
      db.solicitudSelfService.count({ where: { ...statsWhere, estado: 'APROBADA' } }),
      db.solicitudSelfService.count({ where: { ...statsWhere, estado: 'RECHAZADA' } }),
      db.solicitudSelfService.count({ where: { ...statsWhere, estado: 'CANCELADA' } }),
      db.solicitudSelfService.groupBy({ by: ['tipo'], where: statsWhere, _count: { _all: true } }),
    ]);

    const byTipo: Record<string, number> = {};
    byTipoRows.forEach((r) => { byTipo[r.tipo] = r._count._all; });

    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: {
        total: totalAll,
        pendientes,
        aprobadas,
        rechazadas,
        canceladas,
        byTipo,
      },
    });
  } catch (error) {
    console.error('Error in /api/selfservice/bandeja:', error);
    return NextResponse.json({ error: 'Error al obtener bandeja' }, { status: 500 });
  }
}
