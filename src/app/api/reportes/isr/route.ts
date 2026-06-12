import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/reportes/isr - Generate ISR retentions report for a period
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1));
    const anio = parseInt(searchParams.get('anio') || String(new Date().getFullYear()));

    // Get active legal parameters with tramos
    const parametro = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      include: {
        tramos_isr: { orderBy: { numero_tramo: 'asc' } },
      },
    });

    if (!parametro) {
      return NextResponse.json({ error: 'No hay parámetros legales vigentes' }, { status: 404 });
    }

    // Get active employees
    const empleados = await db.empleado.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        perfil_puesto: true,
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
        enteros_isr: {
          where: { periodo_mes: mes, periodo_anio: anio },
        },
      },
    });

    // Calculate ISR for each employee
    const empleadosIsr = empleados.map((emp) => {
      const salarioBruto = emp.salario_base;
      const isssLaboral = Math.min(salarioBruto, parametro.tope_cotizacion_isss) * parametro.tasa_isss_laboral;
      const afpLaboral = salarioBruto * parametro.tasa_afp_laboral;
      const deducciones = isssLaboral + afpLaboral;
      const rentaImponible = Math.max(0, salarioBruto - deducciones);

      // Calculate ISR using tramos
      let isrRetenido = 0;
      for (const tramo of parametro.tramos_isr) {
        if (rentaImponible >= tramo.desde) {
          const limiteSuperior = tramo.hasta || Infinity;
          if (rentaImponible < limiteSuperior) {
            isrRetenido = (rentaImponible - tramo.desde) * tramo.porcentaje + tramo.cuota_fija;
            break;
          }
        }
      }

      // Use planilla detail if available
      const detalle = planilla?.detalles_planilla.find(
        (d) => d.empleado_id === emp.id
      );

      return {
        id: emp.id,
        nombre: `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.trim(),
        dui: emp.dui,
        salario_bruto: salarioBruto,
        isss_laboral: detalle?.isss_laboral || isssLaboral,
        afp_laboral: detalle?.afp_laboral || afpLaboral,
        deducciones: detalle?.isss_laboral && detalle?.afp_laboral
          ? detalle.isss_laboral + detalle.afp_laboral
          : deducciones,
        renta_imponible: detalle?.renta_imponible || rentaImponible,
        isr_retenido: detalle?.isr_retenido || isrRetenido,
        area: emp.area?.nombre,
        puesto: emp.perfil_puesto?.nombre_puesto,
      };
    });

    const totalSalarioBruto = empleadosIsr.reduce((s, e) => s + e.salario_bruto, 0);
    const totalDeducciones = empleadosIsr.reduce((s, e) => s + e.deducciones, 0);
    const totalRentaImponible = empleadosIsr.reduce((s, e) => s + e.renta_imponible, 0);
    const totalIsrRetenido = empleadosIsr.reduce((s, e) => s + e.isr_retenido, 0);

    const entero = planilla?.enteros_isr[0] || null;

    return NextResponse.json({
      periodo: { mes, anio },
      parametros: {
        tasa_isss_laboral: parametro.tasa_isss_laboral,
        tasa_afp_laboral: parametro.tasa_afp_laboral,
        tramos_isr: parametro.tramos_isr,
      },
      empleados: empleadosIsr,
      totales: {
        total_empleados: empleadosIsr.length,
        total_salario_bruto: totalSalarioBruto,
        total_deducciones: totalDeducciones,
        total_renta_imponible: totalRentaImponible,
        total_isr_retenido: totalIsrRetenido,
      },
      entero: entero ? {
        id: entero.id,
        estado: entero.estado,
        fecha_entero: entero.fecha_entero,
        formulario_f910: entero.formulario_f910,
        total_retenciones: entero.total_retenciones,
      } : null,
    });
  } catch (error) {
    console.error('Error generating ISR report:', error);
    return NextResponse.json({ error: 'Error al generar reporte ISR' }, { status: 500 });
  }
}
