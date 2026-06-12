import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRoles, verifyAuth } from '@/lib/auth-middleware';

// ============================================================
// GET /api/nomina/liquidaciones
// List liquidaciones
// ============================================================
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const liquidaciones = await db.liquidacion.findMany({
      include: {
        empleado: {
          select: {
            codigo_empleado: true,
            primer_nombre: true,
            primer_apellido: true,
          },
        },
        aprobada_por: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fecha_creacion: 'desc' },
    });

    const result = liquidaciones.map(l => ({
      id: l.id,
      empleado_id: l.empleado_id,
      empleado_codigo: l.empleado.codigo_empleado,
      empleado_nombre: `${l.empleado.primer_nombre} ${l.empleado.primer_apellido}`,
      tipo: l.tipo,
      fecha_liquidacion: l.fecha_liquidacion,
      salario_base_liquidacion: l.salario_base_liquidacion,
      anios_servicio: l.anios_servicio,
      indemnizacion: l.indemnizacion,
      prestacion_economica: l.prestacion_economica,
      vacacion_proporcional: l.vacacion_proporcional,
      aguinaldo_proporcional: l.aguinaldo_proporcional,
      salario_pendiente: l.salario_pendiente,
      total_liquidacion: l.total_liquidacion,
      estado: l.estado,
      aprobada_por: l.aprobada_por ? `${l.aprobada_por.nombre} ${l.aprobada_por.apellido}` : null,
      observaciones: l.observaciones,
    }));

    return NextResponse.json({ liquidaciones: result });
  } catch (error) {
    console.error('Error listing liquidaciones:', error);
    return NextResponse.json({ error: 'Error al obtener liquidaciones' }, { status: 500 });
  }
}

