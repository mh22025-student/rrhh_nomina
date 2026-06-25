import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/admin/bitacora - List audit log entries with filters (READ-ONLY)
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const usuario = searchParams.get('usuario') || '';
    const accion = searchParams.get('accion') || '';
    const tabla = searchParams.get('tabla') || '';
    const registroId = searchParams.get('registro_id') || '';
    const fechaDesde = searchParams.get('fecha_desde') || '';
    const fechaHasta = searchParams.get('fecha_hasta') || '';
    const nivelCriticidad = searchParams.get('nivel_criticidad') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const exportCsv = searchParams.get('export') === 'csv';

    const where: Record<string, unknown> = {};

    if (usuario) {
      where.OR = [
        { usuario_email: { contains: usuario } },
        { usuario_id: usuario },
      ];
    }
    if (accion) where.accion = accion;
    if (tabla) where.tabla_afectada = tabla;
    if (registroId) where.registro_id = registroId;
    if (fechaDesde || fechaHasta) {
      where.fecha_accion = {};
      if (fechaDesde) (where.fecha_accion as Record<string, unknown>).gte = new Date(fechaDesde);
      if (fechaHasta) (where.fecha_accion as Record<string, unknown>).lte = new Date(fechaHasta + 'T23:59:59');
    }
    if (nivelCriticidad) where.nivel_criticidad = nivelCriticidad;

    const [entries, total] = await Promise.all([
      db.bitacoraAuditoria.findMany({
        where,
        include: {
          usuario: { select: { nombre: true, apellido: true, email: true } },
        },
        orderBy: { fecha_accion: 'desc' },
        ...(exportCsv ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      db.bitacoraAuditoria.count({ where }),
    ]);

    // CSV export
    if (exportCsv) {
      const headers = ['Fecha/Hora', 'Usuario', 'Email', 'Acción', 'Tabla', 'Registro ID', 'Criticidad', 'Detalle'];
      const rows = entries.map((e) => [
        new Date(e.fecha_accion).toISOString(),
        e.usuario?.nombre ? `${e.usuario.nombre} ${e.usuario.apellido}` : (e.usuario_email || ''),
        e.usuario?.email || '',
        e.accion,
        e.tabla_afectada || '',
        e.registro_id || '',
        e.nivel_criticidad,
        e.detalle_adicional || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=bitacora_${new Date().toISOString().slice(0, 10)}.csv`,
        },
      });
    }

    return NextResponse.json({
      entries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching bitacora:', error);
    return NextResponse.json({ error: 'Error al obtener bitácora' }, { status: 500 });
  }
}
