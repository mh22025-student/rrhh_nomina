import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import { generateConstanciaIsrPdf } from '@/lib/pdf-constancia-isr';
import type { ConstanciaIsrData } from '@/lib/pdf-constancia-isr';

// ============================================================
// GET /api/reportes/isr/constancia?empleado_id=xxx&mes=xx&anio=xxxx
// Generate a PDF ISR Constancia (F-910) for an employee
// ============================================================
export async function GET(request: NextRequest) {
  // 1. Verify auth
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // RBAC: EMPLEADO can access own only
  const allowedRoles = ['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR'];
  if (!allowedRoles.includes(user.rol) && user.rol !== 'EMPLEADO') {
    return NextResponse.json({ error: 'No tiene permisos para realizar esta acción' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const empleadoId = searchParams.get('empleado_id');
    const mesStr = searchParams.get('mes');
    const anioStr = searchParams.get('anio');

    if (!empleadoId) {
      return NextResponse.json(
        { error: 'Parámetro empleado_id es requerido' },
        { status: 400 }
      );
    }

    // EMPLEADO can only access own constancia
    if (user.rol === 'EMPLEADO' && user.empleadoId && user.empleadoId !== empleadoId) {
      return NextResponse.json(
        { error: 'Solo puede generar su propia constancia' },
        { status: 403 }
      );
    }

    const mes = mesStr ? parseInt(mesStr) : new Date().getMonth() + 1;
    const anio = anioStr ? parseInt(anioStr) : new Date().getFullYear();

    // 2. Fetch employee data
    const empleado = await db.empleado.findUnique({
      where: { id: empleadoId },
      include: {
        area: { select: { nombre: true } },
        perfil_puesto: { select: { nombre_puesto: true } },
      },
    });

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // 3. Fetch active legal parameters with ISR tramos
    const parametro = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      include: {
        tramos_isr: { orderBy: { numero_tramo: 'asc' } },
      },
    });

    if (!parametro) {
      return NextResponse.json({ error: 'No hay parámetros legales vigentes' }, { status: 404 });
    }

    // 4. Calculate ISR
    const salarioBruto = empleado.salario_base;
    const isssLaboral = Math.min(salarioBruto, parametro.tope_cotizacion_isss) * parametro.tasa_isss_laboral;
    const afpLaboral = salarioBruto * parametro.tasa_afp_laboral;
    const totalDeducciones = isssLaboral + afpLaboral;
    const rentaImponible = Math.max(0, salarioBruto - totalDeducciones);

    // Use planilla detail if available for the period
    const planilla = await db.planilla.findFirst({
      where: {
        tipo: 'MENSUAL',
        estado: { in: ['APROBADA', 'PAGADA'] },
      },
      include: {
        detalles_planilla: {
          where: { empleado_id: empleadoId },
        },
      },
    });

    const detalle = planilla?.detalles_planilla[0];

    const isssFinal = detalle?.isss_laboral || isssLaboral;
    const afpFinal = detalle?.afp_laboral || afpLaboral;
    const deduccionesFinal = detalle?.isss_laboral && detalle?.afp_laboral
      ? detalle.isss_laboral + detalle.afp_laboral
      : totalDeducciones;
    const rentaImponibleFinal = detalle?.renta_imponible || rentaImponible;

    // Calculate ISR using tramos
    let isrRetenido = 0;
    let tramoAplicable = 1;
    for (const tramo of parametro.tramos_isr) {
      if (rentaImponibleFinal >= tramo.desde) {
        const limiteSuperior = tramo.hasta || Infinity;
        if (rentaImponibleFinal < limiteSuperior) {
          isrRetenido = (rentaImponibleFinal - tramo.desde) * tramo.porcentaje + tramo.cuota_fija;
          tramoAplicable = tramo.numero_tramo;
          break;
        }
      }
    }

    const isrFinal = detalle?.isr_retenido || isrRetenido;

    // 5. Calculate YTD summary
    const yearStart = new Date(anio, 0, 1);
    const periodEnd = new Date(anio, mes - 1, 1);
    const detallesYtd = await db.detallePlanilla.findMany({
      where: {
        empleado_id: empleadoId,
        planilla: {
          tipo: 'MENSUAL',
          estado: { in: ['APROBADA', 'PAGADA'] },
          fecha_inicio_periodo: { gte: yearStart, lt: periodEnd },
        },
      },
    });

    const totalIngresoYtd = detallesYtd.reduce((s, d) => s + d.salario_bruto, 0) + salarioBruto;
    const totalIsrYtd = detallesYtd.reduce((s, d) => s + d.isr_retenido, 0) + isrFinal;

    // 6. Build PDF data
    const constanciaData: ConstanciaIsrData = {
      empleado: {
        codigo_empleado: empleado.codigo_empleado,
        primer_nombre: empleado.primer_nombre,
        segundo_nombre: empleado.segundo_nombre,
        primer_apellido: empleado.primer_apellido,
        segundo_apellido: empleado.segundo_apellido,
        dui: empleado.dui,
        nit: empleado.nit,
        area: empleado.area,
        perfil_puesto: empleado.perfil_puesto,
      },
      periodo: { mes, anio },
      calculo: {
        salario_bruto: salarioBruto,
        isss_laboral: isssFinal,
        afp_laboral: afpFinal,
        total_deducciones: deduccionesFinal,
        renta_imponible: rentaImponibleFinal,
        isr_retenido: isrFinal,
        tramo_aplicable: tramoAplicable,
      },
      tramos: parametro.tramos_isr.map(t => ({
        numero_tramo: t.numero_tramo,
        desde: t.desde,
        hasta: t.hasta,
        porcentaje: t.porcentaje,
        cuota_fija: t.cuota_fija,
      })),
      resumen_anual: {
        total_ingreso_ytd: totalIngresoYtd,
        total_isr_ytd: totalIsrYtd,
      },
    };

    // 7. Generate PDF
    const pdfBuffer = await generateConstanciaIsrPdf(constanciaData);

    // 8. Return as downloadable PDF
    const filename = `constancia-isr-${empleado.codigo_empleado}-${mes}-${anio}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating ISR constancia PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar la constancia ISR' },
      { status: 500 }
    );
  }
}
