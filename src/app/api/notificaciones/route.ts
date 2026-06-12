import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

// In-memory set tracking read notification IDs (per server instance)
const readNotificationIds = new Set<string>();

/**
 * Check if a notification ID has been marked as read (server-side)
 */
export function isRead(notifId: string): boolean {
  return readNotificationIds.has(notifId);
}

/**
 * Mark a notification ID as read (server-side)
 */
export function markRead(notifId: string): void {
  readNotificationIds.add(notifId);
}

// ============================================================
// GET /api/notificaciones
// Generate dynamic notifications based on real data
// ============================================================
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const soloNoLeidas = searchParams.get('solo_no_leidas') === 'true';

  try {
    const notificaciones: Array<{
      id: string;
      tipo: 'VENCIMIENTO' | 'PLANILLA' | 'INCIDENCIA' | 'SISTEMA';
      titulo: string;
      mensaje: string;
      fecha: string;
      leida: boolean;
      link?: string;
    }> = [];

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // -------------------------------------------------------
    // 1. VENCIMIENTOS (compliance deadlines)
    // -------------------------------------------------------
    // Check ISSS presentation status
    const isssPresentado = await db.historialPresentacionISSS.findFirst({
      where: { periodo_mes: currentMonth, periodo_anio: currentYear, estado: 'PRESENTADO' },
    });

    if (!isssPresentado) {
      const day15 = new Date(currentYear, currentMonth - 1, 15);
      const diasISSS = Math.ceil((day15.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isNotifRead = isRead(`venc-isss-${currentYear}-${String(currentMonth).padStart(2, '0')}`);

      if (diasISSS > 0) {
        const fechaStr = day15.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        notificaciones.push({
          id: `venc-isss-${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          tipo: 'VENCIMIENTO',
          titulo: 'Vencimiento ISSS',
          mensaje: `La planilla ISSS vence en ${diasISSS} día${diasISSS > 1 ? 's' : ''} (${fechaStr})`,
          fecha: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
          leida: isNotifRead,
          link: '05-01',
        });
      } else if (diasISSS <= 0 && diasISSS > -5) {
        const fechaStr = day15.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        notificaciones.push({
          id: `venc-isss-${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          tipo: 'VENCIMIENTO',
          titulo: 'ISSS Vencida',
          mensaje: `La planilla ISSS venció el ${fechaStr}. Presentar a la brevedad.`,
          fecha: new Date(now.getTime() - Math.random() * 7200000).toISOString(),
          leida: isNotifRead,
          link: '05-01',
        });
      }
    }

    // Check AFP presentation status
    const afpPresentado = await db.historialPresentacionAFP.findFirst({
      where: { periodo_mes: currentMonth, periodo_anio: currentYear, estado: 'PRESENTADO' },
    });

    if (!afpPresentado) {
      const day20 = new Date(currentYear, currentMonth - 1, 20);
      const diasAFP = Math.ceil((day20.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isNotifRead = isRead(`venc-afp-${currentYear}-${String(currentMonth).padStart(2, '0')}`);

      if (diasAFP > 0) {
        const fechaStr = day20.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        notificaciones.push({
          id: `venc-afp-${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          tipo: 'VENCIMIENTO',
          titulo: 'Vencimiento AFP',
          mensaje: `La planilla AFP vence en ${diasAFP} día${diasAFP > 1 ? 's' : ''} (${fechaStr})`,
          fecha: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
          leida: isNotifRead,
          link: '05-02',
        });
      } else if (diasAFP <= 0 && diasAFP > -5) {
        const fechaStr = day20.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        notificaciones.push({
          id: `venc-afp-${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          tipo: 'VENCIMIENTO',
          titulo: 'AFP Vencida',
          mensaje: `La planilla AFP venció el ${fechaStr}. Presentar a la brevedad.`,
          fecha: new Date(now.getTime() - Math.random() * 7200000).toISOString(),
          leida: isNotifRead,
          link: '05-02',
        });
      }
    }

    // Check ISR presentation status
    const isrEntero = await db.historialEnteroISR.findFirst({
      where: { periodo_mes: currentMonth, periodo_anio: currentYear, estado: 'ENTERADO' },
    });

    if (!isrEntero) {
      const day10Next = new Date(currentYear, currentMonth, 10);
      const diasISR = Math.ceil((day10Next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isNotifRead = isRead(`venc-isr-${currentYear}-${String(currentMonth).padStart(2, '0')}`);

      if (diasISR > 0 && diasISR <= 15) {
        const fechaStr = day10Next.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        notificaciones.push({
          id: `venc-isr-${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          tipo: 'VENCIMIENTO',
          titulo: 'Vencimiento ISR F-910',
          mensaje: `La declaración ISR vence en ${diasISR} día${diasISR > 1 ? 's' : ''} (${fechaStr})`,
          fecha: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
          leida: isNotifRead,
          link: '05-03',
        });
      } else if (diasISR <= 0 && diasISR > -5) {
        const fechaStr = day10Next.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        notificaciones.push({
          id: `venc-isr-${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          tipo: 'VENCIMIENTO',
          titulo: 'ISR F-910 Vencida',
          mensaje: `La declaración ISR venció el ${fechaStr}. Enterar a la brevedad.`,
          fecha: new Date(now.getTime() - Math.random() * 7200000).toISOString(),
          leida: isNotifRead,
          link: '05-03',
        });
      }
    }

    // -------------------------------------------------------
    // 2. PLANILLA Status Changes
    // -------------------------------------------------------
    // Only show for roles that handle planillas
    if (['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR'].includes(user.rol)) {
      // Planillas in CALCULADA state (pending approval)
      const planillasCalculadas = await db.planilla.findMany({
        where: { estado: 'CALCULADA' },
        orderBy: { fecha_creacion: 'desc' },
        take: 5,
      });

      for (const p of planillasCalculadas) {
        const isNotifRead = isRead(`planilla-calc-${p.id}`);
        notificaciones.push({
          id: `planilla-calc-${p.id}`,
          tipo: 'PLANILLA',
          titulo: 'Planilla Pendiente de Aprobación',
          mensaje: `La planilla ${p.codigo_planilla} está calculada y requiere aprobación. Total: $${p.total_neto_a_pagar.toFixed(2)}`,
          fecha: p.fecha_creacion.toISOString(),
          leida: isNotifRead,
          link: '04-04',
        });
      }

      // Planillas recently approved (in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const planillasAprobadas = await db.planilla.findMany({
        where: {
          estado: 'APROBADA',
          fecha_aprobacion: { gte: sevenDaysAgo },
        },
        orderBy: { fecha_aprobacion: 'desc' },
        take: 3,
      });

      for (const p of planillasAprobadas) {
        const isNotifRead = isRead(`planilla-aprob-${p.id}`);
        notificaciones.push({
          id: `planilla-aprob-${p.id}`,
          tipo: 'PLANILLA',
          titulo: 'Planilla Aprobada',
          mensaje: `La planilla ${p.codigo_planilla} ha sido aprobada. Lista para dispersión.`,
          fecha: (p.fecha_aprobacion || p.fecha_creacion).toISOString(),
          leida: isNotifRead,
          link: '04-05',
        });
      }
    }

    // -------------------------------------------------------
    // 3. INCIDENCIAS Pendientes
    // -------------------------------------------------------
    if (['ADMIN', 'ANALISTA', 'APROBADOR'].includes(user.rol)) {
      const incidenciasPendientes = await db.incidenciaNomina.count({
        where: { estado: 'PENDIENTE' },
      });

      if (incidenciasPendientes > 0) {
        const isNotifRead = isRead(`inc-pend-${currentYear}-${String(currentMonth).padStart(2, '0')}`);
        notificaciones.push({
          id: `inc-pend-${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          tipo: 'INCIDENCIA',
          titulo: 'Incidencias Pendientes',
          mensaje: `Hay ${incidenciasPendientes} incidencia${incidenciasPendientes > 1 ? 's' : ''} pendiente${incidenciasPendientes > 1 ? 's' : ''} de revisión`,
          fecha: new Date(now.getTime() - 1800000).toISOString(),
          leida: isNotifRead,
          link: '02-04',
        });
      }
    }

    // -------------------------------------------------------
    // 4. SISTEMA Alerts
    // -------------------------------------------------------
    // Employees missing ISSS number
    if (['ADMIN', 'ANALISTA'].includes(user.rol)) {
      const sinISSS = await db.empleado.count({ where: { estado: 'ACTIVO', numero_isss: null } });
      if (sinISSS > 0) {
        const isNotifRead = isRead(`sys-sin-isss`);
        notificaciones.push({
          id: `sys-sin-isss`,
          tipo: 'SISTEMA',
          titulo: 'Datos Incompletos',
          mensaje: `${sinISSS} empleado${sinISSS > 1 ? 's' : ''} sin número ISSS registrado`,
          fecha: new Date(now.getTime() - 7200000).toISOString(),
          leida: isNotifRead,
          link: '02-01',
        });
      }

      // Employees missing AFP number
      const sinAFP = await db.empleado.count({ where: { estado: 'ACTIVO', numero_afp: null } });
      if (sinAFP > 0) {
        const isNotifRead = isRead(`sys-sin-afp`);
        notificaciones.push({
          id: `sys-sin-afp`,
          tipo: 'SISTEMA',
          titulo: 'Datos Incompletos',
          mensaje: `${sinAFP} empleado${sinAFP > 1 ? 's' : ''} sin número AFP registrado`,
          fecha: new Date(now.getTime() - 7500000).toISOString(),
          leida: isNotifRead,
          link: '02-01',
        });
      }

      // Employees without active contract
      const sinContrato = await db.empleado.count({
        where: {
          estado: 'ACTIVO',
          contratos: { none: { activo: true } },
        },
      });
      if (sinContrato > 0) {
        const isNotifRead = isRead(`sys-sin-contrato`);
        notificaciones.push({
          id: `sys-sin-contrato`,
          tipo: 'SISTEMA',
          titulo: 'Sin Contrato Activo',
          mensaje: `${sinContrato} empleado${sinContrato > 1 ? 's' : ''} sin contrato activo`,
          fecha: new Date(now.getTime() - 8000000).toISOString(),
          leida: isNotifRead,
          link: '02-01',
        });
      }
    }

    // Sort by fecha descending (newest first)
    notificaciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Filter if solo_no_leidas
    const filtered = soloNoLeidas ? notificaciones.filter(n => !n.leida) : notificaciones;
    const totalNoLeidas = notificaciones.filter(n => !n.leida).length;

    return NextResponse.json({
      notificaciones: filtered,
      total_no_leidas: totalNoLeidas,
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
  }
}
