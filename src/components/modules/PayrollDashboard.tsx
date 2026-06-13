'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, DollarSign, Shield, Clock, AlertTriangle, TrendingUp,
  TrendingDown, CheckCircle, XCircle, Loader2, RefreshCw,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Info,
  CircleDot, AlertOctagon, ChevronRight, Calculator,
  FileCheck, FileText, Activity, Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

interface PayrollDashboardProps {
  accessToken: string;
  userRole: string;
  onNavigate?: (view: string) => void;
}

interface DashboardData {
  kpis: {
    total_empleados_activos: number;
    tendencia_empleados: string;
    nomina_mes: number;
    cumplimiento_previsional: number;
    semaforo: string;
    planilla_actual: {
      id: string;
      codigo: string;
      estado: string;
      tipo: string;
      calculada_por: string | null;
    } | null;
  };
  cumplimientos: Array<{ nombre: string; presentado: boolean; peso: number }>;
  vencimientos: Array<{ nombre: string; fecha: string; estado: string }>;
  planillas_recientes: Array<{
    id: string;
    codigo: string;
    tipo: string;
    estado: string;
    total_neto: number;
    total_bruto: number;
    empleados: number;
    calculada_por: string | null;
    aprobada_por: string | null;
    fecha_creacion: string;
  }>;
  tendencia_mensual: Array<{ mes: string; total: number }>;
  distribucion_areas: Array<{ nombre: string; total: number }>;
  alertas: Array<{ tipo: string; mensaje: string; severidad: string }>;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};
const fmtDate = (d: string) => {
  try {
    const date = new Date(d);
    return date.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};
const fmtDateTime = (d: string) => {
  try {
    const date = new Date(d);
    return date.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return d;
  }
};
const fmtRelativeTime = (d: string) => {
  try {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return fmtDate(d);
  } catch {
    return d;
  }
};

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-amber-100 text-amber-800 border-amber-200',
  CALCULADA: 'bg-amber-100 text-amber-800 border-amber-200',
  EN_CORRECCION: 'bg-orange-100 text-orange-800 border-orange-200',
  APROBADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PAGADA: 'bg-teal-100 text-teal-800 border-teal-200',
  ANULADA: 'bg-red-100 text-red-800 border-red-200',
};

const estadoDot: Record<string, string> = {
  BORRADOR: 'bg-amber-500',
  CALCULADA: 'bg-amber-500',
  EN_CORRECCION: 'bg-orange-500',
  APROBADA: 'bg-emerald-500',
  PAGADA: 'bg-teal-500',
  ANULADA: 'bg-red-500',
};

const estadoChartColors: Record<string, string> = {
  CALCULADA: '#f59e0b',
  APROBADA: '#10b981',
  PAGADA: '#14b8a6',
  BORRADOR: '#d97706',
  EN_CORRECCION: '#f97316',
  ANULADA: '#ef4444',
};

/* ── Expense Breakdown Data (approximate based on El Salvador law) ── */
interface ExpenseSlice {
  label: string;
  pct: number;
  color: string;
  bgClass: string;
  conicColor: string;
}

const EXPENSE_SLICES: ExpenseSlice[] = [
  { label: 'ISSS Laboral',  pct: 1.4,  color: 'text-sky-700 dark:text-sky-400',    bgClass: 'bg-sky-500',    conicColor: '#0ea5e9' },
  { label: 'AFP Laboral',   pct: 7.25, color: 'text-violet-700 dark:text-violet-400', bgClass: 'bg-violet-500', conicColor: '#8b5cf6' },
  { label: 'ISR',           pct: 16.1, color: 'text-amber-700 dark:text-amber-400',   bgClass: 'bg-amber-500',  conicColor: '#f59e0b' },
  { label: 'Salario Neto',  pct: 63.05,color: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-500', conicColor: '#10b981' },
  { label: 'Cargas Patronales', pct: 12.2, color: 'text-rose-700 dark:text-rose-400', bgClass: 'bg-rose-500', conicColor: '#f43f5e' },
];

/* ── Payroll Status Timeline Steps ── */
const TIMELINE_STEPS = ['CALCULADA', 'APROBADA', 'PAGADA'] as const;

function getTimelineStepIndex(estado: string): number {
  if (estado === 'PAGADA') return 2;
  if (estado === 'APROBADA') return 1;
  if (estado === 'CALCULADA' || estado === 'EN_CORRECCION') return 0;
  if (estado === 'BORRADOR') return -1;
  return -1;
}

/* ── Compliance SVG Ring Component ── */
function ComplianceRing({ percentage, size = 128 }: { percentage: number; size?: number }) {
  const radius = (size / 2) - 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';
  const bgRing = percentage >= 80 ? '#d1fae5' : percentage >= 50 ? '#fef3c7' : '#fee2e2';
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={bgRing} strokeWidth="10" />
        <circle
          cx={center} cy={center} r={radius} fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{percentage}%</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Cumplimiento</span>
      </div>
    </div>
  );
}

