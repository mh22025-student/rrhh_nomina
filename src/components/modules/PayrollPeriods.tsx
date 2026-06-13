'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Calendar, Loader2, RefreshCw, AlertCircle, Clock,
  FileText, CheckCircle, DollarSign, Users, Filter, TrendingUp,
  CalendarDays, ChevronLeft, ChevronRight, Eye, ThumbsUp, SendHorizonal,
  CircleDot, CircleCheck, Circle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface PayrollPeriodsProps {
  accessToken: string;
  userRole: string;
}

interface Planilla {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  total_empleados: number;
  total_salarios_brutos: number;
  total_neto_a_pagar: number;
  total_deducciones?: number;
  total_cargas_patronales?: number;
  calculada_por: string | null;
  aprobada_por: string | null;
  fecha_calculo: string | null;
  fecha_aprobacion: string | null;
  observaciones: string | null;
  fecha_creacion: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  CALCULADA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  EN_CORRECCION: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  APROBADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  PAGADA: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const estadoLabels: Record<string, string> = {
  BORRADOR: 'Borrador',
  CALCULADA: 'Calculada',
  EN_CORRECCION: 'En Corrección',
  APROBADA: 'Aprobada',
  PAGADA: 'Pagada',
};

const borderColors: Record<string, string> = {
  BORRADOR: 'border-l-slate-400',
  CALCULADA: 'border-l-amber-400',
  EN_CORRECCION: 'border-l-orange-400',
  APROBADA: 'border-l-emerald-400',
  PAGADA: 'border-l-green-500',
};

const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

// Full workflow steps for progress bar
const fullWorkflowSteps = [
  { key: 'BORRADOR', label: 'Borrador' },
  { key: 'CALCULADA', label: 'Calculada' },
  { key: 'APROBADA', label: 'Aprobación' },
  { key: 'DISPERSION', label: 'Dispersión' },
  { key: 'PAGADA', label: 'Pagada' },
] as const;

function getFullWorkflowProgress(estado: string): number {
  const idx = fullWorkflowSteps.findIndex((s) => s.key === estado);
  if (estado === 'EN_CORRECCION') return 1; // Back to calculated
  return idx >= 0 ? idx : 0;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

export default function PayrollPeriods({ accessToken, userRole }: PayrollPeriodsProps) {
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<Planilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTipo, setNewTipo] = useState('MENSUAL');
  const [newFechaInicio, setNewFechaInicio] = useState('');
  const [newFechaFin, setNewFechaFin] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');
  const [typeFilter, setTypeFilter] = useState<string>('TODAS');
  const [selectedPlanilla, setSelectedPlanilla] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<number | null>(null);

  const fetchPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/planillas?limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al cargar planillas');
      const data = await res.json();
      setPlanillas(data.planillas || []);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron cargar las planillas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { fetchPlanillas(); }, [fetchPlanillas]);

