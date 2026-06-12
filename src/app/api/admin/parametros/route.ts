import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// GET /api/admin/parametros - List all parametros_legales with tramos and salarios_minimos
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const parametros = await db.parametroLegal.findMany({
      include: {
        tramos_isr: { orderBy: { numero_tramo: 'asc' } },
        salarios_minimos: { orderBy: { sector: 'asc' } },
        creado_por: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fecha_vigencia_desde: 'desc' },
    });

    return NextResponse.json(parametros);
  } catch (error) {
    console.error('Error fetching parametros:', error);
    return NextResponse.json({ error: 'Error al obtener parámetros legales' }, { status: 500 });
  }
}

// POST /api/admin/parametros - Create new parametro_legal (INMUTABILIDAD: never UPDATE, only INSERT)
export async function POST(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN', 'APROBADOR')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const body = await request.json();
    const {
      descripcion_cambio, decreto_norma_origen,
      tasa_isss_laboral, tasa_isss_patronal, tope_cotizacion_isss,
      tasa_afp_laboral, tasa_afp_patronal, tasa_insaforp,
      empleados_minimos_insaforp, fecha_vigencia_desde,
      tramos_isr, salarios_minimos,
    } = body;

    if (!descripcion_cambio || !decreto_norma_origen || !fecha_vigencia_desde) {
      return NextResponse.json(
        { error: 'Descripción, decreto y fecha de vigencia son requeridos' },
        { status: 400 }
      );
    }

    const vigenciaDate = new Date(fecha_vigencia_desde);
    const now = new Date();
    if (vigenciaDate <= now) {
      return NextResponse.json(
        { error: 'La fecha de vigencia debe ser futura' },
        { status: 400 }
      );
    }

    // Replace previous active parameter
    const activeParam = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
    });

    if (activeParam) {
      await db.parametroLegal.update({
        where: { id: activeParam.id },
        data: {
          estado: 'REEMPLAZADO',
          fecha_vigencia_hasta: vigenciaDate,
        },
      });
    }

    // Create new parameter
    const newParam = await db.parametroLegal.create({
      data: {
        descripcion_cambio,
        decreto_norma_origen,
        tasa_isss_laboral: tasa_isss_laboral ?? 0.03,
        tasa_isss_patronal: tasa_isss_patronal ?? 0.075,
        tope_cotizacion_isss: tope_cotizacion_isss ?? 1000.00,
        tasa_afp_laboral: tasa_afp_laboral ?? 0.0725,
        tasa_afp_patronal: tasa_afp_patronal ?? 0.0875,
        tasa_insaforp: tasa_insaforp ?? 0.01,
        empleados_minimos_insaforp: empleados_minimos_insaforp ?? 10,
        fecha_vigencia_desde: vigenciaDate,
        estado: 'ACTIVO',
        creado_por_id: roleCheck.user.userId,
        tramos_isr: {
          create: (tramos_isr || []).map((t: { numero_tramo: number; desde: number; hasta: number | null; porcentaje: number; cuota_fija: number }) => ({
            numero_tramo: t.numero_tramo,
            desde: t.desde,
            hasta: t.hasta,
            porcentaje: t.porcentaje,
            cuota_fija: t.cuota_fija,
          })),
        },
        salarios_minimos: {
          create: (salarios_minimos || []).map((s: { sector: string; salario_mensual: number }) => ({
            sector: s.sector,
            salario_mensual: s.salario_mensual,
          })),
        },
      },
      include: {
        tramos_isr: { orderBy: { numero_tramo: 'asc' } },
        salarios_minimos: { orderBy: { sector: 'asc' } },
      },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: roleCheck.user.userId,
        usuario_email: roleCheck.user.email,
        accion: 'CREAR',
        tabla_afectada: 'parametros_legales',
        registro_id: newParam.id,
        valor_nuevo: JSON.stringify(newParam),
        nivel_criticidad: 'CRITICO',
        detalle_adicional: `Nuevo parámetro legal: ${descripcion_cambio}, vigente desde ${fecha_vigencia_desde}`,
      },
    });

    return NextResponse.json(newParam, { status: 201 });
  } catch (error) {
    console.error('Error creating parametro:', error);
    return NextResponse.json({ error: 'Error al crear parámetro legal' }, { status: 500 });
  }
}
