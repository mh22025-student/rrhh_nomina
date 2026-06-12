import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

const ALLOWED_ROLES: UserRole[] = ['ADMIN', 'GERENCIA', 'AUDITOR'];

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fmt(n: number): string {
  return n.toFixed(2);
}

function fmtDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// GET /api/reportes/isss/download - Download ISSS OIS report as CSV
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json({ error: 'No tiene permisos para descargar este reporte' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1));
    const anio = parseInt(searchParams.get('anio') || String(new Date().getFullYear()));

    // Get active legal parameters
    const parametro = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
    });

    if (!parametro) {
      return NextResponse.json({ error: 'No hay parámetros legales vigentes' }, { status: 404 });
    }

    const tasaLaboral = parametro.tasa_isss_laboral;
    const tasaPatronal = parametro.tasa_isss_patronal;
    const topeIsss = parametro.tope_cotizacion_isss;

    // Get active employees with ISSS number
    const empleados = await db.empleado.findMany({
      where: {
        estado: 'ACTIVO',
        numero_isss: { not: null },
      },
      include: {
        perfil_puesto: { include: { banda_salarial: true } },
      },
      orderBy: { primer_apellido: 'asc' },
    });

    // Find planilla for this period to get actual calculation data
    const planilla = await db.planilla.findFirst({
      where: {
        tipo: 'MENSUAL',
        estado: { in: ['CALCULADA', 'APROBADA', 'PAGADA'] },
      },
      include: {
        detalles_planilla: true,
      },
    });

    // Build CSV content
    const lines: string[] = [];

    // Header rows with metadata
    lines.push(`OIS - Obra Informativa de Salarios;ISSS El Salvador`);
    lines.push(`Periodo;${MESES[mes]} ${anio}`);
    lines.push(`Fecha de Generación;${fmtDate(new Date())}`);
    lines.push(`Tasa Laboral;${(tasaLaboral * 100).toFixed(1)}%`);
    lines.push(`Tasa Patronal;${(tasaPatronal * 100).toFixed(1)}%`);
    lines.push(`Tope Cotización;$${fmt(topeIsss)}`);
    lines.push('');

    // Column headers
    lines.push(
      'Número ISSS;DUI;Nombre del Trabajador;Salario Cotizable;Cotización Laboral (3%);Cotización Patronal (7.5%);Total Cotización'
    );

    // Data rows
    let totalSalario = 0;
    let totalLaboral = 0;
    let totalPatronal = 0;

    for (const emp of empleados) {
      const salarioBase = emp.salario_base;
      const salarioCotizable = Math.min(salarioBase, topeIsss);
      const cotizacionLaboral = salarioCotizable * tasaLaboral;
      const cotizacionPatronal = salarioCotizable * tasaPatronal;

      // Use planilla detail if available for actual calculated amounts
      const detalle = planilla?.detalles_planilla.find(
        (d) => d.empleado_id === emp.id
      );

      const lab = detalle?.isss_laboral ?? cotizacionLaboral;
      const pat = detalle?.isss_patronal ?? cotizacionPatronal;
      const total = lab + pat;

      totalSalario += salarioCotizable;
      totalLaboral += lab;
      totalPatronal += pat;

      const nombre = `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.trim();

      lines.push(
        `${emp.numero_isss};${emp.dui};${nombre};$${fmt(salarioCotizable)};$${fmt(lab)};$${fmt(pat)};$${fmt(total)}`
      );
    }

    // Totals row
    lines.push('');
    lines.push(
      `TOTALES;;;${empleados.length} empleados;$${fmt(totalSalario)};$${fmt(totalLaboral)};$${fmt(totalPatronal)};$${fmt(totalLaboral + totalPatronal)}`
    );

    // Generate CSV with BOM for Excel compatibility
    const csvContent = '\uFEFF' + lines.join('\n');

    const filename = `OIS-${String(mes).padStart(2, '0')}-${anio}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating ISSS OIS download:', error);
    return NextResponse.json({ error: 'Error al generar archivo OIS' }, { status: 500 });
  }
}
