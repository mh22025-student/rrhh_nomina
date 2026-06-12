import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// GET /api/empleados/[id] - Get single employee with ALL related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  // EMPLEADO role can only see their own record
  if (user.rol === 'EMPLEADO' && user.empleadoId !== id) {
    return NextResponse.json({ error: 'No tiene permisos para ver este registro' }, { status: 403 });
  }

  const empleado = await db.empleado.findUnique({
    where: { id },
    include: {
      area: true,
      perfil_puesto: { include: { banda_salarial: true } },
      contratos: { orderBy: { fecha_inicio: 'desc' } },
      vacaciones: { orderBy: { anio: 'desc' } },
      documentos: { orderBy: { fecha_creacion: 'desc' } },
      incidencias: { orderBy: { fecha_creacion: 'desc' } },
      cambios_salariales: { orderBy: { fecha_cambio: 'desc' } },
      cambios_cargo: {
        orderBy: { fecha_movimiento: 'desc' },
        include: {
          cargo_anterior: { select: { nombre_puesto: true } },
          cargo_nuevo: { select: { nombre_puesto: true } },
        },
      },
      usuario: { select: { id: true, email: true, rol: true, estado: true } },
    },
  });

  if (!empleado) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ data: empleado });
}

// PUT /api/empleados/[id] - Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();

    // Check employee exists
    const existing = await db.empleado.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // EMPLEADO can only update own limited fields
    if (user.rol === 'EMPLEADO') {
      if (user.empleadoId !== id) {
        return NextResponse.json({ error: 'No tiene permisos para editar este registro' }, { status: 403 });
      }
      // Only allow limited fields for EMPLEADO
      const allowedFields = ['telefono', 'email_personal', 'direccion', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono', 'contacto_emergencia_relacion'];
      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }
      const updated = await db.empleado.update({
        where: { id },
        data: updateData,
      });
      return NextResponse.json({ data: updated });
    }

    // ADMIN, ANALISTA can update all fields
    const roleCheck = requireRoles('ADMIN', 'ANALISTA' as UserRole)(request);
    if ('error' in roleCheck) {
      return roleCheck.error;
    }

    // Check DUI uniqueness if changing
    if (body.dui && body.dui !== existing.dui) {
      const duiRegex = /^\d{8}-\d$/;
      if (!duiRegex.test(body.dui)) {
        return NextResponse.json({ error: 'El formato de DUI debe ser ########-#' }, { status: 400 });
      }
      const existingDui = await db.empleado.findUnique({ where: { dui: body.dui } });
      if (existingDui) {
        return NextResponse.json({ error: 'Ya existe un empleado con este DUI' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
      'apellido_casada', 'dui', 'nit', 'fecha_nacimiento', 'genero', 'estado_civil',
      'direccion', 'telefono', 'email_personal', 'numero_isss', 'numero_afp',
      'afp_administradora', 'tipo_sangre', 'contacto_emergencia_nombre',
      'contacto_emergencia_telefono', 'contacto_emergencia_relacion',
      'nacionalidad', 'fecha_ingreso', 'salario_base', 'perfil_puesto_id', 'area_id', 'estado',
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        if (['fecha_nacimiento', 'fecha_ingreso'].includes(field) && body[field]) {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.empleado.update({
        where: { id },
        data: updateData,
      });

      // Log to bitacora
      await tx.bitacoraAuditoria.create({
        data: {
          usuario_id: user.userId,
          usuario_email: user.email,
          accion: 'ACTUALIZAR_EMPLEADO',
          tabla_afectada: 'empleados',
          registro_id: id,
          valor_anterior: JSON.stringify(existing),
          valor_nuevo: JSON.stringify(updateData),
          nivel_criticidad: 'NORMAL',
          detalle_adicional: `Empleado ${existing.codigo_empleado} actualizado`,
        },
      });

      return updated;
    });

    // Fetch with relations
    const updated = await db.empleado.findUnique({
      where: { id },
      include: {
        area: true,
        perfil_puesto: { include: { banda_salarial: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 });
  }
}

// DELETE /api/empleados/[id] - Deactivate employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = requireRoles('ADMIN' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user } = roleCheck;
  const { id } = await params;

  try {
    const existing = await db.empleado.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    if (existing.estado === 'INACTIVO') {
      return NextResponse.json({ error: 'El empleado ya está inactivo' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.empleado.update({
        where: { id },
        data: {
          estado: 'INACTIVO',
          fecha_salida: new Date(),
        },
      });

      // Deactivate active contracts
      await tx.contrato.updateMany({
        where: { empleado_id: id, activo: true },
        data: { activo: false },
      });

      // Log to bitacora
      await tx.bitacoraAuditoria.create({
        data: {
          usuario_id: user.userId,
          usuario_email: user.email,
          accion: 'DESACTIVAR_EMPLEADO',
          tabla_afectada: 'empleados',
          registro_id: id,
          valor_anterior: JSON.stringify({ estado: existing.estado }),
          valor_nuevo: JSON.stringify({ estado: 'INACTIVO', fecha_salida: new Date().toISOString() }),
          nivel_criticidad: 'ALTO',
          detalle_adicional: `Empleado ${existing.codigo_empleado} desactivado`,
        },
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error deactivating employee:', error);
    return NextResponse.json({ error: 'Error al desactivar empleado' }, { status: 500 });
  }
}
