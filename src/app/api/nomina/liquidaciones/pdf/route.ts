import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import { generateLiquidacionPdf } from '@/lib/pdf-liquidacion';
import type { LiquidacionData } from '@/lib/pdf-liquidacion';

// ============================================================
// GET /api/nomina/liquidaciones/pdf?empleado_id=xxx
// Generate a PDF Constancia de Liquidación for an employee
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
    const liquidacionId = searchParams.get('liquidacion_id');

    if (!empleadoId && !liquidacionId) {
      return NextResponse.json(
        { error: 'Parámetro empleado_id o liquidacion_id es requerido' },
        { status: 400 }
      );
    }

    // 2. Fetch the liquidacion record (by id if provided, otherwise most recent for the employee)
    const liquidacionRecord = await db.liquidacion.findFirst({
      where: liquidacionId
        ? { id: liquidacionId }
        : { empleado_id: empleadoId! },
      orderBy: liquidacionId ? undefined : { fecha_creacion: 'desc' },
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
            fecha_ingreso: true,
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

    if (!liquidacionRecord) {
      return NextResponse.json(
        { error: liquidacionId ? 'No se encontró la liquidación especificada' : 'No se encontró liquidación para este empleado' },
        { status: 404 }
      );
    }

    const empleado = liquidacionRecord.empleado;
    const contrato = empleado.contratos[0];
    const salarioBase = contrato?.salario_base_contrato || liquidacionRecord.salario_base_liquidacion;
    const salarioDiario = salarioBase / 30;

    const roundTwo = (n: number) => Math.round(n * 100) / 100;

    // 3. Build desglose (breakdown)
    const fechaIngreso = new Date(empleado.fecha_ingreso);
    const fechaLiq = new Date(liquidacionRecord.fecha_liquidacion);
    const diffMs = fechaLiq.getTime() - fechaIngreso.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const aniosServicio = diffDays / 365.25;
    const mesesServicio = diffDays / 30.44;

    let diasAguinaldo = 15;
    if (aniosServicio >= 3) diasAguinaldo = 19;
    if (aniosServicio >= 10) diasAguinaldo = 21;

    const desglose = {
      indemnizacion: {
        monto: roundTwo(liquidacionRecord.indemnizacion),
        base_legal: liquidacionRecord.tipo === 'DESPEDO_INJUSTIFICADO'
          ? 'Art. 58 CT - 30 días/año, máximo 4 años'
          : 'N/A',
        formula: liquidacionRecord.tipo === 'DESPEDO_INJUSTIFICADO'
          ? `salario_diario ($${roundTwo(salarioDiario)}) × 30 × ${roundTwo(Math.min(aniosServicio, 4))} años = $${roundTwo(liquidacionRecord.indemnizacion)}`
          : 'No aplica',
      },
      prestacion_economica: {
        monto: roundTwo(liquidacionRecord.prestacion_economica),
        base_legal: liquidacionRecord.tipo === 'RENUNCIA_VOLUNTARIA'
          ? 'Ley 523 - 15 días/año'
          : 'N/A',
        formula: liquidacionRecord.tipo === 'RENUNCIA_VOLUNTARIA'
          ? `salario_diario ($${roundTwo(salarioDiario)}) × 15 × ${roundTwo(Math.min(aniosServicio, 4))} años = $${roundTwo(liquidacionRecord.prestacion_economica)}`
          : 'No aplica',
      },
      vacacion_proporcional: {
        monto: roundTwo(liquidacionRecord.vacacion_proporcional),
        base_legal: 'Art. 177 CT - 15 días por año',
        formula: `(15/12) × ${roundTwo(mesesServicio)} meses × $${roundTwo(salarioDiario)} = $${roundTwo(liquidacionRecord.vacacion_proporcional)}`,
      },
      aguinaldo_proporcional: {
        monto: roundTwo(liquidacionRecord.aguinaldo_proporcional),
        base_legal: 'Arts. 196-202 CT',
        formula: `(${diasAguinaldo}/360) × ${roundTwo(diffDays)} días × $${roundTwo(salarioDiario)} = $${roundTwo(liquidacionRecord.aguinaldo_proporcional)}`,
      },
      salario_pendiente: {
        monto: roundTwo(liquidacionRecord.salario_pendiente),
        base_legal: 'Art. 139 CT',
        formula: `${fechaLiq.getDate()} días × $${roundTwo(salarioDiario)} = $${roundTwo(liquidacionRecord.salario_pendiente)}`,
      },
    };

    // 4. Build PDF data
    const liquidacionData: LiquidacionData = {
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
      liquidacion: {
        tipo: liquidacionRecord.tipo,
        fecha_liquidacion: liquidacionRecord.fecha_liquidacion,
        salario_base: roundTwo(salarioBase),
        salario_diario: roundTwo(salarioDiario),
        anios_servicio: roundTwo(aniosServicio),
        indemnizacion: roundTwo(liquidacionRecord.indemnizacion),
        prestacion_economica: roundTwo(liquidacionRecord.prestacion_economica),
        vacacion_proporcional: roundTwo(liquidacionRecord.vacacion_proporcional),
        aguinaldo_proporcional: roundTwo(liquidacionRecord.aguinaldo_proporcional),
        salario_pendiente: roundTwo(liquidacionRecord.salario_pendiente),
        total_liquidacion: roundTwo(liquidacionRecord.total_liquidacion),
      },
      desglose,
    };

    // 5. Generate PDF
    const pdfBuffer = await generateLiquidacionPdf(liquidacionData);

    // 6. Return as downloadable PDF
    const filename = `liquidacion-${empleado.codigo_empleado}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating liquidacion PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar la constancia de liquidación' },
      { status: 500 }
    );
  }
}