/* ── Status Donut Component ── */
function StatusDonut({ statusCounts }: { statusCounts: Record<string, number> }) {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-slate-400">
        <PieChart className="h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
        <p className="text-sm">Sin planillas</p>
      </div>
    );
  }

  let conicStops: string[] = [];
  let cumPct = 0;
  const activeStatuses = Object.entries(statusCounts).filter(([, v]) => v > 0);
  activeStatuses.forEach(([status, count]) => {
    const start = cumPct;
    const pct = (count / total) * 100;
    cumPct += pct;
    const color = estadoChartColors[status] || '#94a3b8';
    conicStops.push(`${color} ${start}% ${cumPct}%`);
  });
  const conicGradient = `conic-gradient(${conicStops.join(', ')})`;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative shrink-0">
        <div
          className="w-32 h-32 rounded-full shadow-inner"
          style={{ background: conicGradient }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-18 h-18 rounded-full bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center" style={{ width: '72px', height: '72px' }}>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{total}</p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500">Total</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-2 w-full">
        {activeStatuses.map(([status, count]) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: estadoChartColors[status] || '#94a3b8' }}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{status}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{count}</span>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Activity Event type ── */
interface ActivityEvent {
  id: string;
  type: 'creation' | 'calculation' | 'approval' | 'payment' | 'correction';
  description: string;
  timestamp: string;
  status: string;
  codigo: string;
}

function buildActivityEvents(planillas: DashboardData['planillas_recientes']): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  planillas.forEach(p => {
    // Creation event
    events.push({
      id: `${p.id}-creation`,
      type: 'creation',
      description: `Planilla ${p.codigo} creada`,
      timestamp: p.fecha_creacion,
      status: 'BORRADOR',
      codigo: p.codigo,
    });

    // If calculated
    if (p.estado !== 'BORRADOR') {
      events.push({
        id: `${p.id}-calc`,
        type: 'calculation',
        description: `Planilla ${p.codigo} calculada — ${p.empleados} empleados, ${fmt(p.total_neto)}`,
        timestamp: p.fecha_creacion,
        status: 'CALCULADA',
        codigo: p.codigo,
      });
    }

    // If approved
    if (p.estado === 'APROBADA' || p.estado === 'PAGADA') {
      events.push({
        id: `${p.id}-approval`,
        type: 'approval',
        description: `Planilla ${p.codigo} aprobada${p.aprobada_por ? ` por ${p.aprobada_por}` : ''}`,
        timestamp: p.fecha_creacion,
        status: 'APROBADA',
        codigo: p.codigo,
      });
    }

    // If paid
    if (p.estado === 'PAGADA') {
      events.push({
        id: `${p.id}-payment`,
        type: 'payment',
        description: `Planilla ${p.codigo} pagada — ${fmt(p.total_neto)}`,
        timestamp: p.fecha_creacion,
        status: 'PAGADA',
        codigo: p.codigo,
      });
    }
  });

  // Sort by most recent first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, 12);
}

const activityTypeIcon: Record<string, React.ReactNode> = {
  creation: <FileText className="h-3.5 w-3.5" />,
  calculation: <Calculator className="h-3.5 w-3.5" />,
  approval: <FileCheck className="h-3.5 w-3.5" />,
  payment: <DollarSign className="h-3.5 w-3.5" />,
  correction: <AlertTriangle className="h-3.5 w-3.5" />,
};

