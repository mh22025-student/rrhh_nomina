import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/reportes/talento - Talent management report
export async function GET(request: Request) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    // 1. Costo de Personal by department
    const areas = await db.area.findMany({
      where: { activo: true },
      include: {
        empleados: {
          where: { estado: 'ACTIVO' },
          select: { salario_base: true, genero: true },
        },
      },
    });

    const costoPorDepto = areas.map((area) => ({
      area_id: area.id,
      area_nombre: area.nombre,
      area_codigo: area.codigo,
      num_empleados: area.empleados.length,
      costo_total: area.empleados.reduce((s, e) => s + e.salario_base, 0),
      costo_promedio: area.empleados.length > 0
        ? area.empleados.reduce((s, e) => s + e.salario_base, 0) / area.empleados.length
        : 0,
    }));

    const totalEmpleados = costoPorDepto.reduce((s, d) => s + d.num_empleados, 0);
    const costoTotalGlobal = costoPorDepto.reduce((s, d) => s + d.costo_total, 0);
    const costoPromedioGlobal = totalEmpleados > 0 ? costoTotalGlobal / totalEmpleados : 0;

    // 2. Equidad Salarial (gender pay gap)
    const allActive = await db.empleado.findMany({
      where: { estado: 'ACTIVO' },
      select: {
        genero: true,
        salario_base: true,
        perfil_puesto: { select: { banda_salarial: { select: { nombre: true, grado: true } } } },
      },
    });

    const porGenero = {
      M: { count: 0, total_salario: 0 },
      F: { count: 0, total_salario: 0 },
      OTHER: { count: 0, total_salario: 0 },
    };

    allActive.forEach((e) => {
      const key = (e.genero === 'MASCULINO' ? 'M' : e.genero === 'FEMENINO' ? 'F' : 'OTHER') as 'M' | 'F' | 'OTHER';
      porGenero[key].count++;
      porGenero[key].total_salario += e.salario_base;
    });

    const promedioMasculino = porGenero.M.count > 0 ? porGenero.M.total_salario / porGenero.M.count : 0;
    const promedioFemenino = porGenero.F.count > 0 ? porGenero.F.total_salario / porGenero.F.count : 0;
    const brechaSalarial = promedioMasculino > 0 ? ((promedioMasculino - promedioFemenino) / promedioMasculino) * 100 : 0;

    // Distribution by band
    const distribucionBanda: Record<string, { M: number; F: number }> = {};
    allActive.forEach((e) => {
      const banda = e.perfil_puesto?.banda_salarial?.nombre || 'Sin banda';
      if (!distribucionBanda[banda]) distribucionBanda[banda] = { M: 0, F: 0 };
      const key = e.genero === 'MASCULINO' ? 'M' : e.genero === 'FEMENINO' ? 'F' : 'OTHER';
      if (key === 'M') distribucionBanda[banda].M++;
      else if (key === 'F') distribucionBanda[banda].F++;
    });

    // 3. Rotación de Personal
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const newHires = await db.empleado.count({
      where: {
        fecha_ingreso: { gte: startOfYear },
      },
    });

    const terminations = await db.empleado.count({
      where: {
        fecha_salida: { not: null, gte: startOfYear },
      },
    });

    const activeEmployees = await db.empleado.count({
      where: { estado: 'ACTIVO' },
    });

    const tasaRotacion = activeEmployees > 0
      ? ((newHires + terminations) / 2 / activeEmployees) * 100
      : 0;

    // 4. Pasivos Laborales
    const activeEmps = await db.empleado.findMany({
      where: { estado: 'ACTIVO' },
      select: {
        id: true,
        salario_base: true,
        fecha_ingreso: true,
        vacaciones: { where: { estado: 'ABIERTO' } },
      },
    });

    let reservaVacaciones = 0;
    let reservaAguinaldo = 0;
    let reservaIndemnizacion = 0;

    activeEmps.forEach((emp) => {
      const salarioDiario = emp.salario_base / 30;

      // Vacation reserve: pending days * daily salary
      const diasPendientes = emp.vacaciones.reduce((s, v) => s + v.dias_pendientes, 0);
      reservaVacaciones += diasPendientes * salarioDiario;

      // Aguinaldo reserve: proportional days based on months worked this year
      const mesesTrabajados = Math.min(12, Math.floor(
        (now.getTime() - Math.max(emp.fecha_ingreso.getTime(), startOfYear.getTime())) /
        (30 * 24 * 60 * 60 * 1000)
      ));
      const diasAguinaldo = Math.min(18, mesesTrabajados * 1.5);
      reservaAguinaldo += diasAguinaldo * salarioDiario;

      // Indemnization reserve: 1 month per year of service
      const anosServicio = (now.getTime() - emp.fecha_ingreso.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      reservaIndemnizacion += Math.floor(anosServicio) * emp.salario_base;
    });

    return NextResponse.json({
      costo_personal: {
        por_departamento: costoPorDepto,
        total_empleados: totalEmpleados,
        costo_total: costoTotalGlobal,
        costo_promedio: costoPromedioGlobal,
      },
      equidad_salarial: {
        por_genero: {
          masculino: { count: porGenero.M.count, promedio: promedioMasculino, total: porGenero.M.total_salario },
          femenino: { count: porGenero.F.count, promedio: promedioFemenino, total: porGenero.F.total_salario },
        },
        brecha_salarial_pct: brechaSalarial,
        distribucion_banda: distribucionBanda,
      },
      rotacion: {
        tasa_rotacion_pct: tasaRotacion,
        nuevas_contrataciones: newHires,
        terminaciones: terminations,
        empleados_activos: activeEmployees,
      },
      pasivos_laborales: {
        reserva_vacaciones: reservaVacaciones,
        reserva_aguinaldo: reservaAguinaldo,
        reserva_indemnizacion: reservaIndemnizacion,
        total_pasivos: reservaVacaciones + reservaAguinaldo + reservaIndemnizacion,
      },
    });
  } catch (error) {
    console.error('Error generating talent report:', error);
    return NextResponse.json({ error: 'Error al generar reporte de talento' }, { status: 500 });
  }
}
