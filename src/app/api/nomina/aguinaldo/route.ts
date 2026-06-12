import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRoles } from '@/lib/auth-middleware';

// ============================================================
// POST /api/nomina/aguinaldo
// Calculate aguinaldo planilla (Arts. 196-202 CT)
// ============================================================
export async function POST(request: NextRequest) {
  const authCheck = requireRoles('ADMIN', 'ANALISTA')(request);
  if ('error' in authCheck) return authCheck.error;

  try {
    const body = await request.json();
    const { anio } = body as { anio: number };

    if (!anio) {
      return NextResponse.json({ error: 'Año es requerido' }, { status: 400 });
    }

    const fechaCorte = new Date(anio, 11, 12); // Dec 12 of the year

    // Get active employees
    const empleados = await db.empleado.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        contratos: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
      },
    });

    // Get current parametros_legales
    const parametros = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      orderBy: { fecha_vigencia_desde: 'desc' },
      include: { salarios_minimos: true },
    });

    if (!parametros) {
      return NextResponse.json({ error: 'No hay parámetros legales activos' }, { status: 400 });
    }

    const roundTwo = (n: number) => Math.round(n * 100) / 100;

    const resultados: Array<{
      empleado_id: string;
      codigo_empleado: string;
      nombre: string;
      fecha_ingreso: string;
      anios_servicio: number;
      dias_aguinaldo: number;
      salario_base: number;
      salario_diario: number;
      aguinaldo_bruto: number;
      exencion_isr: number;
      aguinaldo_gravado: number;
      isr_aguinaldo: number;
      aguinaldo_neto: number;
    }> = [];

    let totalAguinaldoBruto = 0;
    let totalAguinaldoNeto = 0;

    for (const emp of empleados) {
      if (emp.contratos.length === 0) continue;
      const contrato = emp.contratos[0];

      const fechaIngreso = new Date(emp.fecha_ingreso);
      const diffMs = fechaCorte.getTime() - fechaIngreso.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const aniosServicio = diffDays / 365.25;

      // Days of aguinaldo based on years of service
      let diasAguinaldo: number;
      if (aniosServicio < 1) {
        // Proportional
        diasAguinaldo = (diffDays / 360) * 15;
      } else if (aniosServicio < 3) {
        diasAguinaldo = 15;
      } else if (aniosServicio < 10) {
        diasAguinaldo = 19;
      } else {
        diasAguinaldo = 21;
      }

      const salarioBase = contrato.salario_base_contrato;
      const salarioDiario = salarioBase / 30;
      const aguinaldoBruto = salarioDiario * diasAguinaldo;

      // ISR exemption: up to 2 × salario mínimo del sector
      const salarioMinimo = parametros.salarios_minimos[0]?.salario_mensual || 365.00;
      const exencionISR = 2 * salarioMinimo;
      const aguinaldoGravado = Math.max(0, aguinaldoBruto - exencionISR);

      // Calculate ISR on aguinaldo (if gravado)
      let isrAguinaldo = 0;
      if (aguinaldoGravado > 0) {
        // Apply ISR table
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

      totalAguinaldoBruto += aguinaldoBruto;
      totalAguinaldoNeto += aguinaldoNeto;

      resultados.push({
        empleado_id: emp.id,
        codigo_empleado: emp.codigo_empleado,
        nombre: `${emp.primer_nombre} ${emp.primer_apellido}`,
        fecha_ingreso: emp.fecha_ingreso.toISOString().split('T')[0],
        anios_servicio: roundTwo(aniosServicio),
        dias_aguinaldo: roundTwo(diasAguinaldo),
        salario_base: roundTwo(salarioBase),
        salario_diario: roundTwo(salarioDiario),
        aguinaldo_bruto: roundTwo(aguinaldoBruto),
        exencion_isr: roundTwo(exencionISR),
        aguinaldo_gravado: roundTwo(aguinaldoGravado),
        isr_aguinaldo: roundTwo(isrAguinaldo),
        aguinaldo_neto: roundTwo(aguinaldoNeto),
      });
    }

    // Create aguinaldo planilla
    const planillasCount = await db.planilla.count();
    const codigoPlanilla = `AGU-${anio}-${String(planillasCount + 1).padStart(4, '0')}`;

    const planilla = await db.planilla.create({
      data: {
        codigo_planilla: codigoPlanilla,
        tipo: 'AGUINALDO',
        estado: 'CALCULADA',
        fecha_inicio_periodo: new Date(anio, 0, 1),
        fecha_fin_periodo: new Date(anio, 11, 31),
        total_empleados: resultados.length,
        total_salarios_brutos: roundTwo(totalAguinaldoBruto),
        total_neto_a_pagar: roundTwo(totalAguinaldoNeto),
        total_isr_retenido: roundTwo(totalAguinaldoBruto - totalAguinaldoNeto),
        calculada_por_id: authCheck.user.userId,
        fecha_calculo: new Date(),
      },
    });

    // Log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: authCheck.user.userId,
        usuario_email: authCheck.user.email,
        accion: 'CALCULO_AGUINALDO',
        tabla_afectada: 'planillas',
        registro_id: planilla.id,
        valor_nuevo: JSON.stringify({ anio, empleados: resultados.length, totalBruto: roundTwo(totalAguinaldoBruto) }),
        resultado: 'EXITOSO',
        nivel_criticidad: 'ALTO',
        detalle_adicional: `Aguinaldo ${anio}: ${resultados.length} empleados`,
      },
    });

    return NextResponse.json({
      planilla: {
        id: planilla.id,
        codigo_planilla: codigoPlanilla,
        tipo: 'AGUINALDO',
        estado: 'CALCULADA',
        total_empleados: resultados.length,
        total_aguinaldo_bruto: roundTwo(totalAguinaldoBruto),
        total_aguinaldo_neto: roundTwo(totalAguinaldoNeto),
      },
      resultados,
      parametros_utilizados: {
        exencion_isr: `2 × salario mínimo del sector = $${roundTwo(2 * (parametros.salarios_minimos[0]?.salario_mensual || 365.00))}`,
        salario_minimo_sector: parametros.salarios_minimos[0]?.salario_mensual || 365.00,
      },
    });
  } catch (error) {
    console.error('Error calculating aguinaldo:', error);
    return NextResponse.json({ error: 'Error al calcular aguinaldo' }, { status: 500 });
  }
}
