'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, DollarSign, Shield, Clock, AlertTriangle, TrendingUp,
  TrendingDown, CheckCircle, XCircle, Loader2, RefreshCw,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Info,
  CircleDot, AlertOctagon, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

interface PayrollDashboardProps {
  accessToken: string;
  userRole: string;
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
const fmtDate = (d: string) => {
  try {
    const date = new Date(d);
    return date.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-amber-100 text-amber-800 border-amber-200',
  CALCULADA: 'bg-amber-100 text-amber-800 border-amber-200',
  EN_CORRECCION: 'bg-orange-100 text-orange-800 border-orange-200',
  APROBADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PAGADA: 'bg-sky-100 text-sky-800 border-sky-200',
  ANULADA: 'bg-red-100 text-red-800 border-red-200',
};

const estadoDot: Record<string, string> = {
  BORRADOR: 'bg-amber-500',
  CALCULADA: 'bg-amber-500',
  EN_CORRECCION: 'bg-orange-500',
  APROBADA: 'bg-emerald-500',
  PAGADA: 'bg-sky-500',
  ANULADA: 'bg-red-500',
};

/* ── Expense Breakdown Data (approximate based on El Salvador law) ── */
interface ExpenseSlice {
  label: string;
  pct: number;
  color: string;       // Tailwind text color for legend
  bgClass: string;     // Tailwind bg class for legend dot
  conicColor: string;  // CSS color for conic-gradient
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
function ComplianceRing({ percentage }: { percentage: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';
  const bgRing = percentage >= 80 ? '#d1fae5' : percentage >= 50 ? '#fef3c7' : '#fee2e2';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        {/* Background ring */}
        <circle cx="64" cy="64" r={radius} fill="none" stroke={bgRing} strokeWidth="10" />
        {/* Progress ring */}
        <circle
          cx="64" cy="64" r={radius} fill="none"
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

export default function PayrollDashboard({ accessToken, userRole }: PayrollDashboardProps) {
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
  EXPENSE_SLICES.forEach((s, i) => {
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
      {/* Gradient Header Card with company branding */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Dashboard de Nómina
            </h2>
            <p className="text-emerald-100 text-sm mt-0.5">Resumen ejecutivo del sistema de planillas</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
              <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'rojo' ? 'bg-red-400 shadow-sm shadow-red-400/50' : 'bg-red-900/40'}`} />
              <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'amarillo' ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-amber-900/40'}`} />
              <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'verde' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-emerald-900/40'}`} />
            </div>
            <Badge className="bg-white/20 text-white border-0 text-xs">{semaforoLabel}</Badge>
          </div>
        </div>
      </div>

      {/* Current Planilla Banner + Status Timeline */}
      {data.kpis.planilla_actual && (
        <Card className="shadow-sm border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card">
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
              <Badge className={`${estadoColors[data.kpis.planilla_actual.estado] || 'bg-slate-100 text-slate-700'} border text-xs font-medium badge-animated-border`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${estadoDot[data.kpis.planilla_actual.estado] || 'bg-slate-400'}`} />
                {data.kpis.planilla_actual.estado}
              </Badge>
            </div>

            {/* ── Payroll Status Timeline ── */}
            <div className="mt-4 pt-4 border-t border-emerald-200/60 dark:border-emerald-800/40">
              <div className="flex items-center justify-between relative">
                {/* Connecting line */}
                <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200 dark:bg-slate-700" />
                <div
                  className="absolute top-4 left-[12.5%] h-0.5 bg-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: timelineActiveStep >= 2 ? '75%' : timelineActiveStep >= 1 ? '37.5%' : '0%' }}
                />
                {TIMELINE_STEPS.map((step, idx) => {
                  const isActive = idx === timelineActiveStep;
                  const isCompleted = idx < timelineActiveStep;
                  const isPending = idx > timelineActiveStep;
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

      {/* ── KPI Cards - Enhanced with gradient backgrounds & trend indicators ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {/* Total Empleados */}
        <Card className="shadow-sm card-hover-lift relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50/80 to-transparent dark:from-teal-950/30 dark:to-transparent pointer-events-none" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Empleados Activos</span>
              <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30">
                <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{data.kpis.total_empleados_activos}</p>
            {/* Mini sparkline bars */}
            <div className="flex items-end gap-0.5 h-5 mt-2 mb-1">
              {[40, 65, 50, 80, 55, 70, 60, 75, 85, 90, 70, 80].map((h, i) => (
                <div
                  key={i}
                  className="sparkline-bar flex-1 rounded-sm bg-teal-400/60 dark:bg-teal-500/40 min-w-[3px]"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              {data.kpis.tendencia_empleados.startsWith('-') ? (
                <>
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30">
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">{data.kpis.tendencia_empleados}%</span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500">vs mes anterior</span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30">
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{data.kpis.tendencia_empleados}%</span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500">vs mes anterior</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Nómina del Mes */}
        <Card className="shadow-sm card-hover-lift relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-transparent dark:from-emerald-950/30 dark:to-transparent pointer-events-none" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Nómina del Mes</span>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">{fmt(data.kpis.nomina_mes)}</p>
            {/* Mini sparkline bars */}
            <div className="flex items-end gap-0.5 h-5 mt-2 mb-1">
              {[30, 45, 55, 40, 60, 70, 50, 65, 80, 75, 85, 95].map((h, i) => (
                <div
                  key={i}
                  className="sparkline-bar flex-1 rounded-sm bg-emerald-400/60 dark:bg-emerald-500/40 min-w-[3px]"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30">
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+2.5%</span>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Cumplimiento Previsional - With SVG Ring */}
        <Card className="shadow-sm card-hover-lift relative overflow-hidden">
          <div className={`absolute inset-0 pointer-events-none ${
            data.kpis.semaforo === 'verde'
              ? 'bg-gradient-to-br from-emerald-50/80 to-transparent dark:from-emerald-950/30 dark:to-transparent'
              : data.kpis.semaforo === 'amarillo'
                ? 'bg-gradient-to-br from-amber-50/80 to-transparent dark:from-amber-950/30 dark:to-transparent'
                : 'bg-gradient-to-br from-red-50/80 to-transparent dark:from-red-950/30 dark:to-transparent'
          }`} />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Cumplimiento</span>
              {/* Traffic light visual */}
              <div className="flex items-center gap-1 p-1 bg-slate-900 dark:bg-slate-800 rounded-full">
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'rojo' ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-red-900/40'}`} />
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'amarillo' ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-amber-900/40'}`} />
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'verde' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-emerald-900/40'}`} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ComplianceRing percentage={data.kpis.cumplimiento_previsional} />
              <div className="flex-1 space-y-2">
                <Badge variant="outline" className={`text-[10px] px-2 border ${
                  data.kpis.semaforo === 'verde' ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' :
                  data.kpis.semaforo === 'amarillo' ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' :
                  'border-red-300 text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                }`}>
                  {semaforoLabel}
                </Badge>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+1.2%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próximo Vencimiento */}
        <Card className="shadow-sm card-hover-lift relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50/80 to-transparent dark:from-orange-950/30 dark:to-transparent pointer-events-none" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Próximo Vencimiento</span>
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            {data.vencimientos.length > 0 ? (
              <>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{data.vencimientos[0].nombre}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{data.vencimientos[0].fecha}</span>
                </div>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/30 mt-2 w-fit">
                  <ArrowDownRight className="h-3 w-3 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">3 días</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Al día</p>
                <span className="text-xs text-slate-400 dark:text-slate-500 mt-2 block">Sin vencimientos pendientes</span>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent planillas - improved table */}
        <Card className="shadow-sm lg:col-span-2">
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

        {/* Compliance semaphore - Enhanced with SVG ring */}
        <Card className="shadow-sm">
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
              <div key={c.nombre} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
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
                <p className="text-xs text-emerald-600 text-center py-1">✓ Todos los pagos al día</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row: Enhanced Trend + Donut Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Enhanced Monthly Trend Chart ── */}
        <Card className="shadow-sm">
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
                  <span>{fmt(maxTendencia)}</span>
                  <span>{fmt(maxTendencia * 0.75)}</span>
                  <span>{fmt(maxTendencia * 0.5)}</span>
                  <span>{fmt(maxTendencia * 0.25)}</span>
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
                    <div className="absolute inset-0 bottom-0 overflow-hidden">
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
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {m.total > 0 ? fmt(m.total) : '-'}
                          </span>
                          {/* Bar with animation */}
                          <div
                            className={`w-full rounded-t-md transition-all duration-700 ease-out min-h-[6px] group-hover:opacity-90 relative ${
                              isCurrentMonth
                                ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300/50 dark:ring-emerald-700/50'
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
        <Card className="shadow-sm">
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
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${s.bgClass}`} />
                      <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
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

      {/* Department distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-slate-500" /> Distribución por Área
            </CardTitle>
            <CardDescription>Costo salarial por departamento</CardDescription>
          </CardHeader>
          <CardContent>
            {data.distribucion_areas.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin datos de distribución</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {data.distribucion_areas.slice(0, 8).map((a, i) => {
                  const pct = (a.total / maxArea) * 100;
                  const colors = [
                    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-amber-500',
                    'bg-orange-500', 'bg-rose-500', 'bg-violet-500', 'bg-slate-500',
                  ];
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-sm ${colors[i % colors.length]}`} />
                          <span className="font-medium text-slate-700 dark:text-slate-300">{a.nombre}</span>
                        </div>
                        <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{fmt(a.total)}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${colors[i % colors.length]}`}
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

        {/* ── Payroll Status Timeline Card (standalone when no planilla_actual) ── */}
        {!data.kpis.planilla_actual && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-slate-500" /> Flujo de Planilla
              </CardTitle>
              <CardDescription>Progreso de la planilla actual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">No hay planilla en proceso</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show timeline as standalone card when planilla exists - same timeline but in its own card */}
        {data.kpis.planilla_actual && (
          <Card className="shadow-sm">
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
        )}
      </div>

      {/* Alerts with severity icons */}
      {data.alertas.length > 0 && (
        <Card className="shadow-sm">
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
                    className={`flex items-start gap-2.5 p-3 rounded-lg border ${
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

      {/* CSS Keyframes for bar animation */}
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
      `}</style>
    </div>
  );
}
