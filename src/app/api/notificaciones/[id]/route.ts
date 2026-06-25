import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import { markRead } from '../route';

// ============================================================
// PUT /api/notificaciones/[id]
// Mark a notification as read.
// Works for BOTH:
//   - Persistent notifications (DB row) → updates `leida` + `fecha_leida`
//   - Dynamic notifications (in-memory Set) → calls markRead(id)
//   - "all" sentinel → marks every DB row + clears in-memory
// ============================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'ID de notificación requerido' }, { status: 400 });
    }

    // Special sentinel: mark ALL as read (route /api/notificaciones/all)
    if (id === 'all') {
      const result = await db.notificacion.updateMany({
        where: { usuario_id: user.userId, leida: false },
        data: { leida: true, fecha_leida: new Date() },
      });
      return NextResponse.json({
        success: true,
        id: 'all',
        marcadas: result.count,
        leida: true,
      });
    }

    // 1. Try DB row first
    const existing = await db.notificacion.findUnique({
      where: { id },
      select: { id: true, usuario_id: true, leida: true },
    });

    if (existing) {
      // Verify ownership
      if (existing.usuario_id !== user.userId) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      if (!existing.leida) {
        await db.notificacion.update({
          where: { id },
          data: { leida: true, fecha_leida: new Date() },
        });
      }
      return NextResponse.json({ success: true, id, leida: true });
    }

    // 2. Otherwise it's a dynamic notification — mark in-memory
    markRead(id);
    return NextResponse.json({ success: true, id, leida: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Error al marcar notificación' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/notificaciones/[id]
// Delete a persistent notification (only if owned by the user).
// Dynamic notifications cannot be deleted (they are recomputed).
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.notificacion.findUnique({
      where: { id },
      select: { id: true, usuario_id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }
    if (existing.usuario_id !== user.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await db.notificacion.delete({ where: { id } });
    return NextResponse.json({ success: true, id, deleted: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Error al eliminar notificación' }, { status: 500 });
  }
}
