import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// ============================================================
// GET /api/nomina/planillas
// List planillas with filters
// ============================================================
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const tipo = searchParams.get('tipo');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;

    const planillas = await db.planilla.findMany({
      where,
      include: {
        calculada_por: { select: { nombre: true, apellido: true } },
        aprobada_por: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fecha_creacion: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.planilla.count({ where });

    // For EMPLEADO role, only return their own planilla details
    const result = planillas.map(p => ({
      id: p.id,
      codigo_planilla: p.codigo_planilla,
      tipo: p.tipo,
      estado: p.estado,
      fecha_inicio_periodo: p.fecha_inicio_periodo,
      fecha_fin_periodo: p.fecha_fin_periodo,
      total_empleados: p.total_empleados,
      total_salarios_brutos: p.total_salarios_brutos,
      total_neto_a_pagar: p.total_neto_a_pagar,
      total_cargas_patronales: p.total_cargas_patronales,
      calculada_por: p.calculada_por ? `${p.calculada_por.nombre} ${p.calculada_por.apellido}` : null,
      aprobada_por: p.aprobada_por ? `${p.aprobada_por.nombre} ${p.aprobada_por.apellido}` : null,
      fecha_calculo: p.fecha_calculo,
      fecha_aprobacion: p.fecha_aprobacion,
      observaciones: p.observaciones,
      fecha_creacion: p.fecha_creacion,
    }));

    return NextResponse.json({ planillas: result, total });
  } catch (error) {
    console.error('Error listing planillas:', error);
    return NextResponse.json({ error: 'Error al obtener planillas' }, { status: 500 });
  }
}
