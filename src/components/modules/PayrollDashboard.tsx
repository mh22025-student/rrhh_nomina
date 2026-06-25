'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, DollarSign, Shield, Clock, AlertTriangle, TrendingUp,
  TrendingDown, CheckCircle, XCircle, Loader2, RefreshCw,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Info,
  CircleDot, AlertOctagon, ChevronRight, Calculator,
  FileCheck, FileText, Activity, Zap, CalendarDays, Hash,
  Timer, Gauge, Play, Target, Layers, Clock4
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
  empleados_por_mes: Array<{ mes: string; count: number }>;
  distribucion_areas: Array<{ nombre: string; total: number }>;
  distribucion_salarial: Array<{ label: string; count: number }>;
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
  CALCULADA: 'bg-sky-100 text-sky-800 border-sky-200',
  EN_CORRECCION: 'bg-orange-100 text-orange-800 border-orange-200',
  APROBADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PAGADA: 'bg-teal-100 text-teal-800 border-teal-200',
  ANULADA: 'bg-red-100 text-red-800 border-red-200',
};

const estadoDot: Record<string, string> = {
  BORRADOR: 'bg-amber-500',
  CALCULADA: 'bg-sky-500',
  EN_CORRECCION: 'bg-orange-500',
  APROBADA: 'bg-emerald-500',
  PAGADA: 'bg-teal-500',
  ANULADA: 'bg-red-500',
};

const estadoChartColors: Record<string, string> = {
  CALCULADA: '#0ea5e9',
  APROBADA: '#10b981',
  PAGADA: '#14b8a6',
  BORRADOR: '#d97706',
  EN_CORRECCION: '#f97316',
  ANULADA: '#ef4444',
};

/* ── Pipeline Steps for the Planilla Status Pipeline ── */
const PIPELINE_STEPS = ['BORRADOR', 'CALCULADA', 'APROBADA', 'PAGADA'] as const;
const PIPELINE_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  CALCULADA: 'Calculada',
  APROBADA: 'Aprobada',
  PAGADA: 'Pagada',
};
const PIPELINE_ICONS: Record<string, React.ReactNode> = {
  BORRADOR: <FileText className="h-4 w-4" />,
  CALCULADA: <Calculator className="h-4 w-4" />,
  APROBADA: <FileCheck className="h-4 w-4" />,
  PAGADA: <DollarSign className="h-4 w-4" />,
};

function getPipelineStepIndex(estado: string): number {
  const idx = PIPELINE_STEPS.indexOf(estado as typeof PIPELINE_STEPS[number]);
  return idx;
}

/* ── Payroll Composition Donut Data ── */
interface CompositionSlice {
  label: string;
  pct: number;
  color: string;
  conicColor: string;
  bgClass: string;
}

const COMPOSITION_SLICES: CompositionSlice[] = [
  { label: 'Salarios Brutos', pct: 55, color: 'text-emerald-700 dark:text-emerald-400', conicColor: '#10b981', bgClass: 'bg-emerald-500' },
  { label: 'Deducciones', pct: 25, color: 'text-amber-700 dark:text-amber-400', conicColor: '#f59e0b', bgClass: 'bg-amber-500' },
  { label: 'Cargas Patronales', pct: 20, color: 'text-rose-700 dark:text-rose-400', conicColor: '#f43f5e', bgClass: 'bg-rose-500' },
];

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

/* ── Mock Employee Count Data (6 months) ── */
const EMPLOYEE_COUNT_HISTORY = [
  { month: 'Oct', count: 72 },
  { month: 'Nov', count: 75 },
  { month: 'Dic', count: 74 },
  { month: 'Ene', count: 78 },
  { month: 'Feb', count: 80 },
  { month: 'Mar', count: 82 },
];

/* ── Mock Salary Distribution Data ── */
const SALARY_RANGES = [
  { label: '<$500', min: 0, max: 500, count: 8, color: 'bg-rose-400' },
  { label: '$500-$1K', min: 500, max: 1000, count: 22, color: 'bg-amber-400' },
  { label: '$1K-$2K', min: 1000, max: 2000, count: 35, color: 'bg-emerald-400' },
  { label: '$2K-$3K', min: 2000, max: 3000, count: 12, color: 'bg-teal-400' },
  { label: '$3K+', min: 3000, max: Infinity, count: 5, color: 'bg-sky-400' },
];

/* ── Distinct color palette for Department/Área distribution bars ── */
interface AreaBarColor { solid: string; gradient: string; }
const AREA_BAR_COLORS: AreaBarColor[] = [
  { solid: '#10b981', gradient: 'linear-gradient(to right, #059669, #34d399)' }, // emerald
  { solid: '#0ea5e9', gradient: 'linear-gradient(to right, #0284c7, #38bdf8)' }, // sky
  { solid: '#f59e0b', gradient: 'linear-gradient(to right, #d97706, #fbbf24)' }, // amber
  { solid: '#8b5cf6', gradient: 'linear-gradient(to right, #7c3aed, #a78bfa)' }, // violet
  { solid: '#ec4899', gradient: 'linear-gradient(to right, #db2777, #f472b6)' }, // pink
  { solid: '#14b8a6', gradient: 'linear-gradient(to right, #0d9488, #2dd4bf)' }, // teal
  { solid: '#f97316', gradient: 'linear-gradient(to right, #ea580c, #fb923c)' }, // orange
  { solid: '#6366f1', gradient: 'linear-gradient(to right, #4f46e5, #818cf8)' }, // indigo
  { solid: '#84cc16', gradient: 'linear-gradient(to right, #65a30d, #a3e635)' }, // lime
  { solid: '#06b6d4', gradient: 'linear-gradient(to right, #0891b2, #22d3ee)' }, // cyan
];

