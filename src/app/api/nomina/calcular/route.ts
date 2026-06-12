import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// ============================================================
// POST /api/nomina/calcular
// Calculate payroll for a period following El Salvador law
// ============================================================
export async function POST(request: NextRequest) {
  // Auth check
  const authCheck = requireRoles('ADMIN', 'ANALISTA')(request);
  if ('error' in authCheck) {
    return authCheck.error;
  }
  const { user } = authCheck;

  try {
    const body = await request.json();
    const { periodoInicio, periodoFin, tipo } = body as {
      periodoInicio: string;
      periodoFin: string;
      tipo: 'MENSUAL' | 'QUINCENAL';
    };

    if (!periodoInicio || !periodoFin || !tipo) {
      return NextResponse.json(
        { error: 'periodoInicio, periodoFin y tipo son requeridos' },
        { status: 400 }
      );
    }

    const fechaInicio = new Date(periodoInicio);
    const fechaFin = new Date(periodoFin);

    if (fechaInicio >= fechaFin) {
      return NextResponse.json(
        { error: 'La fecha de inicio debe ser anterior a la fecha de fin' },
        { status: 400 }
      );
    }

    // Step 1: Get active employees with active contracts
    const empleados = await db.empleado.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        contratos: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
        area: true,
      },
    });

    // Step 2: Get current parametros_legales
    const parametros = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      orderBy: { fecha_vigencia_desde: 'desc' },
      include: {
        tramos_isr: { orderBy: { numero_tramo: 'asc' } },
        salarios_minimos: true,
      },
    });

    if (!parametros) {
      return NextResponse.json(
        { error: 'No hay parámetros legales activos. Configure los parámetros primero.' },
        { status: 400 }
      );
    }

    // Step 3: Get approved incidencias for the period
    const incidencias = await db.incidenciaNomina.findMany({
      where: {
        estado: 'APROBADA',
        fecha_inicio: { gte: fechaInicio },
        ...(fechaFin ? { fecha_inicio: { lte: fechaFin } } : {}),
      },
      include: { empleado: true },
    });

    // Group incidencias by employee
    const incidenciasByEmpleado = new Map<string, typeof incidencias>();
    for (const inc of incidencias) {
      const list = incidenciasByEmpleado.get(inc.empleado_id) || [];
      list.push(inc);
      incidenciasByEmpleado.set(inc.empleado_id, list);
    }

    // Anomalies tracking
    const anomalies: Array<{
      empleado_id: string;
      empleado_nombre: string;
      tipo: string;
      detalle: string;
      severidad: 'ALTA' | 'MEDIA' | 'BAJA';
    }> = [];

    // Previous period for comparison
    const planillaAnterior = await db.planilla.findFirst({
      where: { estado: { in: ['APROBADA', 'PAGADA'] } },
      orderBy: { fecha_fin_periodo: 'desc' },
      include: { detalles_planilla: true },
    });

    const salariosAnteriores = new Map<string, number>();
    if (planillaAnterior) {
      for (const det of planillaAnterior.detalles_planilla) {
        salariosAnteriores.set(det.empleado_id, det.salario_bruto);
      }
    }

    // Total employees with active contracts for INSAFORP calculation
    const empleadosConContrato = empleados.filter(e => e.contratos.length > 0);
    const totalEmpleados = empleadosConContrato.length;

    // Calculation results
    const detalles: Array<{
      empleado_id: string;
      salario_base: number;
      total_horas_extra: number;
      total_comisiones: number;
      total_bonos: number;
      salario_bruto: number;
      isss_laboral: number;
      isss_patronal: number;
      afp_laboral: number;
      afp_patronal: number;
      renta_imponible: number;
      isr_retenido: number;
      cuota_alimenticia: number;
      prestamo_patronal: number;
      seguro_complementario: number;
      otros_descuentos: number;
      total_descuentos: number;
      salario_neto: number;
      observaciones: string;
    }> = [];

    let totalBrutos = 0;
    let totalIsssLaboral = 0;
    let totalIsssPatronal = 0;
    let totalAfpLaboral = 0;
    let totalAfpPatronal = 0;
    let totalIsrRetenido = 0;
    let totalDescuentos = 0;
    let totalNeto = 0;

    // Check for duplicate incidences
    const incidenciaCounts = new Map<string, number>();
    for (const inc of incidencias) {
      const key = `${inc.empleado_id}_${inc.tipo}_${inc.fecha_inicio.toISOString()}`;
      incidenciaCounts.set(key, (incidenciaCounts.get(key) || 0) + 1);
    }
    for (const [key, count] of incidenciaCounts) {
      if (count > 1) {
        const parts = key.split('_');
        const empId = parts[0];
        const emp = empleados.find(e => e.id === empId);
        anomalies.push({
          empleado_id: empId,
          empleado_nombre: emp ? `${emp.primer_nombre} ${emp.primer_apellido}` : 'Desconocido',
          tipo: 'DUPLICADO_INCIDENCIA',
          detalle: `Incidencia duplicada detectada (${count} registros)`,
          severidad: 'ALTA',
        });
      }
    }

    // Process each employee
    for (const empleado of empleados) {
      // Check for missing contract
      if (empleado.contratos.length === 0) {
        anomalies.push({
          empleado_id: empleado.id,
          empleado_nombre: `${empleado.primer_nombre} ${empleado.primer_apellido}`,
          tipo: 'SIN_CONTRATO',
          detalle: 'Empleado sin contrato activo',
          severidad: 'ALTA',
        });
        continue;
      }

      const contrato = empleado.contratos[0];

      // Check for missing ISSS/AFP
      if (!empleado.numero_isss) {
        anomalies.push({
          empleado_id: empleado.id,
          empleado_nombre: `${empleado.primer_nombre} ${empleado.primer_apellido}`,
          tipo: 'SIN_NUMERO_ISSS',
          detalle: 'Empleado sin número de ISSS registrado',
          severidad: 'MEDIA',
        });
      }
      if (!empleado.numero_afp) {
        anomalies.push({
          empleado_id: empleado.id,
          empleado_nombre: `${empleado.primer_nombre} ${empleado.primer_apellido}`,
          tipo: 'SIN_NUMERO_AFP',
          detalle: 'Empleado sin número de AFP registrado',
          severidad: 'MEDIA',
        });
      }

      // --- STEP 1: Salario Base ---
      const salarioBase = contrato.salario_base_contrato;

      // --- Process incidencias ---
      const emIncidencias = incidenciasByEmpleado.get(empleado.id) || [];
      let totalHorasExtra = 0;
      let totalComisiones = 0;
      let totalBonos = 0;
      const descuentosEspeciales: Array<{ tipo: string; monto: number }> = [];

      // Hourly rate = salario_base / 30 / 8
      const hourlyRate = salarioBase / 30 / 8;
      let totalOvertimeHours = 0;

      for (const inc of emIncidencias) {
        switch (inc.tipo) {
          case 'HORAS_EXTRA': {
            const horas = inc.cantidad_horas || 0;
            totalOvertimeHours += horas;
            let multiplier = 2.0; // DIURNA default
            if (inc.tipo_horas_extra === 'NOCTURNA') multiplier = 2.5;
            else if (inc.tipo_horas_extra === 'DESCANSO') multiplier = 3.0;
            else if (inc.tipo_horas_extra === 'ASUETO') multiplier = 3.0;
            totalHorasExtra += hourlyRate * horas * multiplier;
            break;
          }
          case 'COMISION':
            totalComisiones += inc.monto || 0;
            break;
          case 'BONO':
            totalBonos += inc.monto || 0;
            break;
          case 'DESCUENTO_ESPECIAL': {
            // Prioritize: cuota alimenticia > préstamo patronal > seguro complementario > otros
            if (inc.descripcion?.toLowerCase().includes('alimenticia') || inc.descripcion?.toLowerCase().includes('cuota')) {
              descuentosEspeciales.push({ tipo: 'cuota_alimenticia', monto: inc.monto || 0 });
            } else if (inc.descripcion?.toLowerCase().includes('préstamo') || inc.descripcion?.toLowerCase().includes('prestamo')) {
              descuentosEspeciales.push({ tipo: 'prestamo_patronal', monto: inc.monto || 0 });
            } else if (inc.descripcion?.toLowerCase().includes('seguro')) {
              descuentosEspeciales.push({ tipo: 'seguro_complementario', monto: inc.monto || 0 });
            } else {
              descuentosEspeciales.push({ tipo: 'otros_descuentos', monto: inc.monto || 0 });
            }
            break;
          }
          case 'INCAPACIDAD':
            // Incapacidades reduce salary but handled differently
            break;
        }
      }

      // Check overtime anomaly (>10h/week)
      const semanasEnPeriodo = Math.max(1, Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (7 * 24 * 60 * 60 * 1000)));
      if (totalOvertimeHours / semanasEnPeriodo > 10) {
        anomalies.push({
          empleado_id: empleado.id,
          empleado_nombre: `${empleado.primer_nombre} ${empleado.primer_apellido}`,
          tipo: 'HORAS_EXTRA_EXCESIVAS',
          detalle: `Horas extra promedio ${(totalOvertimeHours / semanasEnPeriodo).toFixed(1)}h/semana supera el límite de 10h/semana`,
          severidad: 'MEDIA',
        });
      }

      // --- SALARIO BRUTO ---
      const salarioBruto = salarioBase + totalHorasExtra + totalComisiones + totalBonos;

      // --- STEP 2: ISSS Laboral ---
      const isssLaboral = Math.min(
        Math.min(salarioBruto, parametros.tope_cotizacion_isss) * parametros.tasa_isss_laboral,
        parametros.tope_cotizacion_isss * parametros.tasa_isss_laboral // max deduction
      );

      // --- STEP 3: AFP Laboral ---
      const afpLaboral = salarioBruto * parametros.tasa_afp_laboral;

      // --- STEP 4: Renta Imponible ---
      const rentaImponible = salarioBruto - isssLaboral - afpLaboral;

      // --- STEP 5: ISR ---
      let isrRetenido = 0;
      for (const tramo of parametros.tramos_isr) {
        if (rentaImponible >= tramo.desde) {
          const base = rentaImponible - tramo.desde;
          isrRetenido = base * tramo.porcentaje + tramo.cuota_fija;
          // If there's an "hasta" and we're below it, this is our tramo
          if (!tramo.hasta || rentaImponible <= tramo.hasta) {
            break;
          }
        }
      }
      isrRetenido = Math.max(0, isrRetenido);

      // --- STEP 6: Descuentos adicionales ---
      let cuotaAlimenticia = 0;
      let prestamoPatronal = 0;
      let seguroComplementario = 0;
      let otrosDescuentos = 0;

      for (const desc of descuentosEspeciales) {
        switch (desc.tipo) {
          case 'cuota_alimenticia': cuotaAlimenticia += desc.monto; break;
          case 'prestamo_patronal': prestamoPatronal += desc.monto; break;
          case 'seguro_complementario': seguroComplementario += desc.monto; break;
          case 'otros_descuentos': otrosDescuentos += desc.monto; break;
        }
      }

      // --- STEP 7: Salario Neto ---
      const totalDesc = isssLaboral + afpLaboral + isrRetenido + cuotaAlimenticia + prestamoPatronal + seguroComplementario + otrosDescuentos;
      let salarioNeto = salarioBruto - totalDesc;

      // Check net pay anomaly
      if (salarioNeto <= 0) {
        anomalies.push({
          empleado_id: empleado.id,
          empleado_nombre: `${empleado.primer_nombre} ${empleado.primer_apellido}`,
          tipo: 'SALARIO_NETO_CERO',
          detalle: `Salario neto es $${salarioNeto.toFixed(2)}. Los descuentos exceden el salario bruto.`,
          severidad: 'ALTA',
        });
      }

      // Check salary change >20% vs previous period
      const salarioAnterior = salariosAnteriores.get(empleado.id);
      if (salarioAnterior && salarioAnterior > 0) {
        const cambioPorcentaje = Math.abs(salarioBruto - salarioAnterior) / salarioAnterior;
        if (cambioPorcentaje > 0.20) {
          anomalies.push({
            empleado_id: empleado.id,
            empleado_nombre: `${empleado.primer_nombre} ${empleado.primer_apellido}`,
            tipo: 'CAMBIO_SALARIAL_SIGNIFICATIVO',
            detalle: `Cambio de ${(cambioPorcentaje * 100).toFixed(1)}% vs período anterior ($${salarioAnterior.toFixed(2)} → $${salarioBruto.toFixed(2)})`,
            severidad: 'MEDIA',
          });
        }
      }

      // ISSS Patronal
      const isssPatronal = Math.min(salarioBruto, parametros.tope_cotizacion_isss) * parametros.tasa_isss_patronal;
      // AFP Patronal
      const afpPatronal = salarioBruto * parametros.tasa_afp_patronal;

      // Accumulate totals
      totalBrutos += salarioBruto;
      totalIsssLaboral += isssLaboral;
      totalIsssPatronal += isssPatronal;
      totalAfpLaboral += afpLaboral;
      totalAfpPatronal += afpPatronal;
      totalIsrRetenido += isrRetenido;
      totalDescuentos += totalDesc;
      totalNeto += salarioNeto;

      detalles.push({
        empleado_id: empleado.id,
        salario_base: Math.round(salarioBase * 100) / 100,
        total_horas_extra: Math.round(totalHorasExtra * 100) / 100,
        total_comisiones: Math.round(totalComisiones * 100) / 100,
        total_bonos: Math.round(totalBonos * 100) / 100,
        salario_bruto: Math.round(salarioBruto * 100) / 100,
        isss_laboral: Math.round(isssLaboral * 100) / 100,
        isss_patronal: Math.round(isssPatronal * 100) / 100,
        afp_laboral: Math.round(afpLaboral * 100) / 100,
        afp_patronal: Math.round(afpPatronal * 100) / 100,
        renta_imponible: Math.round(rentaImponible * 100) / 100,
        isr_retenido: Math.round(isrRetenido * 100) / 100,
        cuota_alimenticia: Math.round(cuotaAlimenticia * 100) / 100,
        prestamo_patronal: Math.round(prestamoPatronal * 100) / 100,
        seguro_complementario: Math.round(seguroComplementario * 100) / 100,
        otros_descuentos: Math.round(otrosDescuentos * 100) / 100,
        total_descuentos: Math.round(totalDesc * 100) / 100,
        salario_neto: Math.round(salarioNeto * 100) / 100,
        observaciones: emIncidencias.length > 0 ? `${emIncidencias.length} incidencia(s) aplicada(s)` : '',
      });
    }

    // --- STEP 8: Cargas Patronales ---
    const insaforp = totalEmpleados >= parametros.empleados_minimos_insaforp
      ? totalBrutos * parametros.tasa_insaforp
      : 0;
    const totalCargasPatronales = totalIsssPatronal + totalAfpPatronal + insaforp;

    // Round all totals
    const roundTwo = (n: number) => Math.round(n * 100) / 100;

    // Generate planilla code
    const planillasCount = await db.planilla.count();
    const codigoPlanilla = `NOM-${new Date().getFullYear()}-${String(planillasCount + 1).padStart(4, '0')}`;

    // Create Planilla
    const planilla = await db.planilla.create({
      data: {
        codigo_planilla: codigoPlanilla,
        tipo,
        estado: 'CALCULADA',
        fecha_inicio_periodo: fechaInicio,
        fecha_fin_periodo: fechaFin,
        total_empleados: detalles.length,
        total_salarios_brutos: roundTwo(totalBrutos),
        total_isss_laboral: roundTwo(totalIsssLaboral),
        total_isss_patronal: roundTwo(totalIsssPatronal),
        total_afp_laboral: roundTwo(totalAfpLaboral),
        total_afp_patronal: roundTwo(totalAfpPatronal),
        total_isr_retenido: roundTwo(totalIsrRetenido),
        total_descuentos: roundTwo(totalDescuentos),
        total_neto_a_pagar: roundTwo(totalNeto),
        total_cargas_patronales: roundTwo(totalCargasPatronales),
        calculada_por_id: user.userId,
        fecha_calculo: new Date(),
      },
    });

    // Create DetallePlanilla for each employee
    for (const det of detalles) {
      await db.detallePlanilla.create({
        data: {
          planilla_id: planilla.id,
          empleado_id: det.empleado_id,
          salario_base: det.salario_base,
          total_horas_extra: det.total_horas_extra,
          total_comisiones: det.total_comisiones,
          total_bonos: det.total_bonos,
          salario_bruto: det.salario_bruto,
          isss_laboral: det.isss_laboral,
          isss_patronal: det.isss_patronal,
          afp_laboral: det.afp_laboral,
          afp_patronal: det.afp_patronal,
          renta_imponible: det.renta_imponible,
          isr_retenido: det.isr_retenido,
          total_descuentos: det.total_descuentos,
          salario_neto: det.salario_neto,
          cuota_alimenticia: det.cuota_alimenticia,
          prestamo_patronal: det.prestamo_patronal,
          seguro_complementario: det.seguro_complementario,
          otros_descuentos: det.otros_descuentos,
          observaciones: det.observaciones,
        },
      });

      // Create EmpleadoPlanilla link
      await db.empleadoPlanilla.create({
        data: {
          planilla_id: planilla.id,
          empleado_id: det.empleado_id,
          incluido: true,
        },
      });
    }

    // Create default checklist items for approval
    const checklistItems = [
      'Headcount verificado',
      'Cálculos de ISR validados',
      'Incidencias revisadas',
      'Totales coinciden con período anterior',
      'Retenciones previsionales verificadas',
    ];
    for (const item of checklistItems) {
      await db.checklistAprobacionPlanilla.create({
        data: {
          planilla_id: planilla.id,
          item,
          completado: false,
        },
      });
    }

    // Log to bitacora
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: user.userId,
        usuario_email: user.email,
        accion: 'CALCULO_NOMINA',
        tabla_afectada: 'planillas',
        registro_id: planilla.id,
        valor_nuevo: JSON.stringify({
          codigo: codigoPlanilla,
          tipo,
          empleados: detalles.length,
          totalBruto: roundTwo(totalBrutos),
          totalNeto: roundTwo(totalNeto),
        }),
        resultado: 'EXITOSO',
        nivel_criticidad: 'ALTO',
        detalle_adicional: `Planilla calculada: ${detalles.length} empleados, ${anomalies.length} anomalías detectadas`,
      },
    });

    return NextResponse.json({
      planilla: {
        id: planilla.id,
        codigo_planilla: codigoPlanilla,
        tipo,
        estado: 'CALCULADA',
        fecha_inicio_periodo: periodoInicio,
        fecha_fin_periodo: periodoFin,
        total_empleados: detalles.length,
        total_salarios_brutos: roundTwo(totalBrutos),
        total_isss_laboral: roundTwo(totalIsssLaboral),
        total_isss_patronal: roundTwo(totalIsssPatronal),
        total_afp_laboral: roundTwo(totalAfpLaboral),
        total_afp_patronal: roundTwo(totalAfpPatronal),
        total_isr_retenido: roundTwo(totalIsrRetenido),
        total_descuentos: roundTwo(totalDescuentos),
        total_neto_a_pagar: roundTwo(totalNeto),
        total_cargas_patronales: roundTwo(totalCargasPatronales),
        insaforp: roundTwo(insaforp),
        fecha_calculo: planilla.fecha_calculo,
      },
      detalles,
      anomalies,
      parametros_utilizados: {
        tasa_isss_laboral: parametros.tasa_isss_laboral,
        tasa_isss_patronal: parametros.tasa_isss_patronal,
        tope_isss: parametros.tope_cotizacion_isss,
        tasa_afp_laboral: parametros.tasa_afp_laboral,
        tasa_afp_patronal: parametros.tasa_afp_patronal,
        tasa_insaforp: parametros.tasa_insaforp,
        tramos_isr: parametros.tramos_isr,
      },
    });
  } catch (error) {
    console.error('Error calculating payroll:', error);
    return NextResponse.json(
      { error: 'Error interno al calcular la nómina' },
      { status: 500 }
    );
  }
}
