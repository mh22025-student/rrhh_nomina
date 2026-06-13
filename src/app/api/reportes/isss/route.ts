import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/reportes/isss - Generate ISSS report data for a period
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1));
    const anio = parseInt(searchParams.get('anio') || String(new Date().getFullYear()));

    // Get active legal parameters
    const parametro = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
    });

    if (!parametro) {
      return NextResponse.json({ error: 'No hay parámetros legales vigentes' }, { status: 404 });
    }

    const tasaLaboral = parametro.tasa_isss_laboral;
    const tasaPatronal = parametro.tasa_isss_patronal;
    const topeIsss = parametro.tope_cotizacion_isss;

    // Get active employees with ISSS number
    const empleados = await db.empleado.findMany({
      where: {
        estado: 'ACTIVO',
        numero_isss: { not: null },
      },
      include: {
        perfil_puesto: { include: { banda_salarial: true } },
        area: { select: { nombre: true } },
      },
      orderBy: { primer_apellido: 'asc' },
    });

    // Find planilla for this period
    const planilla = await db.planilla.findFirst({
      where: {
        tipo: 'MENSUAL',
        estado: { in: ['APROBADA', 'PAGADA'] },
      },
      include: {
        detalles_planilla: true,
        presentaciones_isss: {
          where: { periodo_mes: mes, periodo_anio: anio },
        },
      },
    });

    // Build employee ISSS data
    const empleadosIsss = empleados.map((emp) => {
      const salarioBase = emp.salario_base;
      const salarioCotizable = Math.min(salarioBase, topeIsss);
      const cotizacionLaboral = salarioCotizable * tasaLaboral;
      const cotizacionPatronal = salarioCotizable * tasaPatronal;

      // Get detail from planilla if available
      const detalle = planilla?.detalles_planilla.find(
        (d) => d.empleado_id === emp.id
      );

      return {
        id: emp.id,
        nombre: `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.trim(),
        numero_isss: emp.numero_isss,
        dui: emp.dui,
        salario_cotizable: salarioCotizable,
        cotizacion_laboral: detalle?.isss_laboral || cotizacionLaboral,
        cotizacion_patronal: detalle?.isss_patronal || cotizacionPatronal,
        area: emp.area?.nombre,
        puesto: emp.perfil_puesto?.nombre_puesto,
      };
    });

    const totalCotLab = empleadosIsss.reduce((sum, e) => sum + e.cotizacion_laboral, 0);
    const totalCotPat = empleadosIsss.reduce((sum, e) => sum + e.cotizacion_patronal, 0);
    const totalSalario = empleadosIsss.reduce((sum, e) => sum + e.salario_cotizable, 0);

    // Submission tracking
    const presentacion = planilla?.presentaciones_isss[0] || null;

    return NextResponse.json({
      periodo: { mes, anio },
      parametros: {
        tasa_isss_laboral: tasaLaboral,
        tasa_isss_patronal: tasaPatronal,
        tope_cotizacion_isss: topeIsss,
      },
      empleados: empleadosIsss,
      totales: {
        total_empleados: empleadosIsss.length,
        total_salario_cotizable: totalSalario,
        total_cotizacion_laboral: totalCotLab,
        total_cotizacion_patronal: totalCotPat,
        total_general: totalCotLab + totalCotPat,
      },
      presentacion: presentacion ? {
        id: presentacion.id,
        estado: presentacion.estado,
        fecha_presentacion: presentacion.fecha_presentacion,
        archivo_ois: presentacion.archivo_ois,
      } : null,
    });
  } catch (error) {
    console.error('Error generating ISSS report:', error);
    return NextResponse.json({ error: 'Error al generar reporte ISSS' }, { status: 500 });
  }
}
