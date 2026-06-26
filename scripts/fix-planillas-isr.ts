// ============================================================
// One-time fix script: Recalculate ISR for existing planillas
//
// Problem: After fixing the ISR tramo cuota_fija values
// (Tramo 3: 107.39 → 60.00, Tramo 4: 310.76 → 288.57),
// planillas calculated BEFORE the fix still have stale
// isr_retenido values in their detalle_planilla records.
//
// The /api/reportes/isr endpoint prefers stored planilla
// detail values over freshly-calculated ones, so the report
// still shows the old wrong ISR (e.g., $182.04 instead of
// $134.65 for a $1,400 salary).
//
// This script:
// 1. Finds all planillas in CALCULADA / APROBADA / PAGADA state
// 2. For each detalle_planilla, recalculates ISR using current tramos
// 3. Updates isr_retenido, total_descuentos, salario_neto
// 4. Recalculates planilla totals (total_isr_retenido, total_descuentos,
//    total_neto_a_pagar)
// 5. Verifies the report would now show correct values
// ============================================================
import { db } from '../src/lib/db';

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

function calcularISR(rentaImponible: number, tramos: { desde: number; hasta: number | null; porcentaje: number; cuota_fija: number }[]): number {
  let isr = 0;
  for (const tramo of tramos) {
    if (rentaImponible >= tramo.desde) {
      const base = rentaImponible - tramo.desde;
      isr = base * tramo.porcentaje + tramo.cuota_fija;
      if (tramo.hasta === null || rentaImponible <= tramo.hasta) {
        break;
      }
    }
  }
  return Math.max(0, isr);
}

