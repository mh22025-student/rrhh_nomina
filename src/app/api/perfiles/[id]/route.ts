import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// GET /api/perfiles/[id] - Get perfil with versiones
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const perfil = await db.perfilPuesto.findUnique({
      where: { id },
      include: {
        area: true,
        banda_salarial: true,
        creado_por: { select: { nombre: true, apellido: true, email: true } },
        versiones: {
          orderBy: { version: 'desc' },
          include: { creado_por: { select: { nombre: true, apellido: true } } },
        },
        _count: { select: { empleados_perfil: true } },
      },
    });

    if (!perfil) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    return NextResponse.json(perfil);
  } catch (error) {
    console.error('Error fetching perfil:', error);
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}

// PUT /api/perfiles/[id] - Update perfil (create new version)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = requireRoles('ADMIN', 'ANALISTA')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.perfilPuesto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const newVersion = existing.version + 1;
    const cambioDescripcion = body.cambio_descripcion || `Actualización versión ${newVersion}`;

    // Update perfil
    const updated = await db.perfilPuesto.update({
      where: { id },
      data: {
        nombre_puesto: body.nombre_puesto ?? existing.nombre_puesto,
        area_id: body.area_id ?? existing.area_id,
        banda_salarial_id: body.banda_salarial_id ?? existing.banda_salarial_id,
        sector_laboral: body.sector_laboral ?? existing.sector_laboral,
        proposito: body.proposito !== undefined ? body.proposito : existing.proposito,
        funciones_esenciales: body.funciones_esenciales !== undefined ? body.funciones_esenciales : existing.funciones_esenciales,
        requisitos_educacion: body.requisitos_educacion !== undefined ? body.requisitos_educacion : existing.requisitos_educacion,
        requisitos_experiencia: body.requisitos_experiencia !== undefined ? body.requisitos_experiencia : existing.requisitos_experiencia,
        requisitos_habilidades: body.requisitos_habilidades !== undefined ? body.requisitos_habilidades : existing.requisitos_habilidades,
        responsabilidades: body.responsabilidades !== undefined ? body.responsabilidades : existing.responsabilidades,
        condiciones_trabajo: body.condiciones_trabajo !== undefined ? body.condiciones_trabajo : existing.condiciones_trabajo,
        puntos_total: body.puntos_total ?? existing.puntos_total,
        estado: body.estado ?? existing.estado,
        version: newVersion,
      },
    });

    // Create new version record
    await db.VersionPerfilPuesto.create({
      data: {
        perfil_puesto_id: id,
        version: newVersion,
        cambio_descripcion: cambioDescripcion,
        contenido: JSON.stringify({
          proposito: updated.proposito,
          funciones_esenciales: updated.funciones_esenciales,
          requisitos_educacion: updated.requisitos_educacion,
          requisitos_experiencia: updated.requisitos_experiencia,
          requisitos_habilidades: updated.requisitos_habilidades,
          responsabilidades: updated.responsabilidades,
          condiciones_trabajo: updated.condiciones_trabajo,
        }),
        creado_por_id: roleCheck.user.userId,
      },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: roleCheck.user.userId,
        usuario_email: roleCheck.user.email,
        accion: 'ACTUALIZAR',
        tabla_afectada: 'perfiles_puesto',
        registro_id: id,
        valor_anterior: JSON.stringify(existing),
        valor_nuevo: JSON.stringify(updated),
        nivel_criticidad: 'NORMAL',
        detalle_adicional: `Perfil actualizado a versión ${newVersion}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating perfil:', error);
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 });
  }
}

// DELETE /api/perfiles/[id] - Deactivate perfil (set estado=OBSOLETO)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = requireRoles('ADMIN')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const { id } = await params;

    const existing = await db.perfilPuesto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const updated = await db.perfilPuesto.update({
      where: { id },
      data: { estado: 'OBSOLETO' },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: roleCheck.user.userId,
        usuario_email: roleCheck.user.email,
        accion: 'DESACTIVAR',
        tabla_afectada: 'perfiles_puesto',
        registro_id: id,
        valor_anterior: JSON.stringify(existing),
        valor_nuevo: JSON.stringify(updated),
        nivel_criticidad: 'ALTO',
        detalle_adicional: `Perfil desactivado: ${existing.codigo}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error deactivating perfil:', error);
    return NextResponse.json({ error: 'Error al desactivar perfil' }, { status: 500 });
  }
}
