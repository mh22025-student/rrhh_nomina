'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Calendar, Loader2, RefreshCw, AlertCircle, Clock,
  FileText, CheckCircle, DollarSign, Users, Filter, TrendingUp
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

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const workflowSteps = ['CALCULADA', 'APROBADA', 'PAGADA'] as const;

function getWorkflowProgress(estado: string): number {
  if (estado === 'BORRADOR' || estado === 'EN_CORRECCION') return 0;
  const idx = workflowSteps.indexOf(estado as typeof workflowSteps[number]);
  return idx >= 0 ? idx + 1 : 0;
}

export default function PayrollPeriods({ accessToken }: PayrollPeriodsProps) {
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
  const [selectedPlanilla, setSelectedPlanilla] = useState<string | null>(null);

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
      return true;
    });
  }, [planillas, selectedYear, selectedMonth, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredPlanillas.length;
    const pagadas = filteredPlanillas.filter(p => p.estado === 'PAGADA');
    const montoPagado = pagadas.reduce((sum, p) => sum + p.total_neto_a_pagar, 0);
    const latest = filteredPlanillas.length > 0 ? filteredPlanillas[0] : null;
    const empleadosNomina = latest?.total_empleados || 0;
    return { total, pagadasCount: pagadas.length, montoPagado, empleadosNomina };
  }, [filteredPlanillas]);

  // Current period: most recent CALCULADA or EN_CORRECCION
  const currentPeriod = planillas.find(p => ['CALCULADA', 'EN_CORRECCION'].includes(p.estado));

  const years = [2024, 2025, 2026];

  return (
    <div className="space-y-5">
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

        <Card className="shadow-sm border-0 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20 overflow-hidden relative">
          <div className="absolute top-2 right-2 opacity-10">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-green-200/60 dark:bg-green-800/40">
                <CheckCircle className="h-3.5 w-3.5 text-green-700 dark:text-green-300" />
              </div>
              <span className="text-[11px] font-medium text-green-700 dark:text-green-300">Pagadas</span>
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.pagadasCount}</p>
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
              <span className="text-[11px] font-medium text-teal-700 dark:text-teal-300">Monto Total Pagado</span>
            </div>
            <p className="text-xl font-bold text-teal-900 dark:text-teal-100">{fmt(stats.montoPagado)}</p>
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
              <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">Empleados en Nómina</span>
            </div>
            <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{stats.empleadosNomina}</p>
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

        {/* Year / Month / Status Filter Bar */}
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
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      selectedMonth === i
                        ? 'bg-emerald-600 text-white shadow-sm'
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Planilla Cards */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
          {filteredPlanillas.map(p => {
            const progress = getWorkflowProgress(p.estado);
            const isExpanded = selectedPlanilla === p.id;
            return (
              <Card
                key={p.id}
                className={`shadow-sm cursor-pointer transition-all hover:shadow-md border-l-4 ${borderColors[p.estado] || 'border-l-slate-300'} dark:bg-slate-900 dark:border-slate-700 ${
                  isExpanded ? 'ring-1 ring-emerald-300 dark:ring-emerald-700' : ''
                }`}
                onClick={() => setSelectedPlanilla(isExpanded ? null : p.id)}
              >
                <CardContent className="p-4">
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

                  {/* Key metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Bruto</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(p.total_salarios_brutos)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Neto</p>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{fmt(p.total_neto_a_pagar)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Empleados</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{p.total_empleados}</p>
                    </div>
                  </div>

                  {/* Workflow progress */}
                  <div className="flex items-center gap-1">
                    {workflowSteps.map((ws, i) => {
                      const isComplete = i < progress;
                      const isCurrent = i === progress - 1 && p.estado === ws;
                      return (
                        <React.Fragment key={ws}>
                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                            isComplete
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : isCurrent
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                          }`}>
                            {isComplete ? <CheckCircle className="h-2.5 w-2.5" /> : <div className="h-2.5 w-2.5 rounded-full border border-current" />}
                            {estadoLabels[ws]}
                          </div>
                          {i < workflowSteps.length - 1 && (
                            <div className={`w-4 h-px ${isComplete ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
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
