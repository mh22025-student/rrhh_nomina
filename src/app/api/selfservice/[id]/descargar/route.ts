import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import { generateConstanciaEmpleoPdf } from '@/lib/pdf-constancia-empleo';
import type { ConstanciaEmpleoData } from '@/lib/pdf-constancia-empleo';
import { generateConstanciaIsrPdf } from '@/lib/pdf-constancia-isr';
import type { ConstanciaIsrData } from '@/lib/pdf-constancia-isr';

// ============================================================
// GET /api/selfservice/[id]/descargar
// Regenerates and downloads the PDF for an approved CONSTANCIA_* solicitud.
// Allowed for: ADMIN, ANALISTA, APROBADOR, GERENCIA, AUDITOR (any solicitud)
// and EMPLEADO (only own solicitudes).
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Fetch the solicitud with all the data needed for PDF generation
    const solicitud = await db.solicitudSelfService.findUnique({
      where: { id },
      include: {
        empleado: {
          select: {
            id: true,
            codigo_empleado: true,
            primer_nombre: true,
            segundo_nombre: true,
            primer_apellido: true,
            segundo_apellido: true,
            dui: true,
            nit: true,
            fecha_ingreso: true,
            salario_base: true,
            estado: true,
            area: { select: { nombre: true } },
            perfil_puesto: { select: { nombre_puesto: true } },
            contratos: {
              where: { activo: true },
              orderBy: { fecha_inicio: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // RBAC: EMPLEADO can only download own solicitudes
    if (user.rol === 'EMPLEADO' && user.empleadoId && user.empleadoId !== solicitud.empleado.id) {
      return NextResponse.json(
        { error: 'Solo puede descargar documentos de sus propias solicitudes' },
        { status: 403 }
      );
    }

    // Only CONSTANCIA_* solicitudes can be downloaded, and only if APROBADA
    const tiposConstancia = ['CONSTANCIA_EMPLEO', 'CONSTANCIA_SALARIAL', 'CONSTANCIA_ISR'];
    if (!tiposConstancia.includes(solicitud.tipo)) {
      return NextResponse.json(
        { error: 'Este tipo de solicitud no genera un documento descargable' },
        { status: 400 }
      );
    }

    if (solicitud.estado !== 'APROBADA') {
      return NextResponse.json(
        { error: 'El documento solo está disponible después de que la solicitud sea aprobada' },
        { status: 400 }
      );
    }

    const emp = solicitud.empleado;

    // ── Generate PDF based on tipo ──
    if (solicitud.tipo === 'CONSTANCIA_EMPLEO' || solicitud.tipo === 'CONSTANCIA_SALARIAL') {
      const isSalario = solicitud.tipo === 'CONSTANCIA_SALARIAL';

      const constanciaData: ConstanciaEmpleoData = {
        empleado: {
          codigo_empleado: emp.codigo_empleado,
          primer_nombre: emp.primer_nombre,
          segundo_nombre: emp.segundo_nombre,
          primer_apellido: emp.primer_apellido,
          segundo_apellido: emp.segundo_apellido,
          dui: emp.dui,
          fecha_ingreso: emp.fecha_ingreso,
          salario_base: emp.salario_base,
          estado: emp.estado,
          area: emp.area,
          perfil_puesto: emp.perfil_puesto,
        },
        contrato: emp.contratos[0] || null,
        tipo: isSalario ? 'salario' : 'empleo',
        incluir_salario: isSalario,
      };

      const pdfBuffer = await generateConstanciaEmpleoPdf(constanciaData);
      const tipoLabel = isSalario ? 'salarial' : 'empleo';
      const filename = `constancia-${tipoLabel}-${emp.codigo_empleado}.pdf`;

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    // CONSTANCIA_ISR — use current period (or parse from detalle if present)
    let mes = new Date().getMonth() + 1;
    let anio = new Date().getFullYear();
    if (solicitud.detalle) {
      try {
        const parsed = JSON.parse(solicitud.detalle);
        if (parsed.mes && Number.isInteger(parsed.mes)) mes = parsed.mes;
        if (parsed.anio && Number.isInteger(parsed.anio)) anio = parsed.anio;
      } catch {
        // detalle is plain text, ignore
      }
    }

    // Fetch active legal parameters with ISR tramos
    const parametro = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      include: { tramos_isr: { orderBy: { numero_tramo: 'asc' } } },
    });

    if (!parametro) {
      return NextResponse.json(
        { error: 'No hay parámetros legales vigentes' },
        { status: 404 }
      );
    }

    // Calculate ISR
    const salarioBruto = emp.salario_base;
    const isssLaboral =
      Math.min(salarioBruto, parametro.tope_cotizacion_isss) * parametro.tasa_isss_laboral;
    const afpLaboral = salarioBruto * parametro.tasa_afp_laboral;
    const totalDeducciones = isssLaboral + afpLaboral;
    const rentaImponible = Math.max(0, salarioBruto - totalDeducciones);

    // Try to use actual planilla detail for the period
    const planilla = await db.planilla.findFirst({
      where: {
        tipo: 'MENSUAL',
        estado: { in: ['APROBADA', 'PAGADA'] },
      },
      include: { detalles_planilla: { where: { empleado_id: emp.id } } },
    });

    const detalle = planilla?.detalles_planilla[0];
    const isssFinal = detalle?.isss_laboral || isssLaboral;
    const afpFinal = detalle?.afp_laboral || afpLaboral;
    const deduccionesFinal =
      detalle?.isss_laboral && detalle?.afp_laboral
        ? detalle.isss_laboral + detalle.afp_laboral
        : totalDeducciones;
    const rentaImponibleFinal = detalle?.renta_imponible || rentaImponible;

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

    // YTD summary
    const yearStart = new Date(anio, 0, 1);
    const periodEnd = new Date(anio, mes - 1, 1);
    const detallesYtd = await db.detallePlanilla.findMany({
      where: {
        empleado_id: emp.id,
        planilla: {
          tipo: 'MENSUAL',
          estado: { in: ['APROBADA', 'PAGADA'] },
          fecha_inicio_periodo: { gte: yearStart, lt: periodEnd },
        },
      },
    });

    const totalIngresoYtd = detallesYtd.reduce((s, d) => s + d.salario_bruto, 0) + salarioBruto;
    const totalIsrYtd = detallesYtd.reduce((s, d) => s + d.isr_retenido, 0) + isrFinal;

    const constanciaIsrData: ConstanciaIsrData = {
      empleado: {
        codigo_empleado: emp.codigo_empleado,
        primer_nombre: emp.primer_nombre,
        segundo_nombre: emp.segundo_nombre,
        primer_apellido: emp.primer_apellido,
        segundo_apellido: emp.segundo_apellido,
        dui: emp.dui,
        nit: emp.nit,
        area: emp.area,
        perfil_puesto: emp.perfil_puesto,
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
      tramos: parametro.tramos_isr.map((t) => ({
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

    const pdfBuffer = await generateConstanciaIsrPdf(constanciaIsrData);
    const filename = `constancia-isr-${emp.codigo_empleado}-${mes}-${anio}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating constancia PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar el documento PDF' },
      { status: 500 }
    );
  }
}
