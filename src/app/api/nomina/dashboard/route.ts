import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// ============================================================
// GET /api/nomina/dashboard
// Get KPIs for payroll dashboard
// ============================================================
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    // Total empleados activos
    const totalEmpleadosActivos = await db.empleado.count({
      where: { estado: 'ACTIVO' },
    });

    // Last month count for trend
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const empleadosLastMonth = await db.empleado.count({
      where: {
        estado: 'ACTIVO',
        fecha_creacion: { lt: lastMonth },
      },
    });

    const empleadoTrend = empleadosLastMonth > 0
      ? ((totalEmpleadosActivos - empleadosLastMonth) / empleadosLastMonth * 100).toFixed(1)
      : '0';

    // Current planilla in progress
    const planillaActual = await db.planilla.findFirst({
      where: { estado: { in: ['CALCULADA', 'EN_CORRECCION', 'BORRADOR'] } },
      orderBy: { fecha_creacion: 'desc' },
      include: {
        calculada_por: { select: { nombre: true, apellido: true } },
      },
    });

    // Total nómina del mes
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const planillasDelMes = await db.planilla.findMany({
      where: {
        estado: { in: ['APROBADA', 'PAGADA'] },
        fecha_inicio_periodo: { gte: startOfMonth },
        fecha_fin_periodo: { lte: endOfMonth },
      },
    });

    const totalNominaMes = planillasDelMes.reduce((sum, p) => sum + p.total_neto_a_pagar, 0);

    // Cumplimiento previsional
    // Check if ISSS, AFP, ISR have been filed for current period
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const isssPresentado = await db.historialPresentacionISSS.findFirst({
      where: { periodo_mes: currentMonth, periodo_anio: currentYear, estado: 'PRESENTADO' },
    });
    const afpPresentado = await db.historialPresentacionAFP.findFirst({
      where: { periodo_mes: currentMonth, periodo_anio: currentYear, estado: 'PRESENTADO' },
    });
    const isrEntero = await db.historialEnteroISR.findFirst({
      where: { periodo_mes: currentMonth, periodo_anio: currentYear, estado: 'ENTERADO' },
    });

    const cumplimientos = [
      { nombre: 'ISSS', presentado: !!isssPresentado, peso: 33 },
      { nombre: 'AFP', presentado: !!afpPresentado, peso: 33 },
      { nombre: 'ISR', presentado: !!isrEntero, peso: 34 },
    ];
    const cumplimientoTotal = cumplimientos.reduce((sum, c) => sum + (c.presentado ? c.peso : 0), 0);

    // Semaphore: green≥95%, yellow≥80%, red<80%
    const semaforo = cumplimientoTotal >= 95 ? 'verde' : cumplimientoTotal >= 80 ? 'amarillo' : 'rojo';

    // Próximos vencimientos (ISSS: day 15, AFP: day 20, ISR: day 10 next month)
    const vencimientos = [];
    const day15 = new Date(currentYear, currentMonth - 1, 15);
    const day20 = new Date(currentYear, currentMonth - 1, 20);
    const day10Next = new Date(currentYear, currentMonth, 10);

    if (!isssPresentado) {
      vencimientos.push({ nombre: 'ISSS', fecha: day15.toISOString().split('T')[0], estado: 'PENDIENTE' });
    }
    if (!afpPresentado) {
      vencimientos.push({ nombre: 'AFP', fecha: day20.toISOString().split('T')[0], estado: 'PENDIENTE' });
    }
    if (!isrEntero) {
      vencimientos.push({ nombre: 'ISR F-910', fecha: day10Next.toISOString().split('T')[0], estado: 'PENDIENTE' });
    }

    // Recent planillas (last 5)
    const planillasRecientes = await db.planilla.findMany({
      take: 5,
      orderBy: { fecha_creacion: 'desc' },
      include: {
        calculada_por: { select: { nombre: true, apellido: true } },
        aprobada_por: { select: { nombre: true, apellido: true } },
      },
    });

    // Monthly payroll trend (last 6 months)
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const mNombre = d.toLocaleString('es-SV', { month: 'short' });

      const pMes = await db.planilla.findMany({
        where: {
          estado: { in: ['APROBADA', 'PAGADA'] },
          fecha_inicio_periodo: { gte: mStart },
          fecha_fin_periodo: { lte: mEnd },
        },
      });
      const total = pMes.reduce((sum, p) => sum + p.total_salarios_brutos, 0);
      meses.push({ mes: mNombre, total: Math.round(total * 100) / 100 });
    }

    // Department cost distribution
    const empleadosConArea = await db.empleado.findMany({
      where: { estado: 'ACTIVO', area_id: { not: null } },
      include: {
        area: { select: { nombre: true } },
        contratos: { where: { activo: true }, take: 1 },
      },
    });

    const areaCosts = new Map<string, number>();
    for (const emp of empleadosConArea) {
      const areaNombre = emp.area?.nombre || 'Sin área';
      const salario = emp.contratos[0]?.salario_base_contrato || 0;
      areaCosts.set(areaNombre, (areaCosts.get(areaNombre) || 0) + salario);
    }

    const distribucionAreas = Array.from(areaCosts.entries())
      .map(([nombre, total]) => ({ nombre, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    // Alerts
    const alertas: Array<{ tipo: string; mensaje: string; severidad: string }> = [];

    // Pending approvals
    const planillasPendientes = await db.planilla.count({
      where: { estado: 'CALCULADA' },
    });
    if (planillasPendientes > 0) {
      alertas.push({ tipo: 'APROBACION', mensaje: `${planillasPendientes} planilla(s) pendiente(s) de aprobación`, severidad: 'ALTA' });
    }

    // Missing data
    const sinISSS = await db.empleado.count({ where: { estado: 'ACTIVO', numero_isss: null } });
    const sinAFP = await db.empleado.count({ where: { estado: 'ACTIVO', numero_afp: null } });
    if (sinISSS > 0) alertas.push({ tipo: 'DATOS', mensaje: `${sinISSS} empleado(s) sin número ISSS`, severidad: 'MEDIA' });
    if (sinAFP > 0) alertas.push({ tipo: 'DATOS', mensaje: `${sinAFP} empleado(s) sin número AFP`, severidad: 'MEDIA' });

    // Employees without contract
    const sinContrato = await db.empleado.count({
      where: {
        estado: 'ACTIVO',
        contratos: { none: { activo: true } },
      },
    });
    if (sinContrato > 0) alertas.push({ tipo: 'CONTRATO', mensaje: `${sinContrato} empleado(s) sin contrato activo`, severidad: 'ALTA' });

    return NextResponse.json({
      kpis: {
        total_empleados_activos: totalEmpleadosActivos,
        tendencia_empleados: `${empleadoTrend}%`,
        nomina_mes: Math.round(totalNominaMes * 100) / 100,
        cumplimiento_previsional: cumplimientoTotal,
        semaforo,
        planilla_actual: planillaActual ? {
          id: planillaActual.id,
          codigo: planillaActual.codigo_planilla,
          estado: planillaActual.estado,
          tipo: planillaActual.tipo,
          calculada_por: planillaActual.calculada_por ? `${planillaActual.calculada_por.nombre} ${planillaActual.calculada_por.apellido}` : null,
        } : null,
      },
      cumplimientos,
      vencimientos,
      planillas_recientes: planillasRecientes.map(p => ({
        id: p.id,
        codigo: p.codigo_planilla,
        tipo: p.tipo,
        estado: p.estado,
        total_neto: p.total_neto_a_pagar,
        total_bruto: p.total_salarios_brutos,
        empleados: p.total_empleados,
        calculada_por: p.calculada_por ? `${p.calculada_por.nombre} ${p.calculada_por.apellido}` : null,
        aprobada_por: p.aprobada_por ? `${p.aprobada_por.nombre} ${p.aprobada_por.apellido}` : null,
        fecha_creacion: p.fecha_creacion,
      })),
      tendencia_mensual: meses,
      distribucion_areas: distribucionAreas,
      alertas,
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    return NextResponse.json({ error: 'Error al obtener datos del dashboard' }, { status: 500 });
  }
}