async function main() {
  console.log('🔧 Iniciando recálculo de ISR en planillas existentes...\n');

  // Get active legal parameters (already corrected)
  const parametro = await db.parametroLegal.findFirst({
    where: { estado: 'ACTIVO' },
    include: { tramos_isr: { orderBy: { numero_tramo: 'asc' } } },
  });

  if (!parametro) {
    console.error('❌ No hay parámetros legales activos.');
    process.exit(1);
  }

  console.log(`Parámetro legal activo: ${parametro.id.substring(0, 12)}...`);
  console.log(`Tramos ISR vigentes:`);
  for (const t of parametro.tramos_isr) {
    console.log(`  Tramo ${t.numero_tramo}: desde $${t.desde.toFixed(2)} hasta ${t.hasta === null ? '∞' : '$' + t.hasta.toFixed(2)} | ${(t.porcentaje * 100).toFixed(0)}% | cuota fija $${t.cuota_fija.toFixed(2)}`);
  }
  console.log('');

  // Find all planillas with stale ISR data (MENSUAL, QUINCENAL, AGUINALDO)
  const planillas = await db.planilla.findMany({
    where: {
      estado: { in: ['CALCULADA', 'APROBADA', 'PAGADA'] },
      tipo: { in: ['MENSUAL', 'QUINCENAL'] }, // AGUINALDO has different ISR logic; skip
    },
    include: { detalles_planilla: true },
    orderBy: { fecha_calculo: 'asc' },
  });

  console.log(`Encontradas ${planillas.length} planilla(s) para recalcular.\n`);

  let totalDetallesFixed = 0;
  let totalDetallesUnchanged = 0;

  for (const planilla of planillas) {
    console.log(`\n📋 Planilla: ${planilla.codigo_planilla} (${planilla.tipo}, estado: ${planilla.estado})`);
    console.log(`   Empleados: ${planilla.total_empleados}, Total ISR almacenado: $${planilla.total_isr_retenido.toFixed(2)}`);

    let planillaTotalIsr = 0;
    let planillaTotalDescuentos = 0;
    let planillaTotalNeto = 0;
    let planillaFixedCount = 0;

    for (const det of planilla.detalles_planilla) {
      // Recalculate ISR using the current (corrected) tramos
      const nuevoIsr = roundTwo(calcularISR(det.renta_imponible, parametro.tramos_isr));
      const isrAnterior = det.isr_retenido;

      if (Math.abs(nuevoIsr - isrAnterior) > 0.005) {
        // Recalculate totals
        const nuevosDescuentos = roundTwo(
          det.isss_laboral + det.afp_laboral + nuevoIsr +
          det.cuota_alimenticia + det.prestamo_patronal +
          det.seguro_complementario + det.otros_descuentos
        );
        const nuevoNeto = roundTwo(det.salario_bruto - nuevosDescuentos);

        await db.detallePlanilla.update({
          where: { id: det.id },
          data: {
            isr_retenido: nuevoIsr,
            total_descuentos: nuevosDescuentos,
            salario_neto: nuevoNeto,
          },
        });

        console.log(`   ✅ ${det.empleado_id.substring(0, 8)}... | renta $${det.renta_imponible.toFixed(2)} | ISR: $${isrAnterior.toFixed(2)} → $${nuevoIsr.toFixed(2)} | desc $${det.total_descuentos.toFixed(2)} → $${nuevosDescuentos.toFixed(2)} | neto $${det.salario_neto.toFixed(2)} → $${nuevoNeto.toFixed(2)}`);
        planillaFixedCount++;
        totalDetallesFixed++;
      } else {
        totalDetallesUnchanged++;
      }

      planillaTotalIsr += nuevoIsr;
      // For totals, use the just-updated descuentos/neto values
      const nuevosDescuentos = roundTwo(
        det.isss_laboral + det.afp_laboral + nuevoIsr +
        det.cuota_alimenticia + det.prestamo_patronal +
        det.seguro_complementario + det.otros_descuentos
      );
      const nuevoNeto = roundTwo(det.salario_bruto - nuevosDescuentos);
      planillaTotalDescuentos += nuevosDescuentos;
      planillaTotalNeto += nuevoNeto;
    }

    // Update planilla totals
    const nuevoTotalIsr = roundTwo(planillaTotalIsr);
    const nuevoTotalDescuentos = roundTwo(planillaTotalDescuentos);
    const nuevoTotalNeto = roundTwo(planillaTotalNeto);

    const isrAnteriorTotal = planilla.total_isr_retenido;
    const descAnteriorTotal = planilla.total_descuentos;
    const netoAnteriorTotal = planilla.total_neto_a_pagar;

    if (
      Math.abs(nuevoTotalIsr - isrAnteriorTotal) > 0.005 ||
      Math.abs(nuevoTotalDescuentos - descAnteriorTotal) > 0.005 ||
      Math.abs(nuevoTotalNeto - netoAnteriorTotal) > 0.005
    ) {
      await db.planilla.update({
        where: { id: planilla.id },
        data: {
          total_isr_retenido: nuevoTotalIsr,
          total_descuentos: nuevoTotalDescuentos,
          total_neto_a_pagar: nuevoTotalNeto,
        },
      });
      console.log(`   📊 Totales actualizados: ISR $${isrAnteriorTotal.toFixed(2)} → $${nuevoTotalIsr.toFixed(2)} | Desc $${descAnteriorTotal.toFixed(2)} → $${nuevoTotalDescuentos.toFixed(2)} | Neto $${netoAnteriorTotal.toFixed(2)} → $${nuevoTotalNeto.toFixed(2)}`);
    }

    console.log(`   ${planillaFixedCount} detalle(s) actualizado(s), ${planilla.detalles_planilla.length - planillaFixedCount} sin cambios.`);
  }

  console.log(`\n\n========================================`);
  console.log(`✅ Recálculo completado.`);
  console.log(`   Detalles corregidos: ${totalDetallesFixed}`);
  console.log(`   Detalles sin cambios: ${totalDetallesUnchanged}`);
  console.log(`========================================\n`);

  // Verify by checking specific employee with salary $1,400
  console.log('🧮 Verificación post-fix (empleado con salario $1,400):');
  const empleado1400 = await db.empleado.findFirst({
    where: { salario_base: 1400 },
    include: {
      contratos: { where: { activo: true }, take: 1 },
    },
  });

  if (empleado1400) {
    const salario = 1400;
    const isss = Math.min(salario, parametro.tope_cotizacion_isss) * parametro.tasa_isss_laboral;
    const afp = salario * parametro.tasa_afp_laboral;
    const renta = salario - isss - afp;
    const isr = calcularISR(renta, parametro.tramos_isr);

    console.log(`  Empleado: ${empleado1400.primer_nombre} ${empleado1400.primer_apellido}`);
    console.log(`  Salario: $${salario.toFixed(2)}`);
    console.log(`  ISSS: $${isss.toFixed(2)}`);
    console.log(`  AFP: $${afp.toFixed(2)}`);
    console.log(`  Renta Imponible: $${renta.toFixed(2)}`);
    console.log(`  ISR calculado: $${isr.toFixed(2)}`);
    console.log(`  ${Math.abs(isr - 134.65) < 0.01 ? '✅ PASS' : '❌ FAIL'}: esperado $134.65`);

    // Also check the stored value in the most recent planilla detalle
    const ultimaPlanilla = await db.planilla.findFirst({
      where: { estado: { in: ['CALCULADA', 'APROBADA', 'PAGADA'] }, tipo: { in: ['MENSUAL', 'QUINCENAL'] } },
      orderBy: { fecha_calculo: 'desc' },
      include: { detalles_planilla: { where: { empleado_id: empleado1400.id } } },
    });

    if (ultimaPlanilla && ultimaPlanilla.detalles_planilla.length > 0) {
      const det = ultimaPlanilla.detalles_planilla[0];
      console.log(`\n  📋 Planilla más reciente: ${ultimaPlanilla.codigo_planilla}`);
      console.log(`     detalle.isr_retenido (almacenado): $${det.isr_retenido.toFixed(2)}`);
      console.log(`     detalle.total_descuentos: $${det.total_descuentos.toFixed(2)}`);
      console.log(`     detalle.salario_neto: $${det.salario_neto.toFixed(2)}`);
      console.log(`     planilla.total_isr_retenido: $${ultimaPlanilla.total_isr_retenido.toFixed(2)}`);
      console.log(`     planilla.total_neto_a_pagar: $${ultimaPlanilla.total_neto_a_pagar.toFixed(2)}`);
      console.log(`     ${Math.abs(det.isr_retenido - 134.65) < 0.01 ? '✅ PASS' : '❌ FAIL'}: detalle.isr_retenido debería ser $134.65`);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
