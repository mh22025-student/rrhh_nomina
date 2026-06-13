import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { markRead } from '../route';

// ============================================================
// PUT /api/notificaciones/[id]
// Mark a notification as read
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

    // Mark as read in the in-memory set
    markRead(id);

    return NextResponse.json({
      success: true,
      id,
      leida: true,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Error al marcar notificación' }, { status: 500 });
  }
}