  const handleCreate = async () => {
    if (!newFechaInicio || !newFechaFin) {
      toast({ title: 'Error', description: 'Complete las fechas del período', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/nomina/calcular', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoInicio: newFechaInicio, periodoFin: newFechaFin, tipo: newTipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear planilla');
      toast({ title: 'Planilla Calculada', description: `${data.planilla.codigo_planilla} — ${data.planilla.total_empleados} empleados, ${fmt(data.planilla.total_neto_a_pagar)}` });
      setShowNew(false);
      setNewFechaInicio('');
      setNewFechaFin('');
      fetchPlanillas();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al crear planilla', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Filtered planillas
  const filteredPlanillas = useMemo(() => {
    return planillas.filter(p => {
      const startDate = new Date(p.fecha_inicio_periodo);
      if (startDate.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && startDate.getMonth() !== selectedMonth) return false;
      if (statusFilter !== 'TODAS' && p.estado !== statusFilter) return false;
      if (typeFilter !== 'TODAS' && p.tipo !== typeFilter) return false;
      return true;
    });
  }, [planillas, selectedYear, selectedMonth, statusFilter, typeFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredPlanillas.length;
    const allPlanillasForStats = planillas.filter(p => {
      const startDate = new Date(p.fecha_inicio_periodo);
      return startDate.getFullYear() === selectedYear && (selectedMonth === null || startDate.getMonth() === selectedMonth);
    });
    const nomMes = allPlanillasForStats
      .filter(p => p.estado === 'PAGADA' || p.estado === 'APROBADA')
      .reduce((sum, p) => sum + p.total_neto_a_pagar, 0);
    const proxArr = allPlanillasForStats
      .filter(p => ['BORRADOR', 'CALCULADA', 'EN_CORRECCION'].includes(p.estado))
      .sort((a, b) => new Date(a.fecha_fin_periodo).getTime() - new Date(b.fecha_fin_periodo).getTime());
    const totalEmpleados = allPlanillasForStats.length > 0
      ? Math.max(...allPlanillasForStats.map(p => p.total_empleados))
      : 0;
    return {
      total,
      nominaDelMes: nomMes,
      proximoVencimiento: proxArr.length > 0 ? proxArr[0] : null,
      proximoVencimientoArr: proxArr,
      empleados: totalEmpleados,
    };
  }, [filteredPlanillas, planillas, selectedYear, selectedMonth]);

  const { nominaDelMes, proximoVencimientoArr } = stats;
  const empleadosNomina = stats.empleados;
  const proximoVencimiento = proximoVencimientoArr;

  // Current period: most recent CALCULADA or EN_CORRECCION
  const currentPeriod = planillas.find(p => ['CALCULADA', 'EN_CORRECCION'].includes(p.estado));

  const years = [2024, 2025, 2026];

  // Calendar planilla dates for the displayed month
  const calendarPlanillas = useMemo(() => {
    return planillas.filter(p => {
      const start = new Date(p.fecha_inicio_periodo);
      const end = new Date(p.fecha_fin_periodo);
      return (start.getFullYear() === calendarYear && start.getMonth() === calendarMonth) ||
             (end.getFullYear() === calendarYear && end.getMonth() === calendarMonth);
    });
  }, [planillas, calendarYear, calendarMonth]);

  // Dates that have planilla activity in the calendar month
  const planillaDates = useMemo(() => {
    const dates: Record<number, Planilla[]> = {};
    calendarPlanillas.forEach(p => {
      const start = new Date(p.fecha_inicio_periodo);
      const end = new Date(p.fecha_fin_periodo);
      const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(calendarYear, calendarMonth, d);
        if (date >= start && date <= end) {
          if (!dates[d]) dates[d] = [];
          if (!dates[d].find(pp => pp.id === p.id)) dates[d].push(p);
        }
      }
    });
    return dates;
  }, [calendarPlanillas, calendarYear, calendarMonth]);

  // Deadline dates (end of period for non-paid planillas)
  const deadlineDates = useMemo(() => {
    const dates: Record<number, boolean> = {};
    calendarPlanillas
      .filter(p => !['PAGADA'].includes(p.estado))
      .forEach(p => {
        const end = new Date(p.fecha_fin_periodo);
        if (end.getFullYear() === calendarYear && end.getMonth() === calendarMonth) {
          dates[end.getDate()] = true;
        }
      });
    return dates;
  }, [calendarPlanillas, calendarYear, calendarMonth]);

  const selectedDatePlanillas = selectedCalendarDate !== null
    ? (planillaDates[selectedCalendarDate] || [])
    : [];

  return (
    <div className="space-y-5">
      {/* Enhanced Header with Gradient Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMCAyMGgyME0yMCAwdjIwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <CalendarDays className="h-32 w-32" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Períodos de Nómina</h2>
              <p className="text-sm text-emerald-100/80">Gestión de planillas, aprobación y dispersión de nómina</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 overflow-hidden relative">
          <div className="absolute top-2 right-2 opacity-10">
            <FileText className="h-16 w-16 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-emerald-200/60 dark:bg-emerald-800/40">
                <FileText className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              </div>
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Total Planillas</span>
            </div>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-950/40 dark:to-teal-900/20 overflow-hidden relative">
          <div className="absolute top-2 right-2 opacity-10">
            <DollarSign className="h-16 w-16 text-teal-600 dark:text-teal-400" />
          </div>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-teal-200/60 dark:bg-teal-800/40">
                <DollarSign className="h-3.5 w-3.5 text-teal-700 dark:text-teal-300" />
              </div>
              <span className="text-[11px] font-medium text-teal-700 dark:text-teal-300">Nómina del Mes</span>
            </div>
            <p className="text-xl font-bold text-teal-900 dark:text-teal-100">{fmt(nominaDelMes)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 overflow-hidden relative">
          <div className="absolute top-2 right-2 opacity-10">
            <Clock className="h-16 w-16 text-amber-600 dark:text-amber-400" />
          </div>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-amber-200/60 dark:bg-amber-800/40">
                <Clock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
              </div>
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Próximo Vencimiento</span>
            </div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
              {proximoVencimiento.length > 0
                ? new Date(proximoVencimiento[0].fecha_fin_periodo).toLocaleDateString('es-SV')
                : '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/40 dark:to-cyan-900/20 overflow-hidden relative">
          <div className="absolute top-2 right-2 opacity-10">
            <Users className="h-16 w-16 text-cyan-600 dark:text-cyan-400" />
          </div>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-cyan-200/60 dark:bg-cyan-800/40">
                <Users className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-300" />
              </div>
              <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">Empleados</span>
            </div>
            <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{empleadosNomina}</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Period Card */}
      {currentPeriod && (
        <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Período en Progreso</span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{currentPeriod.codigo_planilla}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {new Date(currentPeriod.fecha_inicio_periodo).toLocaleDateString('es-SV')} — {new Date(currentPeriod.fecha_fin_periodo).toLocaleDateString('es-SV')}
                </p>
              </div>
              <div className="text-right space-y-2">
                <Badge className={estadoColors[currentPeriod.estado]} variant="secondary">
                  {estadoLabels[currentPeriod.estado] || currentPeriod.estado}
                </Badge>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{fmt(currentPeriod.total_neto_a_pagar)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{currentPeriod.total_empleados} empleados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar View */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <CalendarDays className="h-4 w-4 text-emerald-600" /> Calendario de Nómina
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear(calendarYear - 1);
                  } else {
                    setCalendarMonth(calendarMonth - 1);
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[140px] text-center">
                {MONTHS_FULL[calendarMonth]} {calendarYear}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear(calendarYear + 1);
                  } else {
                    setCalendarMonth(calendarMonth + 1);
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {/* Weekday headers */}
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 py-1">
                {day}
              </div>
            ))}
            {/* Empty cells before first day */}
            {Array.from({ length: getFirstDayOfMonth(calendarYear, calendarMonth) }, (_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            {/* Day cells */}
            {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }, (_, i) => {
              const day = i + 1;
              const hasPlanilla = planillaDates[day] && planillaDates[day].length > 0;
              const isDeadline = deadlineDates[day];
              const isToday = calendarYear === new Date().getFullYear() && calendarMonth === new Date().getMonth() && day === new Date().getDate();
              const isSelected = selectedCalendarDate === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedCalendarDate(isSelected ? null : day)}
                  className={`relative h-8 text-xs rounded-md transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold'
                      : hasPlanilla
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                      : isToday
                      ? 'bg-slate-200 dark:bg-slate-700 font-bold text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {day}
                  {isDeadline && !isSelected && (
                    <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
                  )}
                  {hasPlanilla && !isSelected && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-emerald-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar legend */}
          <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-500 rounded-full" /> Período de planilla
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Vencimiento
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 bg-emerald-600 rounded text-white text-[8px] flex items-center justify-center">•</span> Seleccionado
            </div>
          </div>

          {/* Selected date planillas */}
          {selectedCalendarDate !== null && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Planillas del {selectedCalendarDate} de {MONTHS_FULL[calendarMonth]}
              </p>
              {selectedDatePlanillas.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">No hay planillas para esta fecha</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDatePlanillas.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[9px] ${estadoColors[p.estado]}`} variant="secondary">
                          {estadoLabels[p.estado]}
                        </Badge>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{p.codigo_planilla}</span>
                      </div>
                      <span className="font-mono text-slate-600 dark:text-slate-400">{fmt(p.total_neto_a_pagar)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Bar + Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Historial de Períodos</h3>
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
                <Plus className="h-4 w-4 mr-1" /> Nuevo Período
              </Button>
            </DialogTrigger>
            <DialogContent className="dark:bg-slate-900 dark:border-slate-700">
              <DialogHeader>
                <DialogTitle className="dark:text-slate-100">Nuevo Período de Nómina</DialogTitle>
                <DialogDescription className="dark:text-slate-400">Configure el período y ejecute el cálculo de nómina</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Tipo de Nómina</Label>
                  <Select value={newTipo} onValueChange={setNewTipo}>
                    <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent className="dark:bg-slate-800">
                      <SelectItem value="MENSUAL">Mensual</SelectItem>
                      <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="dark:text-slate-300">Fecha Inicio</Label>
                    <Input type="date" value={newFechaInicio} onChange={e => setNewFechaInicio(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label className="dark:text-slate-300">Fecha Fin</Label>
                    <Input type="date" value={newFechaFin} onChange={e => setNewFechaFin(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
                  {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</> : 'Ejecutar Cálculo de Nómina'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Year / Month / Status / Type Filter Bar */}
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Filtros:</span>

              {/* Year selector */}
              <div className="flex gap-1">
                {years.map(y => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedYear === y
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

              {/* Month quick-select */}
              <div className="flex gap-0.5 flex-wrap">
                {MONTHS_SHORT.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      selectedMonth === i
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : i === new Date().getMonth() && selectedYear === new Date().getFullYear()
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-700'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Status filter */}
              {['TODAS', 'BORRADOR', 'CALCULADA', 'APROBADA', 'PAGADA'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {s === 'TODAS' ? 'Todas' : estadoLabels[s] || s}
                </button>
              ))}

              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

              {/* Type filter */}
              {['TODAS', 'MENSUAL', 'QUINCENAL'].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    typeFilter === t
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {t === 'TODAS' ? 'Todos' : t === 'MENSUAL' ? 'Mensual' : 'Quincenal'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Planilla Cards with Workflow Progress */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-32 dark:bg-slate-700" />
                <Skeleton className="h-6 w-48 dark:bg-slate-700" />
                <Skeleton className="h-3 w-24 dark:bg-slate-700" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPlanillas.length === 0 ? (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <CardContent className="p-12 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">No hay planillas para los filtros seleccionados</p>
            <p className="text-xs mt-1 text-slate-400 dark:text-slate-600">Ajuste los filtros o cree un nuevo período</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[700px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
          {filteredPlanillas.map(p => {
            const progress = getFullWorkflowProgress(p.estado);
            const isExpanded = selectedPlanilla === p.id;
            const deducciones = p.total_deducciones || (p.total_salarios_brutos - p.total_neto_a_pagar);
            const cargasPatronales = p.total_cargas_patronales || Math.round(p.total_salarios_brutos * 0.1725);
            return (
              <Card
                key={p.id}
                className={`shadow-sm cursor-pointer transition-all hover:shadow-md border-l-4 ${borderColors[p.estado] || 'border-l-slate-300'} dark:bg-slate-900 dark:border-slate-700 ${
                  isExpanded ? 'ring-1 ring-emerald-300 dark:ring-emerald-700' : ''
                }`}
                onClick={() => setSelectedPlanilla(isExpanded ? null : p.id)}
              >
                <CardContent className="p-4">
                  {/* Header: code, status, type */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{p.codigo_planilla}</span>
                        <Badge className={`text-[10px] ${estadoColors[p.estado] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`} variant="secondary">
                          {(p.estado === 'CALCULADA' || p.estado === 'EN_CORRECCION') && (
                            <span className="relative flex h-1.5 w-1.5 mr-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                            </span>
                          )}
                          {estadoLabels[p.estado] || p.estado}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(p.fecha_inicio_periodo).toLocaleDateString('es-SV')} — {new Date(p.fecha_fin_periodo).toLocaleDateString('es-SV')}
                      </p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{p.tipo}</span>
                  </div>

                  {/* Financial summary */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Bruto</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(p.total_salarios_brutos)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Deducciones</p>
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">{fmt(deducciones)}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2">
                      <p className="text-[10px] text-emerald-500 dark:text-emerald-400">Neto</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmt(p.total_neto_a_pagar)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Cargas Patronales</p>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{fmt(cargasPatronales)}</p>
                    </div>
                  </div>

                  {/* Employee count with avatar row */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex -space-x-1.5">
                      {Array.from({ length: Math.min(p.total_empleados, 3) }, (_, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[8px] text-white font-bold"
                        >
                          {String.fromCharCode(65 + i)}
                        </div>
                      ))}
                      {p.total_empleados > 3 && (
                        <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] text-slate-600 dark:text-slate-400 font-medium">
                          +{p.total_empleados - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{p.total_empleados} empleados</span>
                  </div>

                  {/* Full Workflow Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500">
                      <span>Progreso del flujo</span>
                      <span>{progress + 1}/{fullWorkflowSteps.length}</span>
                    </div>
                    <div className="relative">
                      {/* Progress track */}
                      <div className="flex items-center">
                        {fullWorkflowSteps.map((step, i) => {
                          const isComplete = i < progress;
                          const isCurrent = i === progress;
                          return (
                            <React.Fragment key={step.key}>
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                                    isComplete
                                      ? 'bg-emerald-500 text-white shadow-sm'
                                      : isCurrent
                                      ? 'bg-emerald-500 text-white ring-2 ring-emerald-200 dark:ring-emerald-800 shadow-sm'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                                  }`}
                                >
                                  {isComplete ? '✓' : i + 1}
                                </div>
                                <span className={`text-[8px] mt-0.5 ${
                                  isComplete || isCurrent
                                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}>
                                  {step.label}
                                </span>
                              </div>
                              {i < fullWorkflowSteps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-0.5 ${
                                  i < progress
                                    ? 'bg-emerald-400 dark:bg-emerald-600'
                                    : 'bg-slate-200 dark:bg-slate-700'
                                }`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Quick action buttons */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] px-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                      onClick={(e) => { e.stopPropagation(); setSelectedPlanilla(isExpanded ? null : p.id); }}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Ver Detalle
                    </Button>
                    {p.estado === 'CALCULADA' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ThumbsUp className="h-3 w-3 mr-1" /> Aprobar
                      </Button>
                    )}
                    {p.estado === 'APROBADA' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SendHorizonal className="h-3 w-3 mr-1" /> Dispersar
                      </Button>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-slate-400 dark:text-slate-500">Calculada por:</span> <span className="font-medium text-slate-600 dark:text-slate-300">{p.calculada_por || '—'}</span></div>
                        <div><span className="text-slate-400 dark:text-slate-500">Aprobada por:</span> <span className="font-medium text-slate-600 dark:text-slate-300">{p.aprobada_por || '—'}</span></div>
                        <div><span className="text-slate-400 dark:text-slate-500">Fecha cálculo:</span> <span className="font-medium text-slate-600 dark:text-slate-300">{p.fecha_calculo ? new Date(p.fecha_calculo).toLocaleDateString('es-SV') : '—'}</span></div>
                        <div><span className="text-slate-400 dark:text-slate-500">Fecha aprobación:</span> <span className="font-medium text-slate-600 dark:text-slate-300">{p.fecha_aprobacion ? new Date(p.fecha_aprobacion).toLocaleDateString('es-SV') : '—'}</span></div>
                      </div>
                      {p.observaciones && (
                        <div className="p-2 bg-slate-50 rounded dark:bg-slate-800">
                          <span className="text-slate-400 dark:text-slate-500">Obs:</span> <span className="text-slate-600 dark:text-slate-300">{p.observaciones}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
