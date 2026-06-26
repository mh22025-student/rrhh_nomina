// ============================================================
// One-time fix script: Correct ISR tramo cuota_fija values
//
// Bug: Tramos 3 and 4 had incorrect cuota_fija values that
// produced wrong ISR calculations (e.g., salary $1,400 returned
// $182.04 instead of the legally-correct $134.65).
//
// Correct values per El Salvador Ministry of Finance
// (vigentes desde 2014, Art. 3 Ley del Impuesto sobre la Renta):
//
//   Tramo 3: cuota_fija 60.00   (was 107.39 in seed.ts, 85.68 in UI)
//   Tramo 4: cuota_fija 288.57  (was 310.76 in seed.ts, 314.50 in UI)
//
// Verified by progressivity:
//   Top of Tramo 2 (renta=895.24): (895.24-472.01)*0.10 + 17.67 = 59.99 ≈ 60.00
//   Top of Tramo 3 (renta=2038.10): (2038.10-895.25)*0.20 + 60.00 = 288.57
// ============================================================
import { db } from '../src/lib/db';

async function main() {
  console.log('🔧 Iniciando corrección de tramos ISR...\n');

  // Find ALL TramoISR records with numero_tramo 3 or 4
  const tramos = await db.tramoISR.findMany({
    where: { numero_tramo: { in: [3, 4] } },
    include: { parametro_legal: true },
  });

  console.log(`Encontrados ${tramos.length} tramos ISR (3 y 4) en la base de datos:\n`);

  let fixed = 0;
  for (const tramo of tramos) {
    const correctCuota = tramo.numero_tramo === 3 ? 60.00 : 288.57;
    if (Math.abs(tramo.cuota_fija - correctCuota) > 0.001) {
      const oldValue = tramo.cuota_fija;
      await db.tramoISR.update({
        where: { id: tramo.id },
        data: { cuota_fija: correctCuota },
      });
      console.log(`  ✅ ParametroLegal ${tramo.parametro_legal_id.substring(0, 8)}... | Tramo ${tramo.numero_tramo} | cuota_fija: ${oldValue} → ${correctCuota}`);
      fixed++;
    } else {
      console.log(`  ⏭️  ParametroLegal ${tramo.parametro_legal_id.substring(0, 8)}... | Tramo ${tramo.numero_tramo} | ya correcto (${tramo.cuota_fija})`);
    }
  }

  console.log(`\n✅ Proceso completado. ${fixed} tramo(s) corregido(s) de ${tramos.length} total.`);

  // Print verification table
  console.log('\n📊 Tabla de tramos ISR actualizada (parámetros activos):');
  const activeParams = await db.parametroLegal.findMany({
    where: { estado: 'ACTIVO' },
    include: { tramos_isr: { orderBy: { numero_tramo: 'asc' } } },
  });
  for (const p of activeParams) {
    console.log(`\n  ParametroLegal: ${p.id.substring(0, 12)}... (vigente desde ${p.fecha_vigencia_desde.toISOString().substring(0, 10)})`);
    console.log('  ┌─────────┬───────────┬───────────┬─────────┬────────────┐');
    console.log('  │ Tramo   │ Desde     │ Hasta     │ %       │ Cuota Fija │');
    console.log('  ├─────────┼───────────┼───────────┼─────────┼────────────┤');
    for (const t of p.tramos_isr) {
      const hasta = t.hasta !== null ? t.hasta.toFixed(2).padStart(9) : '   ∞     ';
      console.log(`  │   ${t.numero_tramo}     │ ${t.desde.toFixed(2).padStart(9)} │ ${hasta} │ ${(t.porcentaje * 100).toFixed(0).padStart(3)}%    │ ${t.cuota_fija.toFixed(2).padStart(10)} │`);
    }
    console.log('  └─────────┴───────────┴───────────┴─────────┴────────────┘');
  }

  // Verify calculation for $1,400 salary
  console.log('\n🧮 Verificación para salario $1,400 (debe resultar en ISR = $134.65):');
  for (const p of activeParams) {
    const salario = 1400;
    const isss = Math.min(salario, p.tope_cotizacion_isss) * p.tasa_isss_laboral;
    const afp = salario * p.tasa_afp_laboral;
    const renta = salario - isss - afp;
    let isr = 0;
    let tramoAplicado: typeof p.tramos_isr[number] | null = null;
    for (const t of p.tramos_isr) {
      if (renta >= t.desde) {
        isr = (renta - t.desde) * t.porcentaje + t.cuota_fija;
        if (t.hasta === null || renta <= t.hasta) {
          tramoAplicado = t;
          break;
        }
      }
    }
    console.log(`  Salario: $${salario.toFixed(2)}`);
    console.log(`  ISSS Laboral: min(${salario}, ${p.tope_cotizacion_isss}) × ${(p.tasa_isss_laboral * 100).toFixed(2)}% = $${isss.toFixed(2)}`);
    console.log(`  AFP Laboral: ${salario} × ${(p.tasa_afp_laboral * 100).toFixed(2)}% = $${afp.toFixed(2)}`);
    console.log(`  Renta Imponible: ${salario} - ${isss.toFixed(2)} - ${afp.toFixed(2)} = $${renta.toFixed(2)}`);
    if (tramoAplicado) {
      const base = renta - tramoAplicado.desde;
      console.log(`  Tramo aplicado: ${tramoAplicado.numero_tramo} (${(tramoAplicado.porcentaje * 100).toFixed(0)}%, cuota fija $${tramoAplicado.cuota_fija.toFixed(2)})`);
      console.log(`  ISR = (${renta.toFixed(2)} - ${tramoAplicado.desde.toFixed(2)}) × ${(tramoAplicado.porcentaje * 100).toFixed(0)}% + ${tramoAplicado.cuota_fija.toFixed(2)} = ${base.toFixed(2)} × ${(tramoAplicado.porcentaje * 100).toFixed(0)}% + ${tramoAplicado.cuota_fija.toFixed(2)} = $${isr.toFixed(2)}`);
    }
    const pass = Math.abs(isr - 134.65) < 0.01;
    console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}: ISR = $${isr.toFixed(2)} (esperado: $134.65)\n`);
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
