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

function determinarTramo(rentaImponible: number, tramos: { desde: number; hasta: number | null; porcentaje: number; cuota_fija: number }[]): string {
  for (const tramo of tramos) {
    const limiteSuperior = tramo.hasta ?? Infinity;
    if (rentaImponible >= tramo.desde && rentaImponible < limiteSuperior) {
      return `Tramo ${tramo.porcentaje * 100}%`;
    }
  }
  return 'Sin tramo';
}

// GET /api/reportes/isr/download - Download ISR F-910 report as CSV
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

    // Get active legal parameters with tramos
    const parametro = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      include: {
        tramos_isr: { orderBy: { numero_tramo: 'asc' } },
      },
    });

    if (!parametro) {
      return NextResponse.json({ error: 'No hay parámetros legales vigentes' }, { status: 404 });
    }

    // Get active employees
    const empleados = await db.empleado.findMany({
      where: { estado: 'ACTIVO' },
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
    lines.push(`F-910 - Formulario de Retenciones ISR;Ministerio de Hacienda El Salvador`);
    lines.push(`Periodo;${MESES[mes]} ${anio}`);
    lines.push(`Fecha de Generación;${fmtDate(new Date())}`);
    lines.push(`Tasa ISSS Laboral;${(parametro.tasa_isss_laboral * 100).toFixed(1)}%`);
    lines.push(`Tasa AFP Laboral;${(parametro.tasa_afp_laboral * 100).toFixed(2)}%`);
    lines.push(`Tope ISSS;$${fmt(parametro.tope_cotizacion_isss)}`);

    // ISR Tramo parameters
    lines.push('');
    lines.push('Tramos ISR:');
    lines.push('Tramo;Desde;Hasta;Porcentaje;Cuota Fija');
    for (const tramo of parametro.tramos_isr) {
      const hasta = tramo.hasta ? `$${fmt(tramo.hasta)}` : 'En adelante';
      lines.push(`${tramo.numero_tramo};$${fmt(tramo.desde)};${hasta};${(tramo.porcentaje * 100).toFixed(2)}%;$${fmt(tramo.cuota_fija)}`);
    }
    lines.push('');

    // Column headers
    lines.push(
      'DUI;Nombre del Trabajador;Salario Bruto;ISSS Laboral;AFP Laboral;Renta Neta;ISR Retenido;Tramo ISR'
    );

    // Data rows
    let totalSalarioBruto = 0;
    let totalIsssLaboral = 0;
    let totalAfpLaboral = 0;
    let totalRentaNeta = 0;
    let totalIsrRetenido = 0;

    for (const emp of empleados) {
      const salarioBruto = emp.salario_base;
      const isssLaboral = Math.min(salarioBruto, parametro.tope_cotizacion_isss) * parametro.tasa_isss_laboral;
      const afpLaboral = salarioBruto * parametro.tasa_afp_laboral;
      const deducciones = isssLaboral + afpLaboral;
      const rentaImponible = Math.max(0, salarioBruto - deducciones);

      // Calculate ISR using tramos
      let isrRetenido = 0;
      for (const tramo of parametro.tramos_isr) {
        if (rentaImponible >= tramo.desde) {
          const limiteSuperior = tramo.hasta ?? Infinity;
          if (rentaImponible < limiteSuperior) {
            isrRetenido = (rentaImponible - tramo.desde) * tramo.porcentaje + tramo.cuota_fija;
            break;
          }
        }
      }

      // Use planilla detail if available
      const detalle = planilla?.detalles_planilla.find(
        (d) => d.empleado_id === emp.id
      );

      const sssLab = detalle?.isss_laboral ?? isssLaboral;
      const aLab = detalle?.afp_laboral ?? afpLaboral;
      const rentaNeta = detalle?.renta_imponible ?? rentaImponible;
      const isr = detalle?.isr_retenido ?? isrRetenido;
      const tramoLabel = determinarTramo(rentaNeta, parametro.tramos_isr);

      totalSalarioBruto += salarioBruto;
      totalIsssLaboral += sssLab;
      totalAfpLaboral += aLab;
      totalRentaNeta += rentaNeta;
      totalIsrRetenido += isr;

      const nombre = `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.trim();

      lines.push(
        `${emp.dui};${nombre};$${fmt(salarioBruto)};$${fmt(sssLab)};$${fmt(aLab)};$${fmt(rentaNeta)};$${fmt(isr)};${tramoLabel}`
      );
    }

    // Totals row
    lines.push('');
    lines.push(
      `TOTALES;${empleados.length} empleados;$${fmt(totalSalarioBruto)};$${fmt(totalIsssLaboral)};$${fmt(totalAfpLaboral)};$${fmt(totalRentaNeta)};$${fmt(totalIsrRetenido)};`
    );

    // Generate CSV with BOM for Excel compatibility
    const csvContent = '\uFEFF' + lines.join('\n');

    const filename = `F-910-${String(mes).padStart(2, '0')}-${anio}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating ISR F-910 download:', error);
    return NextResponse.json({ error: 'Error al generar archivo F-910' }, { status: 500 });
  }
}
