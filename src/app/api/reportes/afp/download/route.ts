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

// GET /api/reportes/afp/download - Download AFP SEPP report as CSV
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

    const tasaLaboral = parametro.tasa_afp_laboral;
    const tasaPatronal = parametro.tasa_afp_patronal;

    // Get active employees with AFP data
    const empleados = await db.empleado.findMany({
      where: {
        estado: 'ACTIVO',
        numero_afp: { not: null },
      },
      include: {
        perfil_puesto: true,
      },
      orderBy: { primer_apellido: 'asc' },
    });

    // Find planilla for this period
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
    lines.push(`SEPP - Sistema Electrónico de Planillas Patronales;AFP El Salvador`);
    lines.push(`Periodo;${MESES[mes]} ${anio}`);
    lines.push(`Fecha de Generación;${fmtDate(new Date())}`);
    lines.push(`Tasa Laboral;${(tasaLaboral * 100).toFixed(2)}%`);
    lines.push(`Tasa Patronal;${(tasaPatronal * 100).toFixed(2)}%`);
    lines.push('');

    // Group by AFP administradora
    const administradoras = ['CRECER', 'CONFIA'];

    for (const admin of administradoras) {
      const empleadosAdmin = empleados.filter((e) => e.afp_administradora === admin);

      if (empleadosAdmin.length === 0) continue;

      lines.push(`--- Administradora: AFP ${admin} ---`);

      // Column headers
      lines.push(
        'NUP;DUI;Nombre del Trabajador;Administradora AFP;IBC (Ingreso Base Cotizable);Cotización Laboral (7.25%);Cotización Patronal (8.75%);Total Cotización'
      );

      let totalIbc = 0;
      let totalLaboral = 0;
      let totalPatronal = 0;

      for (const emp of empleadosAdmin) {
        const ibc = emp.salario_base;
        const cotizacionLaboral = ibc * tasaLaboral;
        const cotizacionPatronal = ibc * tasaPatronal;

        const detalle = planilla?.detalles_planilla.find(
          (d) => d.empleado_id === emp.id
        );

        const lab = detalle?.afp_laboral ?? cotizacionLaboral;
        const pat = detalle?.afp_patronal ?? cotizacionPatronal;
        const total = lab + pat;

        totalIbc += ibc;
        totalLaboral += lab;
        totalPatronal += pat;

        const nombre = `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.trim();

        lines.push(
          `${emp.numero_afp};${emp.dui};${nombre};AFP ${emp.afp_administradora};$${fmt(ibc)};$${fmt(lab)};$${fmt(pat)};$${fmt(total)}`
        );
      }

      // Subtotals for this administradora
      lines.push(
        `SUBTOTALES ${admin};;;${empleadosAdmin.length} empleados;$${fmt(totalIbc)};$${fmt(totalLaboral)};$${fmt(totalPatronal)};$${fmt(totalLaboral + totalPatronal)}`
      );
      lines.push('');
    }

    // Grand totals
    let grandIbc = 0;
    let grandLab = 0;
    let grandPat = 0;

    for (const emp of empleados) {
      const ibc = emp.salario_base;
      const detalle = planilla?.detalles_planilla.find(
        (d) => d.empleado_id === emp.id
      );
      const lab = detalle?.afp_laboral ?? (ibc * tasaLaboral);
      const pat = detalle?.afp_patronal ?? (ibc * tasaPatronal);
      grandIbc += ibc;
      grandLab += lab;
      grandPat += pat;
    }

    lines.push(
      `TOTALES GENERAL;;;${empleados.length} empleados;$${fmt(grandIbc)};$${fmt(grandLab)};$${fmt(grandPat)};$${fmt(grandLab + grandPat)}`
    );

    // Generate CSV with BOM for Excel compatibility
    const csvContent = '\uFEFF' + lines.join('\n');

    const filename = `SEPP-${String(mes).padStart(2, '0')}-${anio}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating AFP SEPP download:', error);
    return NextResponse.json({ error: 'Error al generar archivo SEPP' }, { status: 500 });
  }
}