// ============================================================
// POST /api/nomina/liquidaciones
// Calculate liquidación (Art. 58 CT, Ley 523)
// ============================================================
export async function POST(request: NextRequest) {
  const authCheck = requireRoles('ADMIN', 'ANALISTA')(request);
  if ('error' in authCheck) return authCheck.error;

  try {
    const body = await request.json();
    const { empleado_id, tipo, fecha_liquidacion } = body as {
      empleado_id: string;
      tipo: 'DESPIDO_INJUSTIFICADO' | 'RENUNCIA_VOLUNTARIA' | 'DESPIDO_JUSTIFICADO' | 'FIN_CONTRATO';
      fecha_liquidacion: string;
    };

    if (!empleado_id || !tipo || !fecha_liquidacion) {
      return NextResponse.json({ error: 'empleado_id, tipo y fecha_liquidacion son requeridos' }, { status: 400 });
    }

    const empleado = await db.empleado.findUnique({
      where: { id: empleado_id },
      include: {
        contratos: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
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

    // Calculate years of service
    const fechaIngreso = new Date(empleado.fecha_ingreso);
    const fechaLiq = new Date(fecha_liquidacion);
    const diffMs = fechaLiq.getTime() - fechaIngreso.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const aniosServicio = diffDays / 365.25;
    const mesesServicio = diffDays / 30.44;

    const roundTwo = (n: number) => Math.round(n * 100) / 100;

    let indemnizacion = 0;
    let prestacionEconomica = 0;
    let vacacionProporcional = 0;
    let aguinaldoProporcional = 0;
    let salarioPendiente = 0;

    // Get parametros for aguinaldo days calculation
    let diasAguinaldo = 15;
    if (aniosServicio >= 3) diasAguinaldo = 19;
    if (aniosServicio >= 10) diasAguinaldo = 21;

    if (tipo === 'DESPIDO_INJUSTIFICADO') {
      // Art. 58 CT: Indemnización = 30 días/año × años servicio (max 4 años salario)
      indemnizacion = salarioDiario * 30 * Math.min(aniosServicio, 4);
      indemnizacion = Math.min(indemnizacion, salarioBase * 4); // cap at 4 years salary

      // Vacación proporcional
      vacacionProporcional = (15 / 12) * mesesServicio * salarioDiario;

      // Aguinaldo proporcional
      aguinaldoProporcional = (diasAguinaldo / 360) * diffDays * salarioDiario;

      // Salario pendiente (prorrateado for current month)
      const dayOfMonth = fechaLiq.getDate();
      salarioPendiente = salarioDiario * dayOfMonth;
    } else if (tipo === 'RENUNCIA_VOLUNTARIA') {
      // Ley 523: Prestación económica = 15 días/año × años servicio
      prestacionEconomica = salarioDiario * 15 * Math.min(aniosServicio, 4);

      // Vacación proporcional
      vacacionProporcional = (15 / 12) * mesesServicio * salarioDiario;

      // Aguinaldo proporcional
      aguinaldoProporcional = (diasAguinaldo / 360) * diffDays * salarioDiario;

      // Salario pendiente
      const dayOfMonth = fechaLiq.getDate();
      salarioPendiente = salarioDiario * dayOfMonth;
    } else if (tipo === 'FIN_CONTRATO') {
      // No indemnización, but yes vacación and aguinaldo
      vacacionProporcional = (15 / 12) * mesesServicio * salarioDiario;
      aguinaldoProporcional = (diasAguinaldo / 360) * diffDays * salarioDiario;
      salarioPendiente = salarioDiario * fechaLiq.getDate();
    } else {
      // DESPEDIDO_JUSTIFICADO: Only vacación and aguinaldo
      vacacionProporcional = (15 / 12) * mesesServicio * salarioDiario;
      aguinaldoProporcional = (diasAguinaldo / 360) * diffDays * salarioDiario;
      salarioPendiente = salarioDiario * fechaLiq.getDate();
    }

    const totalLiquidacion = indemnizacion + prestacionEconomica + vacacionProporcional + aguinaldoProporcional + salarioPendiente;

    // Create liquidacion record
    const liquidacion = await db.liquidacion.create({
      data: {
        empleado_id,
        tipo,
        fecha_liquidacion: fechaLiq,
        salario_base_liquidacion: roundTwo(salarioBase),
        anios_servicio: roundTwo(aniosServicio),
        indemnizacion: roundTwo(indemnizacion),
        prestacion_economica: roundTwo(prestacionEconomica),
        vacacion_proporcional: roundTwo(vacacionProporcional),
        aguinaldo_proporcional: roundTwo(aguinaldoProporcional),
        salario_pendiente: roundTwo(salarioPendiente),
        total_liquidacion: roundTwo(totalLiquidacion),
        estado: 'CALCULADA',
      },
    });

    // Log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: authCheck.user.userId,
        usuario_email: authCheck.user.email,
        accion: 'CALCULO_LIQUIDACION',
        tabla_afectada: 'liquidaciones',
        registro_id: liquidacion.id,
        valor_nuevo: JSON.stringify({ tipo, total: roundTwo(totalLiquidacion) }),
        resultado: 'EXITOSO',
        nivel_criticidad: 'ALTO',
        detalle_adicional: `Empleado ${empleado.codigo_empleado}, tipo: ${tipo}`,
      },
    });

    return NextResponse.json({
      liquidacion: {
        id: liquidacion.id,
        tipo,
        fecha_liquidacion,
        salario_base: roundTwo(salarioBase),
        anios_servicio: roundTwo(aniosServicio),
        indemnizacion: roundTwo(indemnizacion),
        prestacion_economica: roundTwo(prestacionEconomica),
        vacacion_proporcional: roundTwo(vacacionProporcional),
        aguinaldo_proporcional: roundTwo(aguinaldoProporcional),
        salario_pendiente: roundTwo(salarioPendiente),
        total_liquidacion: roundTwo(totalLiquidacion),
        estado: 'CALCULADA',
      },
      desglose: {
        indemnizacion: {
          monto: roundTwo(indemnizacion),
          base_legal: tipo === 'DESPIDO_INJUSTIFICADO' ? 'Art. 58 CT - 30 días/año, máximo 4 años' : 'N/A',
          formula: tipo === 'DESPIDO_INJUSTIFICADO'
            ? `salario_diario ($${roundTwo(salarioDiario)}) × 30 × ${roundTwo(Math.min(aniosServicio, 4))} años = $${roundTwo(indemnizacion)}`
            : 'No aplica',
        },
        prestacion_economica: {
          monto: roundTwo(prestacionEconomica),
          base_legal: tipo === 'RENUNCIA_VOLUNTARIA' ? 'Ley 523 - 15 días/año' : 'N/A',
          formula: tipo === 'RENUNCIA_VOLUNTARIA'
            ? `salario_diario ($${roundTwo(salarioDiario)}) × 15 × ${roundTwo(Math.min(aniosServicio, 4))} años = $${roundTwo(prestacionEconomica)}`
            : 'No aplica',
        },
        vacacion_proporcional: {
          monto: roundTwo(vacacionProporcional),
          base_legal: 'Art. 177 CT - 15 días por año',
          formula: `(15/12) × ${roundTwo(mesesServicio)} meses × $${roundTwo(salarioDiario)} = $${roundTwo(vacacionProporcional)}`,
        },
        aguinaldo_proporcional: {
          monto: roundTwo(aguinaldoProporcional),
          base_legal: 'Arts. 196-202 CT',
          formula: `(${diasAguinaldo}/360) × ${roundTwo(diffDays)} días × $${roundTwo(salarioDiario)} = $${roundTwo(aguinaldoProporcional)}`,
        },
        salario_pendiente: {
          monto: roundTwo(salarioPendiente),
          base_legal: 'Art. 139 CT',
          formula: `${fechaLiq.getDate()} días × $${roundTwo(salarioDiario)} = $${roundTwo(salarioPendiente)}`,
        },
      },
    });
  } catch (error) {
    console.error('Error calculating liquidacion:', error);
    return NextResponse.json({ error: 'Error al calcular liquidación' }, { status: 500 });
  }
}
