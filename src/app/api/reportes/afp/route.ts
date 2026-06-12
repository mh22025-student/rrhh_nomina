import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/reportes/afp - Generate AFP report data for a period
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
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
        area: { select: { nombre: true } },
      },
      orderBy: { primer_apellido: 'asc' },
    });

    // Find planilla for this period
    const planilla = await db.planilla.findFirst({
      where: {
        tipo: 'MENSUAL',
        estado: { in: ['APROBADA', 'PAGADA'] },
      },
      include: {
        detalles_planilla: true,
        presentaciones_afp: {
          where: { periodo_mes: mes, periodo_anio: anio },
        },
      },
    });

    // Build employee AFP data
    const empleadosAfp = empleados.map((emp) => {
      const ibc = emp.salario_base; // Ingreso Base de Cotización
      const cotizacionLaboral = ibc * tasaLaboral;
      const cotizacionPatronal = ibc * tasaPatronal;

      const detalle = planilla?.detalles_planilla.find(
        (d) => d.empleado_id === emp.id
      );

      return {
        id: emp.id,
        nombre: `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.trim(),
        nup: emp.numero_afp,
        afp_administradora: emp.afp_administradora,
        dui: emp.dui,
        ibc,
        cotizacion_laboral: detalle?.afp_laboral || cotizacionLaboral,
        cotizacion_patronal: detalle?.afp_patronal || cotizacionPatronal,
        area: emp.area?.nombre,
        puesto: emp.perfil_puesto?.nombre_puesto,
      };
    });

    // Separate by AFP admin
    const crecer = empleadosAfp.filter((e) => e.afp_administradora === 'CRECER');
    const confia = empleadosAfp.filter((e) => e.afp_administradora === 'CONFIA');

    const totalIbc = empleadosAfp.reduce((sum, e) => sum + e.ibc, 0);
    const totalCotLab = empleadosAfp.reduce((sum, e) => sum + e.cotizacion_laboral, 0);
    const totalCotPat = empleadosAfp.reduce((sum, e) => sum + e.cotizacion_patronal, 0);

    // Submission tracking
    const presentaciones = planilla?.presentaciones_afp || [];

    return NextResponse.json({
      periodo: { mes, anio },
      parametros: {
        tasa_afp_laboral: tasaLaboral,
        tasa_afp_patronal: tasaPatronal,
      },
      empleados: empleadosAfp,
      por_administradora: {
        CRECER: {
          empleados: crecer,
          total: crecer.length,
          total_cot_laboral: crecer.reduce((s, e) => s + e.cotizacion_laboral, 0),
          total_cot_patronal: crecer.reduce((s, e) => s + e.cotizacion_patronal, 0),
        },
        CONFIA: {
          empleados: confia,
          total: confia.length,
          total_cot_laboral: confia.reduce((s, e) => s + e.cotizacion_laboral, 0),
          total_cot_patronal: confia.reduce((s, e) => s + e.cotizacion_patronal, 0),
        },
      },
      totales: {
        total_empleados: empleadosAfp.length,
        total_ibc: totalIbc,
        total_cotizacion_laboral: totalCotLab,
        total_cotizacion_patronal: totalCotPat,
        total_general: totalCotLab + totalCotPat,
      },
      presentaciones: presentaciones.map((p) => ({
        id: p.id,
        administradora: p.administradora,
        estado: p.estado,
        fecha_presentacion: p.fecha_presentacion,
        archivo_sepp: p.archivo_sepp,
      })),
    });
  } catch (error) {
    console.error('Error generating AFP report:', error);
    return NextResponse.json({ error: 'Error al generar reporte AFP' }, { status: 500 });
  }
}
