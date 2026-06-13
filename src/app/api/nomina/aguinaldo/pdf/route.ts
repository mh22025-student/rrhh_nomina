import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import { generateAguinaldoPdf } from '@/lib/pdf-aguinaldo';
import type { AguinaldoData } from '@/lib/pdf-aguinaldo';

// ============================================================
// GET /api/nomina/aguinaldo/pdf?empleado_id=xxx&anio=xxx
// Generate a PDF Constancia de Aguinaldo for an employee
// ============================================================
export async function GET(request: NextRequest) {
  // 1. Verify auth — ADMIN, ANALISTA, APROBADOR, GERENCIA, AUDITOR
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const roleCheck = requireRoles('ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR')(request);
  if ('error' in roleCheck) return roleCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const empleadoId = searchParams.get('empleado_id');
    const anioStr = searchParams.get('anio');

    if (!empleadoId) {
      return NextResponse.json(
        { error: 'Parámetro empleado_id es requerido' },
        { status: 400 }
      );
    }

    const anio = anioStr ? parseInt(anioStr) : new Date().getFullYear();

    // 2. Fetch employee with contract
    const empleado = await db.empleado.findUnique({
      where: { id: empleadoId },
      include: {
        contratos: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
        area: { select: { nombre: true } },
        perfil_puesto: { select: { nombre_puesto: true } },
      },
    });

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    if (empleado.contratos.length === 0) {
      return NextResponse.json({ error: 'Empleado sin contrato activo' }, { status: 400 });
    }

    const contrato = empleado.contratos[0];
    const salarioBase = contrato.salario_base_contrato;
    const salarioDiario = salarioBase / 30;

    // 3. Calculate aguinaldo
    const fechaCorte = new Date(anio, 11, 12);
    const fechaIngreso = new Date(empleado.fecha_ingreso);
    const diffMs = fechaCorte.getTime() - fechaIngreso.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const aniosServicio = diffDays / 365.25;

    let diasAguinaldo: number;
    if (aniosServicio < 1) {
      diasAguinaldo = (diffDays / 360) * 15;
    } else if (aniosServicio < 3) {
      diasAguinaldo = 15;
    } else if (aniosServicio < 10) {
      diasAguinaldo = 19;
    } else {
      diasAguinaldo = 21;
    }

    const roundTwo = (n: number) => Math.round(n * 100) / 100;

    const aguinaldoBruto = salarioDiario * diasAguinaldo;

    // ISR exemption
    const parametros = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      orderBy: { fecha_vigencia_desde: 'desc' },
      include: { salarios_minimos: true },
    });

    const salarioMinimo = parametros?.salarios_minimos[0]?.salario_mensual || 365.00;
    const exencionISR = 2 * salarioMinimo;
    const aguinaldoGravado = Math.max(0, aguinaldoBruto - exencionISR);

    let isrAguinaldo = 0;
    if (aguinaldoGravado > 0 && parametros) {
      const tramos = await db.tramoISR.findMany({
        where: { parametro_legal_id: parametros.id },
        orderBy: { numero_tramo: 'asc' },
      });
      for (const tramo of tramos) {
        if (aguinaldoGravado >= tramo.desde) {
          const base = aguinaldoGravado - tramo.desde;
          isrAguinaldo = base * tramo.porcentaje + tramo.cuota_fija;
          if (!tramo.hasta || aguinaldoGravado <= tramo.hasta) break;
        }
      }
      isrAguinaldo = Math.max(0, isrAguinaldo);
    }

    const aguinaldoNeto = aguinaldoBruto - isrAguinaldo;

    // 4. Build PDF data
    const aguinaldoData: AguinaldoData = {
      empleado: {
        codigo_empleado: empleado.codigo_empleado,
        primer_nombre: empleado.primer_nombre,
        segundo_nombre: empleado.segundo_nombre,
        primer_apellido: empleado.primer_apellido,
        segundo_apellido: empleado.segundo_apellido,
        dui: empleado.dui,
        fecha_ingreso: empleado.fecha_ingreso,
        area: empleado.area,
        perfil_puesto: empleado.perfil_puesto,
      },
      calculo: {
        anio,
        salario_ordinario_mensual: roundTwo(salarioBase),
        salario_diario: roundTwo(salarioDiario),
        anios_servicio: roundTwo(aniosServicio),
        dias_aguinaldo: roundTwo(diasAguinaldo),
        aguinaldo_bruto: roundTwo(aguinaldoBruto),
        exencion_isr: roundTwo(exencionISR),
        aguinaldo_gravado: roundTwo(aguinaldoGravado),
        isr_aguinaldo: roundTwo(isrAguinaldo),
        aguinaldo_neto: roundTwo(aguinaldoNeto),
      },
    };

    // 5. Generate PDF
    const pdfBuffer = await generateAguinaldoPdf(aguinaldoData);

    // 6. Return as downloadable PDF
    const filename = `aguinaldo-${empleado.codigo_empleado}-${anio}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating aguinaldo PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar la constancia de aguinaldo' },
      { status: 500 }
    );
  }
}
