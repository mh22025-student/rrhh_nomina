import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// GET /api/admin/integraciones - List integraciones_externas
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const integraciones = await db.integracionExterna.findMany({
      include: {
        logs: {
          orderBy: { fecha_creacion: 'desc' },
          take: 10,
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return NextResponse.json(integraciones);
  } catch (error) {
    console.error('Error fetching integraciones:', error);
    return NextResponse.json({ error: 'Error al obtener integraciones' }, { status: 500 });
  }
}

// POST /api/admin/integraciones - Create integración
export async function POST(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const body = await request.json();
    const { tipo, nombre, configuracion, credenciales_cifradas } = body;

    if (!tipo || !nombre) {
      return NextResponse.json({ error: 'Tipo y nombre son requeridos' }, { status: 400 });
    }

    const integracion = await db.integracionExterna.create({
      data: {
        tipo,
        nombre,
        configuracion: configuracion ? JSON.stringify(configuracion) : null,
        credenciales_cifradas: credenciales_cifradas || null,
      },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: roleCheck.user.userId,
        usuario_email: roleCheck.user.email,
        accion: 'CREAR',
        tabla_afectada: 'integraciones_externas',
        registro_id: integracion.id,
        valor_nuevo: JSON.stringify(integracion),
        nivel_criticidad: 'ALTO',
        detalle_adicional: `Integración creada: ${integracion.nombre} (${integracion.tipo})`,
      },
    });

    return NextResponse.json(integracion, { status: 201 });
  } catch (error) {
    console.error('Error creating integracion:', error);
    return NextResponse.json({ error: 'Error al crear integración' }, { status: 500 });
  }
}

// PUT /api/admin/integraciones - Update integración (test connection)
export async function PUT(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const body = await request.json();
    const { id, nombre, configuracion, credenciales_cifradas, activo, test } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de integración requerido' }, { status: 400 });
    }

    const existing = await db.integracionExterna.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Integración no encontrada' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (configuracion !== undefined) updateData.configuracion = JSON.stringify(configuracion);
    if (credenciales_cifradas !== undefined) updateData.credenciales_cifradas = credenciales_cifradas;
    if (activo !== undefined) updateData.activo = activo;

    // Test connection simulation
    if (test) {
      const testResult = Math.random() > 0.2 ? 'EXITOSO' : 'FALLIDO';
      updateData.estado_test = testResult;
      updateData.ultimo_test = new Date();

      // Create log entry
      await db.logIntegracion.create({
        data: {
          integracion_id: id,
          tipo_operacion: 'TEST_CONNECTION',
          estado: testResult,
          mensaje_error: testResult === 'FALLIDO' ? 'No se pudo establecer conexión' : null,
          duracion_ms: Math.floor(Math.random() * 2000) + 100,
        },
      });
    }

    const updated = await db.integracionExterna.update({
      where: { id },
      data: updateData,
      include: { logs: { orderBy: { fecha_creacion: 'desc' }, take: 10 } },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: roleCheck.user.userId,
        usuario_email: roleCheck.user.email,
        accion: 'ACTUALIZAR',
        tabla_afectada: 'integraciones_externas',
        registro_id: id,
        valor_anterior: JSON.stringify(existing),
        valor_nuevo: JSON.stringify(updated),
        nivel_criticidad: 'NORMAL',
        detalle_adicional: `Integración actualizada: ${existing.nombre}${test ? ' (con test de conexión)' : ''}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating integracion:', error);
    return NextResponse.json({ error: 'Error al actualizar integración' }, { status: 500 });
  }
}
