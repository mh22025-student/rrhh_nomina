import { db } from '@/lib/db';
import type { UserRole } from '@/lib/auth';

// ============================================================
// Notification helper — creates persistent Notificacion rows
// targeting specific users (by ID or by role).
// ============================================================

export type NotificationTipo =
  | 'SOLICITUD'
  | 'INCIDENCIA'
  | 'MENSAJE'
  | 'VENCIMIENTO'
  | 'PLANILLA'
  | 'SISTEMA';

export type NotificationPrioridad = 'BAJA' | 'MEDIA' | 'ALTA';

export interface CreateNotificationInput {
  usuario_id: string;
  tipo: NotificationTipo;
  titulo: string;
  mensaje: string;
  link?: string;
  entidad_tipo?: string;
  entidad_id?: string;
  prioridad?: NotificationPrioridad;
}

/**
 * Create a single notification for a specific user.
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    return await db.notificacion.create({
      data: {
        usuario_id: input.usuario_id,
        tipo: input.tipo,
        titulo: input.titulo,
        mensaje: input.mensaje,
        link: input.link || null,
        entidad_tipo: input.entidad_tipo || null,
        entidad_id: input.entidad_id || null,
        prioridad: input.prioridad || 'MEDIA',
      },
    });
  } catch (err) {
    // Never let a notification failure break the parent flow
    console.error('[notifications] createNotification error:', err);
    return null;
  }
}

/**
 * Broadcast a notification to every user with one of the given roles.
 * Used to alert RRHH/ADMIN when an employee submits a new solicitud.
 */
export async function notifyByRole(
  roles: UserRole[],
  input: Omit<CreateNotificationInput, 'usuario_id'>
) {
  try {
    const usuarios = await db.usuario.findMany({
      where: {
        rol: { in: roles },
        estado: 'ACTIVO',
      },
      select: { id: true },
    });

    if (usuarios.length === 0) return [];

    const rows = usuarios.map((u) => ({
      usuario_id: u.id,
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje,
      link: input.link || null,
      entidad_tipo: input.entidad_tipo || null,
      entidad_id: input.entidad_id || null,
      prioridad: input.prioridad || 'MEDIA',
    }));

    // Prisma createMany for efficiency
    await db.notificacion.createMany({ data: rows });
    return rows;
  } catch (err) {
    console.error('[notifications] notifyByRole error:', err);
    return [];
  }
}

/**
 * Notify a specific employee (looked up by empleado_id) — used to send
 * "your request was approved/rejected" notifications back to the employee.
 */
export async function notifyEmpleado(
  empleadoId: string,
  input: Omit<CreateNotificationInput, 'usuario_id'>
) {
  try {
    const empleado = await db.empleado.findUnique({
      where: { id: empleadoId },
      select: { usuario: { select: { id: true } } },
    });

    if (!empleado?.usuario?.id) return null;

    return await createNotification({
      ...input,
      usuario_id: empleado.usuario.id,
    });
  } catch (err) {
    console.error('[notifications] notifyEmpleado error:', err);
    return null;
  }
}

// ============================================================
// Human-readable labels for notification tipos (used by API + UI)
// ============================================================
export const NOTIFICATION_TIPO_LABELS: Record<NotificationTipo, string> = {
  SOLICITUD: 'Solicitud',
  INCIDENCIA: 'Incidencia',
  MENSAJE: 'Mensaje',
  VENCIMIENTO: 'Vencimiento',
  PLANILLA: 'Planilla',
  SISTEMA: 'Sistema',
};
