import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// GET /api/empleados - List employees with pagination, search, filters
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const search = searchParams.get('search') || '';
  const areaId = searchParams.get('area_id') || '';
  const estado = searchParams.get('estado') || '';
  const perfilPuestoId = searchParams.get('perfil_puesto_id') || '';

  const where: Record<string, unknown> = {};

  // EMPLEADO role can only see their own record
  if (user.rol === 'EMPLEADO') {
    where.usuario = { id: user.userId };
  }

  // Search by name, DUI, or codigo
  if (search) {
    where.OR = [
      { primer_nombre: { contains: search } },
      { segundo_nombre: { contains: search } },
      { primer_apellido: { contains: search } },
      { segundo_apellido: { contains: search } },
      { dui: { contains: search } },
      { codigo_empleado: { contains: search } },
    ];
  }

  if (areaId) where.area_id = areaId;
  if (estado) where.estado = estado;
  if (perfilPuestoId) where.perfil_puesto_id = perfilPuestoId;

  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    db.empleado.findMany({
      where,
      include: {
        area: { select: { id: true, nombre: true, codigo: true } },
        perfil_puesto: { select: { id: true, nombre_puesto: true, codigo: true } },
      },
      orderBy: { primer_apellido: 'asc' },
      skip,
      take: pageSize,
    }),
    db.empleado.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

// POST /api/empleados - Create new employee
export async function POST(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN', 'ANALISTA' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user } = roleCheck;

  try {
    const body = await request.json();

    // Validate required fields
    const required = ['primer_nombre', 'primer_apellido', 'dui', 'fecha_ingreso', 'area_id', 'perfil_puesto_id', 'tipo_contrato', 'salario_base_contrato', 'tipo_jornada', 'fecha_inicio'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `El campo ${field} es requerido` }, { status: 400 });
      }
    }

    // Validate DUI format
    const duiRegex = /^\d{8}-\d$/;
    if (!duiRegex.test(body.dui)) {
      return NextResponse.json({ error: 'El formato de DUI debe ser ########-#' }, { status: 400 });
    }

    // Check DUI uniqueness
    const existingDui = await db.empleado.findUnique({ where: { dui: body.dui } });
    if (existingDui) {
      return NextResponse.json({ error: 'Ya existe un empleado con este DUI' }, { status: 400 });
    }

    // Check NIT uniqueness if provided
    if (body.nit) {
      const existingNit = await db.empleado.findUnique({ where: { nit: body.nit } });
      if (existingNit) {
        return NextResponse.json({ error: 'Ya existe un empleado con este NIT' }, { status: 400 });
      }
    }

    // Validate salario_base_contrato against salario mínimo
    const perfil = await db.perfilPuesto.findUnique({
      where: { id: body.perfil_puesto_id },
      include: { banda_salarial: true },
    });
    if (!perfil) {
      return NextResponse.json({ error: 'Perfil de puesto no encontrado' }, { status: 400 });
    }

    // Get salario mínimo for the sector
    const paramLegal = await db.parametroLegal.findFirst({
      where: { estado: 'ACTIVO' },
      orderBy: { fecha_vigencia_desde: 'desc' },
      include: { salarios_minimos: true },
    });
    if (paramLegal) {
      const salarioMinimo = paramLegal.salarios_minimos.find(
        s => s.sector === (perfil.sector_laboral || 'COMERCIO')
      );
      if (salarioMinimo && body.salario_base_contrato < salarioMinimo.salario_mensual) {
        return NextResponse.json({
          error: `El salario base ($${body.salario_base_contrato.toFixed(2)}) es menor al salario mínimo legal para el sector ${perfil.sector_laboral || 'COMERCIO'} ($${salarioMinimo.salario_mensual.toFixed(2)})`,
        }, { status: 400 });
      }
    }

    // Auto-generate codigo_empleado
    const lastEmployee = await db.empleado.findFirst({
      orderBy: { codigo_empleado: 'desc' },
      select: { codigo_empleado: true },
    });
    let nextNumber = 1;
    if (lastEmployee?.codigo_empleado) {
      const numPart = lastEmployee.codigo_empleado.replace('EMP-', '');
      nextNumber = parseInt(numPart) + 1;
    }
    const codigo_empleado = `EMP-${String(nextNumber).padStart(5, '0')}`;

    // Create employee + contract + vacation in a transaction
    const result = await db.$transaction(async (tx) => {
      const empleado = await tx.empleado.create({
        data: {
          codigo_empleado,
          primer_nombre: body.primer_nombre,
          segundo_nombre: body.segundo_nombre || null,
          primer_apellido: body.primer_apellido,
          segundo_apellido: body.segundo_apellido || null,
          apellido_casada: body.apellido_casada || null,
          dui: body.dui,
          nit: body.nit || null,
          fecha_nacimiento: body.fecha_nacimiento ? new Date(body.fecha_nacimiento) : null,
          genero: body.genero || null,
          estado_civil: body.estado_civil || null,
          direccion: body.direccion || null,
          telefono: body.telefono || null,
          email_personal: body.email_personal || null,
          numero_isss: body.numero_isss || null,
          numero_afp: body.numero_afp || null,
          afp_administradora: body.afp_administradora || null,
          tipo_sangre: body.tipo_sangre || null,
          contacto_emergencia_nombre: body.contacto_emergencia_nombre || null,
          contacto_emergencia_telefono: body.contacto_emergencia_telefono || null,
          contacto_emergencia_relacion: body.contacto_emergencia_relacion || null,
          nacionalidad: body.nacionalidad || 'Salvadoreña',
          fecha_ingreso: new Date(body.fecha_ingreso),
          salario_base: body.salario_base_contrato,
          perfil_puesto_id: body.perfil_puesto_id,
          area_id: body.area_id,
          estado: 'ACTIVO',
        },
      });

      // Create contract
      await tx.contrato.create({
        data: {
          empleado_id: empleado.id,
          perfil_puesto_id: body.perfil_puesto_id,
          tipo_contrato: body.tipo_contrato,
          salario_base_contrato: body.salario_base_contrato,
          tipo_jornada: body.tipo_jornada,
          fecha_inicio: new Date(body.fecha_inicio),
          fecha_fin: body.fecha_fin ? new Date(body.fecha_fin) : null,
          activo: true,
          observaciones: body.observaciones || null,
        },
      });

      // Create vacation record for current year
      const currentYear = new Date().getFullYear();
      await tx.vacacionEmpleado.create({
        data: {
          empleado_id: empleado.id,
          anio: currentYear,
          dias_derecho: 15,
          dias_tomados: 0,
          dias_pendientes: 15,
          dias_vendidos: 0,
          estado: 'ABIERTO',
        },
      });

      // Log to bitacora
      await tx.bitacoraAuditoria.create({
        data: {
          usuario_id: user.userId,
          usuario_email: user.email,
          accion: 'CREAR_EMPLEADO',
          tabla_afectada: 'empleados',
          registro_id: empleado.id,
          valor_nuevo: JSON.stringify({ codigo: codigo_empleado, nombre: `${body.primer_nombre} ${body.primer_apellido}`, dui: body.dui }),
          nivel_criticidad: 'NORMAL',
          detalle_adicional: `Empleado creado con código ${codigo_empleado}`,
        },
      });

      return empleado;
    });

    // Fetch with relations
    const empleado = await db.empleado.findUnique({
      where: { id: result.id },
      include: {
        area: { select: { id: true, nombre: true, codigo: true } },
        perfil_puesto: { select: { id: true, nombre_puesto: true, codigo: true } },
      },
    });

    return NextResponse.json({ data: empleado }, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 });
  }
}
