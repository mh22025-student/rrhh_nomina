import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// GET /api/usuarios - List users (ADMIN only)
export async function GET(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    db.usuario.findMany({
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        estado: true,
        ultimo_login: true,
        debe_cambiar_password: true,
        empleado_id: true,
        fecha_creacion: true,
        empleado: {
          select: { codigo_empleado: true, primer_nombre: true, primer_apellido: true },
        },
      },
      orderBy: { fecha_creacion: 'desc' },
      skip,
      take: pageSize,
    }),
    db.usuario.count(),
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

// POST /api/usuarios - Create user (ADMIN only)
export async function POST(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user: adminUser } = roleCheck;

  try {
    const body = await request.json();

    // Validate required fields
    const required = ['email', 'password', 'nombre', 'apellido', 'rol'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `El campo ${field} es requerido` }, { status: 400 });
      }
    }

    // Validate role
    const validRoles = ['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR', 'EMPLEADO'];
    if (!validRoles.includes(body.rol)) {
      return NextResponse.json({ error: `Rol inválido. Válidos: ${validRoles.join(', ')}` }, { status: 400 });
    }

    // Check email uniqueness
    const existingUser = await db.usuario.findUnique({ where: { email: body.email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Ya existe un usuario con este correo' }, { status: 400 });
    }

    // Validate password length
    if (body.password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const passwordHash = await hashPassword(body.password);

    const nuevoUsuario = await db.usuario.create({
      data: {
        email: body.email,
        password_hash: passwordHash,
        nombre: body.nombre,
        apellido: body.apellido,
        rol: body.rol,
        estado: 'ACTIVO',
        debe_cambiar_password: true,
        empleado_id: body.empleado_id || null,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        estado: true,
        debe_cambiar_password: true,
        fecha_creacion: true,
      },
    });

    // Log to bitacora
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: adminUser.userId,
        usuario_email: adminUser.email,
        accion: 'CREAR_USUARIO',
        tabla_afectada: 'usuarios',
        registro_id: nuevoUsuario.id,
        valor_nuevo: JSON.stringify({ email: body.email, rol: body.rol }),
        nivel_criticidad: 'ALTO',
        detalle_adicional: `Usuario ${body.email} creado con rol ${body.rol}`,
      },
    });

    return NextResponse.json({ data: nuevoUsuario }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