const activityTypeColor: Record<string, string> = {
  creation: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  calculation: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  approval: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  payment: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  correction: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
};

const activityTypeBorder: Record<string, string> = {
  creation: 'border-slate-300 dark:border-slate-600',
  calculation: 'border-amber-300 dark:border-amber-700',
  approval: 'border-emerald-300 dark:border-emerald-700',
  payment: 'border-teal-300 dark:border-teal-700',
  correction: 'border-orange-300 dark:border-orange-700',
};

export default function PayrollDashboard({ accessToken, userRole, onNavigate }: PayrollDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/nomina/dashboard', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al cargar dashboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived data (must be before any early returns) ── */
  const empleadosPagados = useMemo(() => {
    if (!data) return 0;
    return data.planillas_recientes
      .filter(p => p.estado === 'PAGADA')
      .reduce((sum, p) => sum + p.empleados, 0);
  }, [data]);

  const planillasActivas = useMemo(() => {
    if (!data) return 0;
    return data.planillas_recientes.filter(p => p.estado !== 'PAGADA' && p.estado !== 'ANULADA').length;
  }, [data]);

  const statusCounts = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    data.planillas_recientes.forEach(p => {
      counts[p.estado] = (counts[p.estado] || 0) + 1;
    });
    return counts;
  }, [data]);

  const activityEvents = useMemo(() => {
    if (!data) return [];
    return buildActivityEvents(data.planillas_recientes);
  }, [data]);

  const nominaTrend = useMemo(() => {
    if (!data) return { value: 0, direction: 'up' as const };
    if (data.tendencia_mensual.length < 2) return { value: 0, direction: 'up' as const };
    const last = data.tendencia_mensual[data.tendencia_mensual.length - 1].total;
    const prev = data.tendencia_mensual[data.tendencia_mensual.length - 2].total;
    if (prev === 0) return { value: 0, direction: 'up' as const };
    const pctChange = ((last - prev) / prev) * 100;
    return { value: Math.abs(pctChange), direction: pctChange >= 0 ? 'up' as const : 'down' as const };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={fetchData} className="mt-3 text-sm text-emerald-600 hover:underline flex items-center gap-1 mx-auto">
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const maxTendencia = Math.max(...data.tendencia_mensual.map(m => m.total), 1);
  const maxArea = Math.max(...data.distribucion_areas.map(a => a.total), 1);

  const semaforoColor = data.kpis.semaforo === 'verde' ? 'bg-emerald-500' : data.kpis.semaforo === 'amarillo' ? 'bg-amber-500' : 'bg-red-500';
  const semaforoLabel = data.kpis.semaforo === 'verde' ? 'En Cumplimiento' : data.kpis.semaforo === 'amarillo' ? 'Atención Requerida' : 'Incumplimiento';

  /* ── Build conic-gradient for donut chart ── */
  let conicStops: string[] = [];
  let cumPct = 0;
  EXPENSE_SLICES.forEach((s) => {
    const start = cumPct;
    cumPct += s.pct;
    conicStops.push(`${s.conicColor} ${start}% ${cumPct}%`);
  });
  const conicGradient = `conic-gradient(${conicStops.join(', ')})`;

  /* ── Compute actual dollar amounts from planillas_recientes for donut legend ── */
  const baseAmount = data.kpis.nomina_mes || (data.planillas_recientes[0]?.total_bruto ?? 50000);
  const expenseAmounts = EXPENSE_SLICES.map(s => Math.round(baseAmount * (s.pct / 100) * 100) / 100);

  /* ── Find the "current month" index in tendencia_mensual (last non-zero) ── */
  const currentMonthIdx = data.tendencia_mensual.length - 1;

  /* ── Timeline state from planilla_actual ── */
  const timelineActiveStep = data.kpis.planilla_actual
    ? getTimelineStepIndex(data.kpis.planilla_actual.estado)
    : -1;

  return (
    <div className="space-y-5 bg-pattern-dots min-h-full">
      {/* ── Gradient Header with Quick Actions ── */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Dashboard de Nómina
              </h2>
              <p className="text-emerald-100 text-sm mt-0.5">Resumen ejecutivo del sistema de planillas</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* ── Quick Action Buttons ── */}
              <Button
                size="sm"
                className="bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={() => onNavigate?.('04-03')}
              >
                <Calculator className="h-3.5 w-3.5 mr-1.5" />
                Calcular Nómina
              </Button>
              <Button
                size="sm"
                className="bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={() => onNavigate?.('04-04')}
              >
                <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                Aprobar Planilla
              </Button>
              <Button
                size="sm"
                className="bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={() => onNavigate?.('05-01')}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Ver Reportes
              </Button>
              {/* Traffic light */}
              <div className="flex items-center gap-1 p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'rojo' ? 'bg-red-400 shadow-sm shadow-red-400/50' : 'bg-red-900/40'}`} />
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'amarillo' ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-amber-900/40'}`} />
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'verde' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-emerald-900/40'}`} />
              </div>
              <Badge className="bg-white/20 text-white border-0 text-xs">{semaforoLabel}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards (Enhanced) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Nómina del Mes */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-transparent dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-teal-500" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Nómina del Mes</span>
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 group-hover:scale-110 transition-transform duration-300">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight">{fmt(data.kpis.nomina_mes)}</p>
            {/* Mini sparkline bars */}
            <div className="flex items-end gap-0.5 h-5 mt-3 mb-1.5">
              {[30, 45, 55, 40, 60, 70, 50, 65, 80, 75, 85, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-emerald-400/50 dark:bg-emerald-500/30 min-w-[3px] transition-all duration-200 hover:bg-emerald-500/80"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {nominaTrend.direction === 'up' ? (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{nominaTrend.value.toFixed(1)}%</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/30">
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">-{nominaTrend.value.toFixed(1)}%</span>
                </div>
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Empleados Pagados */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-cyan-50/50 to-transparent dark:from-teal-950/30 dark:via-cyan-950/20 dark:to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-teal-500 to-cyan-500" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Empleados Pagados</span>
              <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-900/40 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {empleadosPagados}
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-1.5">de {data.kpis.total_empleados_activos}</span>
            </p>
            {/* Mini progress bar */}
            <div className="mt-3 mb-1.5">
              <Progress
                value={data.kpis.total_empleados_activos > 0 ? (empleadosPagados / data.kpis.total_empleados_activos) * 100 : 0}
                className="h-2 bg-teal-100 dark:bg-teal-900/30"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {data.kpis.tendencia_empleados.startsWith('-') ? (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/30">
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">{data.kpis.tendencia_empleados}%</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/30">
                  <ArrowUpRight className="h-3 w-3 text-teal-500" />
                  <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">+{data.kpis.tendencia_empleados}%</span>
                </div>
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Planillas Activas */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50/50 to-transparent dark:from-amber-950/30 dark:via-orange-950/20 dark:to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-500 to-orange-500" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Planillas Activas</span>
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {planillasActivas}
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-1.5">en proceso</span>
            </p>
            {/* Status dots for active planillas */}
            <div className="flex items-center gap-1.5 mt-3 mb-1.5">
              {data.planillas_recientes
                .filter(p => p.estado !== 'PAGADA' && p.estado !== 'ANULADA')
                .slice(0, 5)
                .map((p, i) => (
                  <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20">
                    <span className={`w-1.5 h-1.5 rounded-full ${estadoDot[p.estado]}`} />
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{p.estado.slice(0, 4)}</span>
                  </div>
                ))
              }
              {planillasActivas === 0 && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Todas pagadas
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{data.planillas_recientes.length} total</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Cumplimiento % */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className={`absolute inset-0 pointer-events-none ${
            data.kpis.semaforo === 'verde'
              ? 'bg-gradient-to-br from-emerald-50 via-green-50/50 to-transparent dark:from-emerald-950/30 dark:via-green-950/20 dark:to-transparent'
              : data.kpis.semaforo === 'amarillo'
                ? 'bg-gradient-to-br from-amber-50 via-yellow-50/50 to-transparent dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-transparent'
                : 'bg-gradient-to-br from-red-50 via-rose-50/50 to-transparent dark:from-red-950/30 dark:via-rose-950/20 dark:to-transparent'
          }`} />
          <div className={`absolute top-0 left-0 w-1.5 h-full ${
            data.kpis.semaforo === 'verde' ? 'bg-gradient-to-b from-emerald-500 to-green-500' :
            data.kpis.semaforo === 'amarillo' ? 'bg-gradient-to-b from-amber-500 to-yellow-500' :
            'bg-gradient-to-b from-red-500 to-rose-500'
          }`} />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Cumplimiento</span>
              <div className="flex items-center gap-1 p-1 bg-slate-900 dark:bg-slate-800 rounded-full">
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'rojo' ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-red-900/40'}`} />
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'amarillo' ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-amber-900/40'}`} />
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'verde' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-emerald-900/40'}`} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ComplianceRing percentage={data.kpis.cumplimiento_previsional} size={96} />
              <div className="flex-1 space-y-2">
                <Badge variant="outline" className={`text-[10px] px-2 border ${
                  data.kpis.semaforo === 'verde' ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' :
                  data.kpis.semaforo === 'amarillo' ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' :
                  'border-red-300 text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                }`}>
                  {semaforoLabel}
                </Badge>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+1.2%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Current Planilla Banner + Status Timeline ── */}
      {data.kpis.planilla_actual && (
        <Card className="shadow-sm border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card hover:shadow-md transition-shadow duration-300">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Planilla en Progreso</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="font-mono font-medium">{data.kpis.planilla_actual.codigo}</span>
                    <span className="mx-1.5">·</span>
                    {data.kpis.planilla_actual.tipo}
                    {data.kpis.planilla_actual.calculada_por && (
                      <>
                        <span className="mx-1.5">·</span>
                        Calculada por: {data.kpis.planilla_actual.calculada_por}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Badge className={`${estadoColors[data.kpis.planilla_actual.estado] || 'bg-slate-100 text-slate-700'} border text-xs font-medium`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${estadoDot[data.kpis.planilla_actual.estado] || 'bg-slate-400'}`} />
                {data.kpis.planilla_actual.estado}
              </Badge>
            </div>

            {/* ── Payroll Status Timeline ── */}
            <div className="mt-4 pt-4 border-t border-emerald-200/60 dark:border-emerald-800/40">
              <div className="flex items-center justify-between relative">
                <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200 dark:bg-slate-700" />
                <div
                  className="absolute top-4 left-[12.5%] h-0.5 bg-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: timelineActiveStep >= 2 ? '75%' : timelineActiveStep >= 1 ? '37.5%' : '0%' }}
                />
                {TIMELINE_STEPS.map((step, idx) => {
                  const isActive = idx === timelineActiveStep;
                  const isCompleted = idx < timelineActiveStep;
                  return (
                    <div key={step} className="flex flex-col items-center relative z-10" style={{ width: '25%' }}>
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500
                        ${isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/30'
                          : isActive
                            ? 'bg-amber-400 border-amber-400 text-white shadow-md shadow-amber-400/30 ring-4 ring-amber-100 dark:ring-amber-900/40'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                        }
                      `}>
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span className={`text-[10px] mt-1.5 font-semibold uppercase tracking-wider ${
                        isCompleted ? 'text-emerald-600 dark:text-emerald-400' :
                        isActive ? 'text-amber-600 dark:text-amber-400' :
                        'text-slate-400 dark:text-slate-500'
                      }`}>
                        {step === 'CALCULADA' ? 'Calculada' : step === 'APROBADA' ? 'Aprobada' : 'Pagada'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main content grid: Planillas Table + Status Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent planillas - improved table */}
        <Card className="shadow-sm lg:col-span-2 hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" /> Planillas Recientes
            </CardTitle>
            <CardDescription>Últimas planillas procesadas</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-slate-50/80 dark:bg-slate-800/50">
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Código</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Tipo</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Estado</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Total Neto</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Empleados</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.planillas_recientes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                          <Info className="h-8 w-8 mb-2 text-slate-300" />
                          <p className="font-medium">No hay planillas registradas</p>
                          <p className="text-xs">Las planillas aparecerán aquí al calcularlas</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.planillas_recientes.map(p => (
                      <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-emerald-50/30 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{p.codigo}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{p.tipo}</td>
                        <td className="p-3">
                          <Badge className={`text-[10px] border ${estadoColors[p.estado] || 'bg-slate-100 text-slate-700'}`} variant="secondary">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${estadoDot[p.estado] || 'bg-slate-400'}`} />
                            {p.estado}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">{fmt(p.total_neto)}</td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-400">{p.empleados}</td>
                        <td className="p-3 text-right text-xs text-slate-500 dark:text-slate-500">{fmtDate(p.fecha_creacion)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Status Summary Donut Widget ── */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-slate-500" /> Estado de Planillas
            </CardTitle>
            <CardDescription>Distribución por estado</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonut statusCounts={statusCounts} />
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row: Enhanced Trend + Donut Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Enhanced Monthly Trend Chart ── */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" /> Tendencia Mensual
            </CardTitle>
            <CardDescription>Total salarios brutos por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {data.tendencia_mensual.every(m => m.total === 0) ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin datos históricos</p>
              </div>
            ) : (
              <div className="relative">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-6 w-14 flex flex-col justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono pr-1">
                  <span>{fmtShort(maxTendencia)}</span>
                  <span>{fmtShort(maxTendencia * 0.75)}</span>
                  <span>{fmtShort(maxTendencia * 0.5)}</span>
                  <span>{fmtShort(maxTendencia * 0.25)}</span>
                  <span>$0</span>
                </div>
                {/* Chart area */}
                <div className="ml-14 relative">
                  {/* Horizontal grid lines */}
                  <div className="absolute inset-0 bottom-6 flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="border-t border-dashed border-slate-200 dark:border-slate-700/50" />
                    ))}
                  </div>
                  {/* Bars container */}
                  <div className="relative flex items-end gap-2 h-48 pt-2 pb-0">
                    {/* Gradient area behind bars */}
                    <div className="absolute inset-0 bottom-0 overflow-hidden rounded-b-lg">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-100/40 via-teal-50/20 to-transparent dark:from-emerald-900/20 dark:via-teal-900/10 dark:to-transparent"
                        style={{ height: '85%' }}
                      />
                    </div>
                    {data.tendencia_mensual.map((m, i) => {
                      const height = Math.max((m.total / maxTendencia) * 160, 6);
                      const isMax = m.total === maxTendencia;
                      const isCurrentMonth = i === currentMonthIdx;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative z-10">
                          {/* Tooltip */}
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm border border-slate-200 dark:border-slate-700">
                            {m.total > 0 ? fmt(m.total) : '-'}
                          </span>
                          {/* Bar with animation */}
                          <div
                            className={`w-full rounded-t-md transition-all duration-700 ease-out min-h-[6px] group-hover:opacity-90 group-hover:brightness-110 relative cursor-pointer ${
                              isCurrentMonth
                                ? 'bg-gradient-to-t from-emerald-700 to-emerald-400 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300/50 dark:ring-emerald-700/50'
                                : isMax
                                  ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                                  : 'bg-gradient-to-t from-teal-500 to-teal-300 dark:from-teal-600 dark:to-teal-400'
                            }`}
                            style={{
                              height: `${height}px`,
                              animation: `barGrow 0.8s ease-out ${i * 0.08}s both`,
                            }}
                          />
                          {/* Current month indicator */}
                          {isCurrentMonth && (
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                          )}
                          <span className={`text-[10px] capitalize font-medium ${
                            isCurrentMonth ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                          }`}>{m.mes}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Expense Breakdown Donut Chart ── */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-slate-500" /> Desglose de Nómina
            </CardTitle>
            <CardDescription>Distribución de deducciones y pago neto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Donut chart */}
              <div className="relative shrink-0">
                <div
                  className="w-36 h-36 rounded-full shadow-inner"
                  style={{ background: conicGradient }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">{fmt(baseAmount)}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500">Total</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2.5 w-full">
                {EXPENSE_SLICES.map((s, i) => (
                  <div key={s.label} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${s.bgClass}`} />
                      <span className={`text-xs font-medium ${s.color} group-hover:underline`}>{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{fmt(expenseAmounts[i])}</span>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {s.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Department Distribution + Activity Timeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Department Distribution with percentages */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" /> Distribución por Área
            </CardTitle>
            <CardDescription>Costo salarial por departamento</CardDescription>
          </CardHeader>
          <CardContent>
            {data.distribucion_areas.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin datos de distribución</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {data.distribucion_areas.slice(0, 8).map((a, i) => {
                  const pct = (a.total / maxArea) * 100;
                  const totalAllAreas = data.distribucion_areas.reduce((s, x) => s + x.total, 0);
                  const pctOfTotal = totalAllAreas > 0 ? ((a.total / totalAllAreas) * 100).toFixed(1) : '0';
                  const colors = [
                    'from-emerald-500 to-emerald-400', 'from-teal-500 to-teal-400', 'from-cyan-500 to-cyan-400', 'from-amber-500 to-amber-400',
                    'from-orange-500 to-orange-400', 'from-rose-500 to-rose-400', 'from-violet-500 to-violet-400', 'from-slate-500 to-slate-400',
                  ];
                  const bgColors = [
                    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-amber-500',
                    'bg-orange-500', 'bg-rose-500', 'bg-violet-500', 'bg-slate-500',
                  ];
                  return (
                    <div key={i} className="space-y-1.5 group">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-sm ${bgColors[i % bgColors.length]}`} />
                          <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{a.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{fmt(a.total)}</span>
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {pctOfTotal}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${colors[i % colors.length]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Activity Timeline ── */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" /> Actividad Reciente
            </CardTitle>
            <CardDescription>Eventos de planillas recientes</CardDescription>
          </CardHeader>
          <CardContent>
            {activityEvents.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin actividad reciente</p>
              </div>
            ) : (
              <div className="relative max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-0">
                  {activityEvents.map((event, idx) => (
                    <div key={event.id} className="relative flex items-start gap-3 py-2.5 group">
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 border-2 ${activityTypeBorder[event.type]} ${activityTypeColor[event.type]} transition-transform duration-200 group-hover:scale-110`}>
                        {activityTypeIcon[event.type]}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">{event.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-[9px] border px-1.5 py-0 ${estadoColors[event.status] || 'bg-slate-100 text-slate-700'}`} variant="secondary">
                            {event.status}
                          </Badge>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{fmtRelativeTime(event.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Compliance Semaphore + Planilla Detail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compliance semaphore - Enhanced with SVG ring */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" /> Semáforo Previsional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* SVG Circular Progress + Traffic light */}
            <div className="flex items-center justify-center gap-6 mb-4">
              <ComplianceRing percentage={data.kpis.cumplimiento_previsional} />
              <div>
                <div className="flex flex-col items-center gap-1.5 p-3 bg-slate-900 dark:bg-slate-800 rounded-2xl shadow-inner">
                  <div className={`w-6 h-6 rounded-full transition-all ${
                    data.kpis.semaforo === 'rojo'
                      ? 'bg-red-500 shadow-lg shadow-red-500/50'
                      : 'bg-red-900/30'
                  }`} />
                  <div className={`w-6 h-6 rounded-full transition-all ${
                    data.kpis.semaforo === 'amarillo'
                      ? 'bg-amber-400 shadow-lg shadow-amber-400/50'
                      : 'bg-amber-900/30'
                  }`} />
                  <div className={`w-6 h-6 rounded-full transition-all ${
                    data.kpis.semaforo === 'verde'
                      ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                      : 'bg-emerald-900/30'
                  }`} />
                </div>
                <p className={`text-sm font-bold text-center mt-2 ${
                  data.kpis.semaforo === 'verde' ? 'text-emerald-600' :
                  data.kpis.semaforo === 'amarillo' ? 'text-amber-600' :
                  'text-red-600'
                }`}>{semaforoLabel}</p>
              </div>
            </div>

            <Separator />

            {/* Compliance items */}
            {data.cumplimientos.map(c => (
              <div key={c.nombre} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-2">
                  {c.presentado ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.nombre}</span>
                </div>
                <Badge variant={c.presentado ? 'default' : 'destructive'} className={`text-[10px] ${c.presentado ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-red-100 text-red-700'}`}>
                  {c.presentado ? 'Presentado' : 'Pendiente'}
                </Badge>
              </div>
            ))}

            <Separator className="my-2" />

            {/* Deadlines */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimientos</p>
              {data.vencimientos.map(v => (
                <div key={v.nombre} className="flex items-center justify-between text-xs bg-orange-50/50 dark:bg-orange-900/20 rounded px-2 py-1.5">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{v.nombre}</span>
                  <span className="font-semibold text-orange-600">{v.fecha}</span>
                </div>
              ))}
              {data.vencimientos.length === 0 && (
                <p className="text-xs text-emerald-600 text-center py-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Todos los pagos al día
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Planilla Detail Card ── */}
        {data.kpis.planilla_actual ? (
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-slate-500" /> Detalle de Estado
              </CardTitle>
              <CardDescription>Información de la planilla actual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Código</span>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">{data.kpis.planilla_actual.codigo}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tipo</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{data.kpis.planilla_actual.tipo}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Estado</span>
                  <Badge className={`${estadoColors[data.kpis.planilla_actual.estado] || 'bg-slate-100 text-slate-700'} border text-xs font-medium`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${estadoDot[data.kpis.planilla_actual.estado] || 'bg-slate-400'}`} />
                    {data.kpis.planilla_actual.estado}
                  </Badge>
                </div>
                {data.kpis.planilla_actual.calculada_por && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Calculada por</span>
                    <span className="text-sm text-slate-900 dark:text-slate-100">{data.kpis.planilla_actual.calculada_por}</span>
                  </div>
                )}

                <Separator className="my-2" />

                {/* Compact timeline */}
                <div className="flex items-center gap-1 pt-1">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const isActive = idx === timelineActiveStep;
                    const isCompleted = idx < timelineActiveStep;
                    return (
                      <React.Fragment key={step}>
                        {idx > 0 && (
                          <ChevronRight className={`h-3 w-3 ${
                            idx <= timelineActiveStep ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                          }`} />
                        )}
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${
                            isCompleted ? 'bg-emerald-500' :
                            isActive ? 'bg-amber-400 animate-pulse' :
                            'bg-slate-300 dark:bg-slate-600'
                          }`} />
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                            isCompleted ? 'text-emerald-600 dark:text-emerald-400' :
                            isActive ? 'text-amber-600 dark:text-amber-400' :
                            'text-slate-400 dark:text-slate-500'
                          }`}>
                            {step === 'CALCULADA' ? 'Calculada' : step === 'APROBADA' ? 'Aprobada' : 'Pagada'}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-slate-500" /> Flujo de Planilla
              </CardTitle>
              <CardDescription>Progreso de la planilla actual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8 text-slate-400">
                <div className="text-center">
                  <CircleDot className="h-8 w-8 mb-2 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">No hay planilla en proceso</p>
                  {onNavigate && (
                    <Button
                      size="sm"
                      className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => onNavigate('04-03')}
                    >
                      <Calculator className="h-3.5 w-3.5 mr-1.5" />
                      Crear Planilla
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alerts with severity icons */}
      {data.alertas.length > 0 && (
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas del Sistema
              <Badge variant="secondary" className="ml-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]">
                {data.alertas.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.alertas.map((a, i) => {
                const isHigh = a.severidad === 'ALTA';
                const isMedium = a.severidad === 'MEDIA';
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border transition-all duration-200 hover:shadow-sm ${
                      isHigh ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300' :
                      isMedium ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300' :
                      'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300'
                    }`}
                  >
                    {isHigh ? (
                      <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
                    ) : isMedium ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
                    ) : (
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-500 dark:text-sky-400" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{a.mensaje}</p>
                      <p className={`text-[10px] mt-0.5 font-semibold uppercase ${
                        isHigh ? 'text-red-500' : isMedium ? 'text-amber-500' : 'text-sky-500'
                      }`}>{a.severidad}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSS Keyframes for bar animation + custom scrollbar */}
      <style jsx>{`
        @keyframes barGrow {
          from {
            height: 0;
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