/* ── Color palette for Salary Distribution histogram ── */
const SALARY_COLORS = [
  { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { bar: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400' },
  { bar: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
];

/* ── Compliance Tracker Items ── */
const COMPLIANCE_TRACKER_ITEMS = [
  { name: 'ISSS', deadline: 15, icon: Shield, color: 'emerald' },
  { name: 'AFP', deadline: 15, icon: Target, color: 'teal' },
  { name: 'ISR', deadline: 10, icon: Calculator, color: 'amber' },
  { name: 'INSAFORP', deadline: 30, icon: Layers, color: 'sky' },
] as const;

/* ── Timeline Steps ── */
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

/* ── SVG Sparkline Component ── */
function Sparkline({ data, color = '#10b981', width = 80, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  const areaPoints = [...points, `${padding + w},${padding + h}`, `${padding},${padding + h}`];

  const gradientId = `spark-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints.join(' ')} fill={`url(#${gradientId})`} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last point highlight */}
      {points.length > 0 && (() => {
        const lastPt = points[points.length - 1].split(',');
        return <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill={color} stroke="white" strokeWidth="1.5" />;
      })()}
    </svg>
  );
}

/* ── Payroll Composition Donut Component ── */
function PayrollCompositionDonut({ baseAmount }: { baseAmount: number }) {
  let conicStops: string[] = [];
  let cumPct = 0;
  COMPOSITION_SLICES.forEach((s) => {
    const start = cumPct;
    cumPct += s.pct;
    conicStops.push(`${s.conicColor} ${start}% ${cumPct}%`);
  });
  const conicGradient = `conic-gradient(${conicStops.join(', ')})`;
  const amounts = COMPOSITION_SLICES.map(s => Math.round(baseAmount * (s.pct / 100)));

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0">
        <div
          className="w-40 h-40 rounded-full shadow-lg"
          style={{ background: conicGradient }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-900 shadow-md flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{fmtShort(baseAmount)}</p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500">Total</p>
              </div>
            </div>
          </div>
        </div>
        {/* Percentage labels around donut */}
        {COMPOSITION_SLICES.map((s, i) => {
          const midAngle = ((COMPOSITION_SLICES.slice(0, i).reduce((acc, sl) => acc + sl.pct, 0) + s.pct / 2) / 100) * 360 - 90;
          const rad = (midAngle * Math.PI) / 180;
          const r = 88;
          const cx = 80 + r * Math.cos(rad);
          const cy = 80 + r * Math.sin(rad);
          return (
            <div
              key={s.label}
              className="absolute text-[10px] font-bold"
              style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)', color: s.conicColor }}
            >
              {s.pct}%
            </div>
          );
        })}
      </div>
      <div className="flex-1 space-y-3 w-full">
        {COMPOSITION_SLICES.map((s, i) => (
          <div key={s.label} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.conicColor }} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{fmt(amounts[i])}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 ${s.color}`}>
                {s.pct}%
              </span>
            </div>
          </div>
        ))}
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
    events.push({
      id: `${p.id}-creation`,
      type: 'creation',
      description: `Planilla ${p.codigo} creada`,
      timestamp: p.fecha_creacion,
      status: 'BORRADOR',
      codigo: p.codigo,
    });

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

/* ── El Salvador Clock Component ── */
function ElSalvadorClock({ svTime }: { svTime: Date }) {
  const timeStr = svTime.toLocaleTimeString('es-SV', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const dateStr = svTime.toLocaleDateString('es-SV', {
    timeZone: 'America/El_Salvador',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/15">
      <Clock4 className="h-3.5 w-3.5 text-emerald-200 animate-spin" style={{ animationDuration: '60s' }} />
      <div className="flex flex-col leading-none">
        <span className="text-xs font-mono font-bold text-white tabular-nums">{timeStr}</span>
        <span className="text-[9px] text-emerald-200/80 font-medium uppercase">{dateStr} · SV</span>
      </div>
    </div>
  );
}

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

  /* ── Sparkline data from tendencia_mensual ── */
  const nominaSparkline = useMemo(() => {
    if (!data) return [];
    return data.tendencia_mensual.map(m => m.total);
  }, [data]);

  const empleadosSparkline = useMemo(() => {
    if (!data || data.empleados_por_mes.length === 0) {
      return EMPLOYEE_COUNT_HISTORY.map(e => e.count);
    }
    return data.empleados_por_mes.map(e => e.count);
  }, [data]);

  /* ── Employee count history for the area chart (real data with mock fallback) ── */
  const employeeCountHistory = useMemo(() => {
    if (!data || data.empleados_por_mes.length === 0) {
      return EMPLOYEE_COUNT_HISTORY;
    }
    return data.empleados_por_mes.map(e => ({ month: e.mes.slice(0, 3), count: e.count }));
  }, [data]);

  const planillasSparkline = useMemo(() => {
    if (!data) return [0, 0, 0, 0, 0, 0, 0];
    // Simulate 7 months of planilla counts
    const recent = data.planillas_recientes.length;
    return [Math.max(recent - 2, 0), Math.max(recent - 1, 0), recent, Math.max(recent + 1, 0), recent, Math.max(recent - 1, 0), recent];
  }, [data]);

  const cumplimientoSparkline = useMemo(() => {
    if (!data) return [70, 72, 75, 73, 78, 80, data?.kpis.cumplimiento_previsional || 80];
    const base = data.kpis.cumplimiento_previsional;
    return [base - 8, base - 5, base - 3, base - 6, base - 2, base - 1, base];
  }, [data]);

  /* ── Monthly Comparison (current vs previous month) ── */
  const monthlyComparison = useMemo(() => {
    if (!data || data.planillas_recientes.length === 0) {
      return {
        brutoCurrent: 0, brutoPrev: 0,
        netoCurrent: 0, netoPrev: 0,
        deduccionesCurrent: 0, deduccionesPrev: 0,
      };
    }
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthPlanillas = data.planillas_recientes.filter(p => {
      const d = new Date(p.fecha_creacion);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const prevMonthPlanillas = data.planillas_recientes.filter(p => {
      const d = new Date(p.fecha_creacion);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    const brutoCurrent = currentMonthPlanillas.reduce((s, p) => s + p.total_bruto, 0);
    const brutoPrev = prevMonthPlanillas.reduce((s, p) => s + p.total_bruto, 0);
    const netoCurrent = currentMonthPlanillas.reduce((s, p) => s + p.total_neto, 0);
    const netoPrev = prevMonthPlanillas.reduce((s, p) => s + p.total_neto, 0);
    const deduccionesCurrent = brutoCurrent - netoCurrent;
    const deduccionesPrev = brutoPrev - netoPrev;

    return { brutoCurrent, brutoPrev, netoCurrent, netoPrev, deduccionesCurrent, deduccionesPrev };
  }, [data]);

  /* ── Live payroll status state ── */
  const [svTime, setSvTime] = useState<Date>(new Date());
  useEffect(() => {
    const tick = () => setSvTime(new Date());
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  /* ── Additional stats for Quick Stats Footer ── */
  const [additionalStats, setAdditionalStats] = useState<{
    incidenciasPendientes: number;
    vencimientosProximos: number;
  }>({ incidenciasPendientes: 0, vencimientosProximos: 0 });

  useEffect(() => {
    const fetchAdditional = async () => {
      try {
        const [incRes] = await Promise.all([
          fetch('/api/incidencias', { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null),
          Promise.resolve(null),
        ]);
        if (incRes?.ok) {
          const incData = await incRes.json();
          const incidencias = incData.data || incData.incidencias || incData || [];
          if (Array.isArray(incidencias)) {
            const pending = incidencias.filter((inc: { estado?: string }) =>
              inc.estado === 'PENDIENTE' || inc.estado === 'pendiente'
            );
            setAdditionalStats(prev => ({ ...prev, incidenciasPendientes: pending.length }));
          }
        }
      } catch {
        // silently fail
      }
    };
    fetchAdditional();
  }, [accessToken]);

  // Count upcoming deadlines from vencimientos
  const vencimientosProximos = useMemo(() => {
    if (!data) return 0;
    return data.vencimientos.filter(v => {
      const fecha = new Date(v.fecha);
      const now = new Date();
      const diffDays = Math.ceil((fecha.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 30;
    }).length;
  }, [data]);

  /* ── Compliance Tracker Derived Data ── */
  const complianceTrackerData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return COMPLIANCE_TRACKER_ITEMS.map(item => {
      // Find matching cumplimiento
      const cumplimiento = data?.cumplimientos.find(c => c.nombre.includes(item.name));
      // Find matching vencimiento
      const vencimiento = data?.vencimientos.find(v => v.nombre.includes(item.name));

      // Calculate days remaining from vencimiento
      let daysRemaining = 0;
      let deadlineDate: Date | null = null;
      if (vencimiento) {
        try {
          deadlineDate = new Date(vencimiento.fecha);
          daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        } catch {
          daysRemaining = 0;
        }
      } else {
        // Default: deadline is Nth of current month
        deadlineDate = new Date(currentYear, currentMonth, item.deadline);
        if (deadlineDate < now) {
          deadlineDate = new Date(currentYear, currentMonth + 1, item.deadline);
        }
        daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const isCompliant = cumplimiento?.presentado ?? false;
      const progress = isCompliant ? 100 : Math.max(0, 100 - (daysRemaining < 0 ? 100 : daysRemaining > 30 ? 0 : ((30 - daysRemaining) / 30) * 100));

      return {
        ...item,
        isCompliant,
        daysRemaining,
        deadlineDate,
        progress: Math.round(progress),
      };
    });
  }, [data]);

  /* ── Salary Distribution Derived Data (real data from API, mock fallback) ── */
  const salaryDistribution = useMemo(() => {
    if (!data || !data.distribucion_salarial || data.distribucion_salarial.length === 0) {
      return SALARY_RANGES.map((r, i) => ({ ...r, color: SALARY_COLORS[i].bar, textColor: SALARY_COLORS[i].text }));
    }
    return data.distribucion_salarial.map((s, i) => ({
      label: s.label,
      min: 0, max: Infinity,
      count: s.count,
      color: SALARY_COLORS[i % SALARY_COLORS.length].bar,
      textColor: SALARY_COLORS[i % SALARY_COLORS.length].text,
    }));
  }, [data]);

  /* ── Enhanced Loading Skeleton ── */
  if (loading && !data) {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-xl p-5 text-white shadow-lg">
          <Skeleton className="h-6 w-48 mb-2 bg-white/20" />
          <Skeleton className="h-4 w-72 bg-white/10" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-10 rounded-xl" />
                </div>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="shadow-sm lg:col-span-2">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        </div>
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

  /* ── Build conic-gradient for expense donut chart ── */
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

  /* ── Pipeline state from planilla_actual ── */
  const pipelineActiveIdx = data.kpis.planilla_actual
    ? getPipelineStepIndex(data.kpis.planilla_actual.estado)
    : -1;

  /* ── Salary histogram max ── */
  const maxSalaryCount = Math.max(...salaryDistribution.map(s => s.count), 1);

  return (
    <div className="space-y-5 bg-pattern-dots min-h-full">
      {/* ══════════════════════════════════════════════════════
          SECTION: Gradient Header with Clock + Quick Actions
          ══════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_40%)]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                Dashboard de Nómina
              </h2>
              <p className="text-emerald-100 text-sm mt-1">Resumen ejecutivo del sistema de planillas — El Salvador</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* El Salvador Live Clock */}
              <ElSalvadorClock svTime={svTime} />

              {/* Traffic light */}
              <div className="flex items-center gap-1.5 p-2 bg-white/10 rounded-full backdrop-blur-sm">
                <div className={`w-3.5 h-3.5 rounded-full transition-all duration-500 ${data.kpis.semaforo === 'rojo' ? 'bg-red-400 shadow-sm shadow-red-400/50' : 'bg-red-900/40'}`} />
                <div className={`w-3.5 h-3.5 rounded-full transition-all duration-500 ${data.kpis.semaforo === 'amarillo' ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-amber-900/40'}`} />
                <div className={`w-3.5 h-3.5 rounded-full transition-all duration-500 ${data.kpis.semaforo === 'verde' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-emerald-900/40'}`} />
              </div>
              <Badge className="bg-white/20 text-white border-0 text-xs font-medium">{semaforoLabel}</Badge>
            </div>
          </div>

          {/* Quick Action Buttons - Enhanced */}
          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-400/50 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              onClick={() => onNavigate?.('04-03')}
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-white/20">
                  <Calculator className="h-3.5 w-3.5" />
                </div>
                <span>Calcular Nómina</span>
              </div>
            </Button>
            <Button
              size="sm"
              className="bg-teal-500 hover:bg-teal-400 text-white border border-teal-400/50 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              onClick={() => onNavigate?.('04-04')}
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-white/20">
                  <FileCheck className="h-3.5 w-3.5" />
                </div>
                <span>Aprobar Planilla</span>
              </div>
            </Button>
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500/50 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              onClick={() => onNavigate?.('05-01')}
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-white/20">
                  <BarChart3 className="h-3.5 w-3.5" />
                </div>
                <span>Ver Reportes</span>
              </div>
            </Button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION: Live Payroll Status Indicator
          ══════════════════════════════════════════════════════ */}
      {data.kpis.planilla_actual && (data.kpis.planilla_actual.estado === 'CALCULADA' || data.kpis.planilla_actual.estado === 'EN_CORRECCION') && (
        <div className="relative rounded-xl overflow-hidden shadow-md border border-amber-200 dark:border-amber-800">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-50 via-amber-100/80 to-amber-50 dark:from-amber-950/40 dark:via-amber-900/30 dark:to-amber-950/40" />
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-amber-200/20 via-amber-300/10 to-amber-200/20 dark:from-amber-800/10 dark:via-amber-700/5 dark:to-amber-800/10" />
          <div className="relative z-10 px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping absolute inset-0" />
                <div className="w-3 h-3 rounded-full bg-amber-500 relative z-10 shadow-lg shadow-amber-500/50" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-200">En Proceso</p>
                  <Badge className="bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 text-[10px] border-0">
                    {data.kpis.planilla_actual.estado}
                  </Badge>
                </div>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                  Planilla <span className="font-mono font-semibold">{data.kpis.planilla_actual.codigo}</span> — {data.kpis.planilla_actual.tipo}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Workflow step indicator */}
              <div className="flex items-center gap-1.5">
                {TIMELINE_STEPS.map((step, idx) => {
                  const isActive = idx === timelineActiveStep;
                  const isCompleted = idx < timelineActiveStep;
                  const stepLabels = ['Cálculo', 'Aprobación', 'Pago'];
                  return (
                    <React.Fragment key={step}>
                      {idx > 0 && <ChevronRight className="h-3 w-3 text-amber-400/50 dark:text-amber-600/50" />}
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full transition-all ${
                          isCompleted ? 'bg-emerald-500' :
                          isActive ? 'bg-amber-500 animate-pulse shadow-sm shadow-amber-500/50' :
                          'bg-amber-300/40 dark:bg-amber-700/40'
                        }`} />
                        <span className={`text-[10px] font-medium ${
                          isCompleted ? 'text-emerald-700 dark:text-emerald-400' :
                          isActive ? 'text-amber-800 dark:text-amber-200 font-bold' :
                          'text-amber-500/60 dark:text-amber-500/40'
                        }`}>{stepLabels[idx]}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              {/* Estimated time */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/50 dark:bg-slate-900/30">
                <Timer className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  {svTime.toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit' })} SV
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SECTION DIVIDER: Indicadores Clave
          ══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-1">
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-300 via-teal-300 to-transparent dark:from-emerald-800 dark:via-teal-800 dark:to-transparent" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-600/70 dark:text-emerald-400/70">Indicadores Clave</span>
        <div className="h-px flex-1 bg-gradient-to-l from-emerald-300 via-teal-300 to-transparent dark:from-emerald-800 dark:via-teal-800 dark:to-transparent" />
      </div>

      {/* ── KPI Summary Cards with Sparklines ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Nómina del Mes */}
        <Card className="shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
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
            {/* SVG Sparkline */}
            <div className="mt-3 mb-1.5">
              <Sparkline data={nominaSparkline.length > 0 ? nominaSparkline : [30, 45, 55, 40, 60, 70, 85]} color="#10b981" width={120} height={28} />
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
        <Card className="shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group border-0 ring-1 ring-teal-200/50 dark:ring-teal-800/30">
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
            {/* SVG Sparkline */}
            <div className="mt-3 mb-1.5">
              <Sparkline data={empleadosSparkline} color="#14b8a6" width={120} height={28} />
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
        <Card className="shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group border-0 ring-1 ring-amber-200 dark:ring-amber-800/40">
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
            {/* SVG Sparkline */}
            <div className="mt-3 mb-1.5">
              <Sparkline data={planillasSparkline} color="#f59e0b" width={120} height={28} />
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
        <Card className="shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
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
                {/* SVG Sparkline */}
                <Sparkline data={cumplimientoSparkline} color={data.kpis.semaforo === 'verde' ? '#10b981' : data.kpis.semaforo === 'amarillo' ? '#f59e0b' : '#ef4444'} width={80} height={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION: Planilla Status Pipeline
          ══════════════════════════════════════════════════════ */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-transparent dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-transparent pointer-events-none" />
        <CardHeader className="pb-3 relative">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-500" /> Pipeline de Planilla
          </CardTitle>
          <CardDescription>Flujo de estado de la planilla actual</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-center justify-between relative px-2 sm:px-4">
            {/* Background connecting line */}
            <div className="absolute top-8 left-[8%] right-[8%] h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            {/* Active progress line */}
            <div
              className="absolute top-8 left-[8%] h-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-out"
              style={{ width: pipelineActiveIdx >= 0 ? `${(pipelineActiveIdx / (PIPELINE_STEPS.length - 1)) * 84}%` : '0%' }}
            />

            {PIPELINE_STEPS.map((step, idx) => {
              const isCompleted = idx < pipelineActiveIdx;
              const isActive = idx === pipelineActiveIdx;
              const isPending = idx > pipelineActiveIdx;

              return (
                <div key={step} className="flex flex-col items-center relative z-10" style={{ width: '25%' }}>
                  {/* Step circle */}
                  <div className={`
                    w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all duration-500
                    ${isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : isActive
                        ? 'bg-white dark:bg-slate-900 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-100 dark:ring-emerald-900/50'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <div className="transform transition-transform duration-300" style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)' }}>
                        {PIPELINE_ICONS[step]}
                      </div>
                    )}
                  </div>
                  {/* Step label */}
                  <span className={`text-xs mt-2.5 font-bold uppercase tracking-wider transition-colors duration-300 ${
                    isCompleted ? 'text-emerald-600 dark:text-emerald-400' :
                    isActive ? 'text-emerald-700 dark:text-emerald-300' :
                    'text-slate-400 dark:text-slate-500'
                  }`}>
                    {PIPELINE_LABELS[step]}
                  </span>
                  {/* Active pulse indicator */}
                  {isActive && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Actual</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current planilla info */}
          {data.kpis.planilla_actual && (
            <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Planilla:</span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">{data.kpis.planilla_actual.codigo}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">{data.kpis.planilla_actual.tipo}</span>
              </div>
              <Badge className={`${estadoColors[data.kpis.planilla_actual.estado] || 'bg-slate-100 text-slate-700'} border text-xs font-medium`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${estadoDot[data.kpis.planilla_actual.estado] || 'bg-slate-400'}`} />
                {data.kpis.planilla_actual.estado}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════
          SECTION: Compliance Progress Tracker
          ══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-1">
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-300 via-teal-300 to-transparent dark:from-emerald-800 dark:via-teal-800 dark:to-transparent" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-600/70 dark:text-emerald-400/70">Cumplimiento y Vencimientos</span>
        <div className="h-px flex-1 bg-gradient-to-l from-emerald-300 via-teal-300 to-transparent dark:from-emerald-800 dark:via-teal-800 dark:to-transparent" />
      </div>

      <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50/50 via-emerald-50/20 to-slate-50/50 dark:from-slate-900/50 dark:via-emerald-950/10 dark:to-slate-900/50 pointer-events-none rounded-xl" />
        <CardHeader className="pb-3 relative">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-emerald-500" /> Seguimiento de Cumplimiento
          </CardTitle>
          <CardDescription>Progreso de obligaciones previsionales y plazos</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {complianceTrackerData.map(item => {
              const IconComp = item.icon;
              const colorClasses = {
                emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', ring: 'ring-emerald-200 dark:ring-emerald-800', progress: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' },
                teal: { bg: 'bg-teal-50 dark:bg-teal-950/30', ring: 'ring-teal-200 dark:ring-teal-800', progress: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400' },
                amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', ring: 'ring-amber-200 dark:ring-amber-800', progress: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' },
                sky: { bg: 'bg-sky-50 dark:bg-sky-950/30', ring: 'ring-sky-200 dark:ring-sky-800', progress: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400', iconBg: 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400' },
              }[item.color];

              return (
                <div key={item.name} className={`p-4 rounded-xl ${colorClasses.bg} ring-1 ${colorClasses.ring} transition-all duration-300 hover:shadow-md`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${colorClasses.iconBg}`}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                    </div>
                    {item.isCompliant ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mb-2">
                    <Progress
                      value={item.isCompliant ? 100 : item.progress}
                      className={`h-2.5 ${colorClasses.bg}`}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold uppercase ${item.isCompliant ? 'text-emerald-600 dark:text-emerald-400' : item.daysRemaining <= 5 ? 'text-red-600 dark:text-red-400' : colorClasses.text}`}>
                      {item.isCompliant ? 'Presentado' : 'Pendiente'}
                    </span>
                    <span className={`text-[10px] font-medium ${item.daysRemaining <= 5 && !item.isCompliant ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {item.isCompliant ? '✓ Al día' : item.daysRemaining <= 0 ? 'Vencido' : `${item.daysRemaining} días rest.`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════
          SECTION: Current Planilla Banner + Status Timeline
          ══════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════
          SECTION: Composition Donut + Employee Salary Distribution
          ══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-1">
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-300 via-teal-300 to-transparent dark:from-emerald-800 dark:via-teal-800 dark:to-transparent" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-600/70 dark:text-emerald-400/70">Composición y Distribución</span>
        <div className="h-px flex-1 bg-gradient-to-l from-emerald-300 via-teal-300 to-transparent dark:from-emerald-800 dark:via-teal-800 dark:to-transparent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payroll Composition Donut Chart */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-500" /> Composición de Nómina
            </CardTitle>
            <CardDescription>Desglose de la última planilla</CardDescription>
          </CardHeader>
          <CardContent>
            <PayrollCompositionDonut baseAmount={baseAmount} />
          </CardContent>
        </Card>

        {/* Employee Salary Distribution Histogram */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-500" /> Distribución Salarial
            </CardTitle>
            <CardDescription>Empleados por rango salarial</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salaryDistribution.map((range, idx) => {
                const textColor = range.textColor || 'text-slate-600 dark:text-slate-300';
                return (
                <div key={range.label} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{range.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{range.count}</span>
                      <span className={`text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ${textColor}`}>
                        {data.kpis.total_empleados_activos > 0 ? Math.round((range.count / data.kpis.total_empleados_activos) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden relative">
                      <div
                        className={`h-7 rounded-lg transition-all duration-700 ease-out ${range.color} opacity-85 group-hover:opacity-100`}
                        style={{ width: `${(range.count / maxSalaryCount) * 100}%` }}
                      />
                      {range.count > 0 && (range.count / maxSalaryCount) > 0.15 && (
                        <span className="absolute inset-0 flex items-center pl-3 text-[10px] font-bold text-white/90">
                          {range.count} {range.count === 1 ? 'empleado' : 'empleados'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
              {/* Total indicator */}
              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Empleados</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{data.kpis.total_empleados_activos}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION: Main content grid - Planillas Table + Status Donut
          ══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-1">
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-300 via-teal-300 to-transparent dark:from-emerald-800 dark:via-teal-800 dark:to-transparent" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-600/70 dark:text-emerald-400/70">Planillas y Actividad</span>
        <div className="h-px flex-1 bg-gradient-to-l from-emerald-300 via-teal-300 to-transparent dark:from-emerald-800 dark:via-teal-800 dark:to-transparent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent planillas - improved table */}
        <Card className="shadow-sm lg:col-span-2 hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" /> Planillas Recientes
            </CardTitle>
            <CardDescription>Últimas planillas procesadas</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10">
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
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-teal-500" /> Estado de Planillas
            </CardTitle>
            <CardDescription>Distribución por estado</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonut statusCounts={statusCounts} />
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION: Monthly Comparison + Employee Count
          ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Comparison Widget */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" /> Comparación Mensual
            </CardTitle>
            <CardDescription>Mes actual vs. mes anterior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const brutoDelta = monthlyComparison.brutoPrev > 0
                  ? ((monthlyComparison.brutoCurrent - monthlyComparison.brutoPrev) / monthlyComparison.brutoPrev) * 100
                  : 0;
                const netoDelta = monthlyComparison.netoPrev > 0
                  ? ((monthlyComparison.netoCurrent - monthlyComparison.netoPrev) / monthlyComparison.netoPrev) * 100
                  : 0;
                const dedDelta = monthlyComparison.deduccionesPrev > 0
                  ? ((monthlyComparison.deduccionesCurrent - monthlyComparison.deduccionesPrev) / monthlyComparison.deduccionesPrev) * 100
                  : 0;
                const comparisons = [
                  { label: 'Total Bruto', current: monthlyComparison.brutoCurrent, prev: monthlyComparison.brutoPrev, delta: brutoDelta, color: 'text-emerald-600 dark:text-emerald-400', bgBar: 'bg-emerald-500', bgBarPrev: 'bg-emerald-200 dark:bg-emerald-800' },
                  { label: 'Total Neto', current: monthlyComparison.netoCurrent, prev: monthlyComparison.netoPrev, delta: netoDelta, color: 'text-teal-600 dark:text-teal-400', bgBar: 'bg-teal-500', bgBarPrev: 'bg-teal-200 dark:bg-teal-800' },
                  { label: 'Deducciones', current: monthlyComparison.deduccionesCurrent, prev: monthlyComparison.deduccionesPrev, delta: dedDelta, color: 'text-amber-600 dark:text-amber-400', bgBar: 'bg-amber-500', bgBarPrev: 'bg-amber-200 dark:bg-amber-800' },
                ];
                const maxVal = Math.max(...comparisons.map(c => Math.max(c.current, c.prev)), 1);
                return comparisons.map(comp => (
                  <div key={comp.label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{comp.label}</span>
                      <div className="flex items-center gap-1.5">
                        {comp.delta !== 0 && (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
                            comp.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {comp.delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(comp.delta).toFixed(1)}%
                          </span>
                        )}
                        <span className={`text-sm font-bold font-mono ${comp.color}`}>
                          {fmt(comp.current)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-400 w-8 shrink-0">Actual</span>
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-3 rounded-full ${comp.bgBar} transition-all duration-700`}
                            style={{ width: `${Math.max((comp.current / maxVal) * 100, 2)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-400 w-8 shrink-0">Anterior</span>
                        <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full ${comp.bgBarPrev} transition-all duration-700`}
                            style={{ width: `${Math.max((comp.prev / maxVal) * 100, 2)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono w-16 text-right shrink-0">{fmt(comp.prev)}</span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Employee Count Mini-Chart (CSS-only area chart with gradient fill) */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-500" /> Evolución de Empleados
            </CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="relative h-40">
                {(() => {
                  const history = employeeCountHistory;
                  const maxCount = Math.max(...history.map(e => e.count), 1);
                  const minCount = Math.min(...history.map(e => e.count));
                  const range = maxCount - minCount || 1;
                  const points = history.map((e, i) => {
                    const x = (i / (history.length - 1)) * 100;
                    const y = 100 - ((e.count - minCount) / range) * 80 - 10;
                    return `${x},${y}`;
                  });
                  const areaPoints = [...points, `100,100`, `0,100`];
                  return (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                      <defs>
                        <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points={areaPoints.join(' ')}
                        fill="url(#areaGrad)"
                        className="transition-all duration-700"
                      />
                      <polyline
                        points={points.join(' ')}
                        fill="none"
                        stroke="#14b8a6"
                        strokeWidth="0.8"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {history.map((e, i) => {
                        const x = (i / (history.length - 1)) * 100;
                        const y = 100 - ((e.count - minCount) / range) * 80 - 10;
                        return (
                          <circle key={i} cx={x} cy={y} r="1.5" fill="#14b8a6" stroke="white" strokeWidth="0.5" />
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
              <div className="flex justify-between mt-2 px-1">
                {employeeCountHistory.map((e, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400">{e.count}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">{e.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION: Monthly Trend Bar Chart + Department Distribution
          ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trend Bar Chart */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" /> Tendencia Mensual
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
                {/* Y-axis labels - aligned to the plot area (h-48) */}
                <div className="absolute left-0 top-0 w-14 h-48 flex flex-col justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono pr-1 pt-0">
                  <span className="leading-none">{fmtShort(maxTendencia)}</span>
                  <span className="leading-none">{fmtShort(maxTendencia * 0.75)}</span>
                  <span className="leading-none">{fmtShort(maxTendencia * 0.5)}</span>
                  <span className="leading-none">{fmtShort(maxTendencia * 0.25)}</span>
                  <span className="leading-none">$0</span>
                </div>
                <div className="ml-14 relative">
                  {/* Plot area: gridlines + bars share the exact same h-48 box */}
                  <div className="relative h-48">
                    {/* Horizontal gridlines - 5 lines evenly spaced */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="border-t border-dashed border-slate-200 dark:border-slate-700/50" />
                      ))}
                    </div>
                    {/* Bars */}
                    <div className="absolute inset-0 flex items-end gap-2">
                      {data.tendencia_mensual.map((m, i) => {
                        const barPct = maxTendencia > 0 ? (m.total / maxTendencia) * 100 : 0;
                        const isLast = i === currentMonthIdx;
                        return (
                          <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1 group">
                            {/* Value label - always visible on current month, hover on others */}
                            <div className={`text-[9px] font-mono font-bold transition-opacity duration-200 ${isLast ? 'opacity-100 text-emerald-600 dark:text-emerald-400' : 'opacity-0 group-hover:opacity-100 text-slate-600 dark:text-slate-300'}`}>
                              {fmtShort(m.total)}
                            </div>
                            <div className="w-full flex justify-center px-0.5">
                              <div
                                className={`w-full max-w-[40px] rounded-t-md transition-all duration-700 ease-out cursor-pointer ${
                                  isLast
                                    ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/30'
                                    : 'bg-gradient-to-t from-slate-300 to-slate-200 dark:from-slate-600 dark:to-slate-500 hover:from-emerald-400 hover:to-teal-300'
                                }`}
                                style={{
                                  height: `${barPct}%`,
                                  minHeight: m.total > 0 ? '4px' : '2px',
                                  animationDelay: `${i * 80}ms`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* X-axis labels */}
                  <div className="flex gap-2 mt-2">
                    {data.tendencia_mensual.map((m, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span className={`text-[9px] font-medium ${i === currentMonthIdx ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                          {m.mes.slice(0, 3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4 text-teal-500" /> Distribución por Área
            </CardTitle>
            <CardDescription>Nómina por departamento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {data.distribucion_areas.map((area, i) => {
                const pct = maxArea > 0 ? (area.total / maxArea) * 100 : 0;
                const totalAreas = data.distribucion_areas.reduce((s, a) => s + a.total, 0);
                const sharePct = totalAreas > 0 ? (area.total / totalAreas) * 100 : 0;
                const palette = AREA_BAR_COLORS[i % AREA_BAR_COLORS.length];
                return (
                  <div key={area.nombre} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: palette.solid }} />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">{area.nombre}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{sharePct.toFixed(1)}%</span>
                        <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">{fmt(area.total)}</span>
                      </div>
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all duration-700 ease-out group-hover:brightness-110"
                        style={{
                          width: `${pct}%`,
                          background: palette.gradient,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {data.distribucion_areas.length === 0 && (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <p className="text-sm">Sin datos por área</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION: Activity Timeline + Expense Breakdown
          ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Timeline */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" /> Actividad Reciente
            </CardTitle>
            <CardDescription>Últimos movimientos del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {activityEvents.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin actividad reciente</p>
              </div>
            ) : (
              <div className="relative max-h-96 overflow-y-auto custom-scrollbar pr-1">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-0">
                  {activityEvents.map((event, idx) => (
                    <div key={event.id} className="relative flex items-start gap-3 py-2.5 group">
                      <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 border-2 ${activityTypeBorder[event.type]} ${activityTypeColor[event.type]} transition-transform duration-200 group-hover:scale-110`}>
                        {activityTypeIcon[event.type]}
                      </div>
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

        {/* Expense Breakdown Donut */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-teal-500" /> Desglose de Descuentos
            </CardTitle>
            <CardDescription>Distribución aproximada según ley SV</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative shrink-0">
                <div
                  className="w-36 h-36 rounded-full shadow-lg"
                  style={{ background: conicGradient }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmtShort(baseAmount)}</p>
                        <p className="text-[8px] text-slate-400 dark:text-slate-500">Base</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 w-full">
                {EXPENSE_SLICES.map((s, i) => (
                  <div key={s.label} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.conicColor }} />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{fmt(expenseAmounts[i])}</span>
                      <span className={`text-[10px] font-semibold ${s.color} bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded`}>
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

      {/* ══════════════════════════════════════════════════════
          SECTION: Compliance Semaphore + Planilla Detail
          ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compliance semaphore - Enhanced with SVG ring */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" /> Semáforo Previsional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-emerald-500" /> Detalle de Estado
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
          <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-slate-200 dark:ring-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-emerald-500" /> Flujo de Planilla
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
        <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-0 ring-1 ring-amber-200 dark:ring-amber-800/40">
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

      {/* ══════════════════════════════════════════════════════
          SECTION: Quick Stats Footer
          ══════════════════════════════════════════════════════ */}
      <Card className="shadow-sm border-0 ring-1 ring-slate-200 dark:ring-slate-700/50 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-slate-50/50 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-slate-900/50">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                icon: <Users className="h-3.5 w-3.5" />,
                iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
                value: data.kpis.total_empleados_activos,
                label: 'Empleados Activos',
              },
              {
                icon: <FileText className="h-3.5 w-3.5" />,
                iconBg: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
                value: data.planillas_recientes.length,
                label: 'Planillas Este Mes',
              },
              {
                icon: <AlertTriangle className="h-3.5 w-3.5" />,
                iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
                value: additionalStats.incidenciasPendientes,
                label: 'Incidencias Pendientes',
              },
              {
                icon: <CalendarDays className="h-3.5 w-3.5" />,
                iconBg: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
                value: vencimientosProximos || data.vencimientos.length,
                label: 'Vencimientos',
              },
              {
                icon: <Shield className="h-3.5 w-3.5" />,
                iconBg: `${data.kpis.cumplimiento_previsional >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : data.kpis.cumplimiento_previsional >= 50 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`,
                value: `${data.kpis.cumplimiento_previsional}%`,
                label: 'Cumplimiento',
              },
              {
                icon: <Clock4 className="h-3.5 w-3.5" />,
                iconBg: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
                value: svTime.toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit' }),
                label: 'Hora SV',
              },
            ].map((stat, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 hover:shadow-sm transition-shadow duration-200">
                <div className={`p-1.5 rounded-md ${stat.iconBg} shrink-0`}>
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{stat.value}</p>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate leading-tight">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CSS Keyframes for animations + custom scrollbar */}
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
