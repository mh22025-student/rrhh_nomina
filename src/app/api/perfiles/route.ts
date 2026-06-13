import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// GET /api/perfiles - List perfiles with area and banda info
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const areaId = searchParams.get('area_id') || '';
    const estado = searchParams.get('estado') || '';
    const bandaId = searchParams.get('banda_salarial_id') || '';

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search } },
        { nombre_puesto: { contains: search } },
      ];
    }
    if (areaId) where.area_id = areaId;
    if (estado) where.estado = estado;
    if (bandaId) where.banda_salarial_id = bandaId;

    const perfiles = await db.perfilPuesto.findMany({
      where,
      include: {
        area: { select: { id: true, nombre: true, codigo: true } },
        banda_salarial: { select: { id: true, nombre: true, grado: true, salario_minimo: true, salario_maximo: true } },
        creado_por: { select: { nombre: true, apellido: true } },
        _count: { select: { empleados_perfil: true } },
      },
      orderBy: { fecha_actualizacion: 'desc' },
    });

    return NextResponse.json(perfiles);
  } catch (error) {
    console.error('Error fetching perfiles:', error);
    return NextResponse.json({ error: 'Error al obtener perfiles' }, { status: 500 });
  }
}

// POST /api/perfiles - Create perfil (ADMIN, ANALISTA)
export async function POST(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN', 'ANALISTA')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const body = await request.json();
    const {
      codigo, nombre_puesto, area_id, banda_salarial_id, sector_laboral,
      proposito, funciones_esenciales, requisitos_educacion, requisitos_experiencia,
      requisitos_habilidades, responsabilidades, condiciones_trabajo, puntos_total,
    } = body;

    if (!codigo || !nombre_puesto || !area_id) {
      return NextResponse.json({ error: 'Código, nombre y área son requeridos' }, { status: 400 });
    }

    // Check unique codigo
    const existing = await db.perfilPuesto.findUnique({ where: { codigo } });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un perfil con ese código' }, { status: 409 });
    }

    const perfil = await db.perfilPuesto.create({
      data: {
        codigo,
        nombre_puesto,
        area_id,
        banda_salarial_id: banda_salarial_id || null,
        sector_laboral: sector_laboral || 'COMERCIO',
        proposito: proposito || null,
        funciones_esenciales: funciones_esenciales || null,
        requisitos_educacion: requisitos_educacion || null,
        requisitos_experiencia: requisitos_experiencia || null,
        requisitos_habilidades: requisitos_habilidades || null,
        responsabilidades: responsabilidades || null,
        condiciones_trabajo: condiciones_trabajo || null,
        puntos_total: puntos_total || 0,
        estado: 'BORRADOR',
        version: 1,
        creado_por_id: roleCheck.user.userId,
      },
      include: {
        area: true,
        banda_salarial: true,
      },
    });

    // Create first version
    await db.versionPerfilPuesto.create({
      data: {
        perfil_puesto_id: perfil.id,
        version: 1,
        cambio_descripcion: 'Creación inicial del perfil',
        contenido: JSON.stringify({
          proposito, funciones_esenciales, requisitos_educacion,
          requisitos_experiencia, requisitos_habilidades, responsabilidades,
          condiciones_trabajo,
        }),
        creado_por_id: roleCheck.user.userId,
      },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: roleCheck.user.userId,
        usuario_email: roleCheck.user.email,
        accion: 'CREAR',
        tabla_afectada: 'perfiles_puesto',
        registro_id: perfil.id,
        valor_nuevo: JSON.stringify(perfil),
        nivel_criticidad: 'NORMAL',
        detalle_adicional: `Perfil creado: ${perfil.codigo} - ${perfil.nombre_puesto}`,
      },
    });

    return NextResponse.json(perfil, { status: 201 });
  } catch (error) {
    console.error('Error creating perfil:', error);
    return NextResponse.json({ error: 'Error al crear perfil' }, { status: 500 });
  }
}
