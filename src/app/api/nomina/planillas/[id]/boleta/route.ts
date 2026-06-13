import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import { generateBoletaPdf } from '@/lib/pdf-boleta';
import type { BoletaData } from '@/lib/pdf-boleta';

// ============================================================
// GET /api/nomina/planillas/[id]/boleta?empleado_id=xxx
// Generate a PDF pay stub for a single employee from a planilla
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify auth
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const empleadoId = searchParams.get('empleado_id');

    if (!empleadoId) {
      return NextResponse.json(
        { error: 'Parámetro empleado_id es requerido' },
        { status: 400 }
      );
    }

    // 2. Fetch planilla
    const planilla = await db.planilla.findUnique({
      where: { id },
      include: {
        detalles_planilla: {
          where: { empleado_id: empleadoId },
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
                area: { select: { nombre: true } },
                perfil_puesto: { select: { nombre_puesto: true } },
              },
            },
          },
        },
      },
    });

    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 });
    }

    // EMPLEADO role: can only request their own boleta
    if (user.rol === 'EMPLEADO' && user.empleadoId && user.empleadoId !== empleadoId) {
      return NextResponse.json({ error: 'Solo puede ver su propia boleta' }, { status: 403 });
    }

    const detalle = planilla.detalles_planilla[0];
    if (!detalle) {
      return NextResponse.json(
        { error: 'No se encontró detalle para este empleado en la planilla' },
        { status: 404 }
      );
    }

    // 3. Build the data for PDF generation
    const boletaData: BoletaData = {
      planilla: {
        codigo_planilla: planilla.codigo_planilla,
        tipo: planilla.tipo,
        fecha_inicio_periodo: planilla.fecha_inicio_periodo,
        fecha_fin_periodo: planilla.fecha_fin_periodo,
        total_cargas_patronales: planilla.total_cargas_patronales,
      },
      empleado: {
        codigo_empleado: detalle.empleado.codigo_empleado,
        primer_nombre: detalle.empleado.primer_nombre,
        segundo_nombre: detalle.empleado.segundo_nombre,
        primer_apellido: detalle.empleado.primer_apellido,
        segundo_apellido: detalle.empleado.segundo_apellido,
        dui: detalle.empleado.dui,
        area: detalle.empleado.area,
        perfil_puesto: detalle.empleado.perfil_puesto,
      },
      detalle: {
        salario_base: detalle.salario_base,
        total_horas_extra: detalle.total_horas_extra,
        total_bonos: detalle.total_bonos,
        total_comisiones: detalle.total_comisiones,
        salario_bruto: detalle.salario_bruto,
        isss_laboral: detalle.isss_laboral,
        afp_laboral: detalle.afp_laboral,
        isr_retenido: detalle.isr_retenido,
        total_descuentos: detalle.total_descuentos,
        salario_neto: detalle.salario_neto,
        isss_patronal: detalle.isss_patronal,
        afp_patronal: detalle.afp_patronal,
        cuota_alimenticia: detalle.cuota_alimenticia,
        prestamo_patronal: detalle.prestamo_patronal,
        seguro_complementario: detalle.seguro_complementario,
        otros_descuentos: detalle.otros_descuentos,
        observaciones: detalle.observaciones,
      },
    };

    // 4. Generate PDF
    const pdfBuffer = await generateBoletaPdf(boletaData);

    // 5. Return as downloadable PDF
    const filename = `boleta-${detalle.empleado.codigo_empleado}-${planilla.codigo_planilla}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating boleta PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar la boleta de pago' },
      { status: 500 }
    );
  }
}
