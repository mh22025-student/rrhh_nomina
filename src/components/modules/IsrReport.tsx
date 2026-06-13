'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Download, Calendar, Loader2, CheckCircle, Clock, AlertCircle,
  Users, DollarSign, TrendingUp, ChevronLeft, ChevronRight, Receipt,
  ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Eye,
  AlertTriangle, Timer, Scale
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface IsrReportProps {
  accessToken: string;
  userRole: string;
}

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const mockTrendData = [
  { mes: 'Nov', total: 2920.60 },
  { mes: 'Dic', total: 2780.40 },
  { mes: 'Ene', total: 3100.80 },
  { mes: 'Feb', total: 3250.15 },
  { mes: 'Mar', total: 3380.90 },
  { mes: 'Abr', total: 3520.45 },
];

type SortField = 'nombre' | 'salario_bruto' | 'deducciones' | 'renta_imponible' | 'isr_retenido';
type SortDir = 'asc' | 'desc';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDaysUntilDeadline(mes: number, anio: number): number {
  const deadline = new Date(anio, mes, 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function IsrReport({ accessToken }: IsrReportProps) {
  const { toast } = useToast();
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<{
    periodo: { mes: number; anio: number };
    parametros: { tasa_isss_laboral: number; tasa_afp_laboral: number; tramos_isr: { numero_tramo: number; desde: number; hasta: number | null; porcentaje: number; cuota_fija: number }[] };
    empleados: { id: string; nombre: string; dui: string; salario_bruto: number; isss_laboral: number; afp_laboral: number; deducciones: number; renta_imponible: number; isr_retenido: number }[];
    totales: { total_empleados: number; total_salario_bruto: number; total_deducciones: number; total_renta_imponible: number; total_isr_retenido: number };
    entero: { id: string; estado: string; fecha_entero: string | null; formulario_f910: string | null; total_retenciones: number } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [constanciaLoading, setConstanciaLoading] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showPreview, setShowPreview] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes/isr?mes=${mes}&anio=${anio}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, mes, anio]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateF910 = async () => {
    try {
      setDownloading(true);
      const res = await fetch(`/api/reportes/isr/download?mes=${mes}&anio=${anio}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al generar archivo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `F910_${mes}_${anio}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Formulario F-910 generado', description: 'El archivo CSV ha sido descargado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el formulario F-910', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const generateConstancia = async (empId: string, empNombre: string) => {
    if (!data) return;
    setConstanciaLoading(empId);
    try {
      const res = await fetch(`/api/reportes/isr/constancia?empleado_id=${empId}&mes=${data.periodo.mes}&anio=${data.periodo.anio}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al generar constancia');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Constancia_ISR_${empId}_${meses[data.periodo.mes - 1]}_${data.periodo.anio}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Constancia ISR generada', description: `PDF de constancia ISR de ${empNombre}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar la constancia ISR', variant: 'destructive' });
    } finally {
      setConstanciaLoading(null);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Nombre', 'DUI', 'Salario Bruto', 'ISSS Laboral', 'AFP Laboral', 'Deducciones', 'Renta Imponible', 'ISR Retenido'];
    const rows = data.empleados.map(e => [e.nombre, e.dui, fmt(e.salario_bruto), fmt(e.isss_laboral), fmt(e.afp_laboral), fmt(e.deducciones), fmt(e.renta_imponible), fmt(e.isr_retenido)]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Retenciones_ISR_${meses[parseInt(mes) - 1]}_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: 'Retenciones ISR exportadas correctamente' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedEmpleados = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.empleados].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'nombre') cmp = a.nombre.localeCompare(b.nombre);
      else if (sortField === 'salario_bruto') cmp = a.salario_bruto - b.salario_bruto;
      else if (sortField === 'deducciones') cmp = a.deducciones - b.deducciones;
      else if (sortField === 'renta_imponible') cmp = a.renta_imponible - b.renta_imponible;
      else if (sortField === 'isr_retenido') cmp = a.isr_retenido - b.isr_retenido;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [data, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-emerald-300" /> : <ArrowDown className="h-3 w-3 ml-1 text-emerald-300" />;
  };

  const goToMesAnterior = () => {
    const m = parseInt(mes);
    const a = parseInt(anio);
    if (m === 1) { setMes('12'); setAnio(String(a - 1)); }
    else { setMes(String(m - 1)); }
  };

  const goToMesSiguiente = () => {
    const m = parseInt(mes);
    const a = parseInt(anio);
    if (m === 12) { setMes('1'); setAnio(String(a + 1)); }
    else { setMes(String(m + 1)); }
  };

  const daysUntilDeadline = getDaysUntilDeadline(parseInt(mes), parseInt(anio));
  const isEnterado = data?.entero?.estado === 'PRESENTADA' || data?.entero?.estado === 'ENTERADO';

  // Distribution by ISR tramo for donut chart
  const tramoDistribution = useMemo(() => {
    if (!data) return [];
    const tramos: Record<string, number> = {};
    data.empleados.forEach(e => {
      const tramo = data.parametros.tramos_isr.find(t => e.renta_imponible >= t.desde && (t.hasta === null || e.renta_imponible < t.hasta));
      const label = tramo ? `Tramo ${tramo.numero_tramo}` : 'Exento';
      tramos[label] = (tramos[label] || 0) + 1;
    });
    return Object.entries(tramos).map(([name, value]) => ({ name, value }));
  }, [data]);

  // Find the most frequent tramo
  const tramoMasFrecuente = useMemo(() => {
    if (tramoDistribution.length === 0) return '-';
    return tramoDistribution.reduce((max, d) => d.value > max.value ? d : max, tramoDistribution[0]).name;
  }, [tramoDistribution]);

  const donutColors = ['#10b981', '#14b8a6', '#06b6d4', '#059669', '#0d9488', '#0e7490'];
  const totalDistribution = tramoDistribution.reduce((s, d) => s + d.value, 0);

  const conicGradient = tramoDistribution.length > 0
    ? tramoDistribution.reduce((acc, d, i) => {
        const startPct = (acc.cumulative / totalDistribution) * 100;
        const endPct = ((acc.cumulative + d.value) / totalDistribution) * 100;
        acc.segments.push(`${donutColors[i % donutColors.length]} ${startPct}% ${endPct}%`);
        acc.cumulative += d.value;
        return acc;
      }, { segments: [] as string[], cumulative: 0 }).segments.join(', ')
    : 'transparent 0% 100%';

  // Average retention
  const avgRetencion = data && data.totales.total_empleados > 0
    ? data.totales.total_isr_retenido / data.empleados.filter(e => e.isr_retenido > 0).length || 0
    : 0;

  const totalRetenidos = data ? data.empleados.filter(e => e.isr_retenido > 0).length : 0;

  // File preview content
  const filePreview = data ? [
    `F910|${data.periodo.mes}|${data.periodo.anio}|${data.totales.total_empleados}`,
    `TOTAL_RETENCIONES|${fmt(data.totales.total_isr_retenido)}`,
    `TOTAL_SALARIOS|${fmt(data.totales.total_salario_bruto)}`,
    `TOTAL_DEDUCCIONES|${fmt(data.totales.total_deducciones)}`,
    ...data.empleados.slice(0, 2).map(e => `${e.dui}|${e.nombre}|${fmt(e.salario_bruto)}|${fmt(e.deducciones)}|${fmt(e.renta_imponible)}|${fmt(e.isr_retenido)}`),
  ] : [];

  const trendMax = Math.max(...mockTrendData.map(d => d.total));

  return (
    <div className="space-y-5">
      {/* ── Professional Header Banner ── */}
      <div className="rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 dark:from-emerald-900 dark:via-emerald-800 dark:to-teal-800 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
                <Receipt className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Retenciones ISR</h2>
                <p className="text-emerald-100 text-sm">Formulario F-910 — Declaración de Retenciones</p>
                <p className="text-emerald-200/70 text-xs mt-0.5">Art. 157 Código Tributario</p>
              </div>
            </div>
            {/* Month/Year selector with arrows */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-1.5">
              <Button variant="ghost" size="icon" onClick={goToMesAnterior} className="h-8 w-8 text-white hover:bg-white/20">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger className="w-28 bg-white/15 border-white/20 text-white text-sm h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={anio} onValueChange={setAnio}>
                  <SelectTrigger className="w-20 bg-white/15 border-white/20 text-white text-sm h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="icon" onClick={goToMesSiguiente} className="h-8 w-8 text-white hover:bg-white/20">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-sm overflow-hidden border-l-4 border-l-emerald-500 dark:border-l-emerald-400 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                  <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Retenidos</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalRetenidos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm overflow-hidden border-l-4 border-l-amber-500 dark:border-l-amber-400 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                  <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total ISR Retenido</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${fmt(data.totales.total_isr_retenido)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm overflow-hidden border-l-4 border-l-teal-500 dark:border-l-teal-400 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                  <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Promedio Retención</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${fmt(avgRetencion)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm overflow-hidden border-l-4 border-l-emerald-700 dark:border-l-emerald-500 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                  <Scale className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tramo Más Frecuente</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{tramoMasFrecuente}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Charts Row: Bar + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Bar Chart - Monthly Trend */}
        <Card className="shadow-sm lg:col-span-3 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Tendencia Mensual de Retenciones ISR (6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex items-end gap-3 h-36">
              {mockTrendData.map((item, idx) => {
                const heightPct = trendMax > 0 ? (item.total / trendMax) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">${(item.total / 1000).toFixed(1)}k</span>
                    <div className="w-full relative" style={{ height: '90px' }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t-md bg-gradient-to-t from-emerald-700 to-teal-400 dark:from-emerald-600 dark:to-teal-400 transition-all duration-500 hover:from-emerald-600 hover:to-emerald-300"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{item.mes}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Donut Chart - Distribution by Tramo */}
        <Card className="shadow-sm lg:col-span-2 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Distribución por Tramo ISR</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {tramoDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-36 text-sm text-slate-400">Sin datos</div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative w-28 h-28 shrink-0">
                  <div
                    className="w-full h-full rounded-full"
                    style={{ background: `conic-gradient(${conicGradient})` }}
                  />
                  <div className="absolute inset-3 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{totalRetenidos}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {tramoDistribution.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: donutColors[i % donutColors.length] }} />
                      <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
                      <span className="ml-auto font-mono text-slate-700 dark:text-slate-300 shrink-0">{d.value} emp.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Compliance Status Widget ── */}
      {data && (
        <Card className="shadow-sm dark:border-slate-700 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row">
              {/* Status indicator */}
              <div className={`p-4 sm:p-5 flex items-center gap-3 sm:w-56 ${isEnterado ? 'bg-emerald-50 dark:bg-emerald-900/20' : daysUntilDeadline < 0 ? 'bg-red-50 dark:bg-red-900/20' : daysUntilDeadline <= 5 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                <div className={`p-2 rounded-full ${isEnterado ? 'bg-emerald-200 dark:bg-emerald-800' : daysUntilDeadline < 0 ? 'bg-red-200 dark:bg-red-800' : daysUntilDeadline <= 5 ? 'bg-amber-200 dark:bg-amber-800' : 'bg-emerald-200 dark:bg-emerald-800'}`}>
                  {isEnterado ? <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : daysUntilDeadline < 0 ? <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" /> : daysUntilDeadline <= 5 ? <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" /> : <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <div>
                  <Badge className={isEnterado ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : daysUntilDeadline < 0 ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : daysUntilDeadline <= 5 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'}>
                    {data.entero?.estado || 'PENDIENTE'}
                  </Badge>
                </div>
              </div>
              {/* Details */}
              <div className="flex-1 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Plazo de declaración:</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Día 10 del mes siguiente</span>
                </div>
                {!isEnterado && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Días restantes:</span>
                    <span className={`text-sm font-bold ${daysUntilDeadline < 0 ? 'text-red-600 dark:text-red-400' : daysUntilDeadline <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {daysUntilDeadline < 0 ? `Vencido por ${Math.abs(daysUntilDeadline)} días` : `${daysUntilDeadline} días`}
                    </span>
                  </div>
                )}
                {isEnterado && data.entero?.fecha_entero && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Enterado el:</span>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {new Date(data.entero.fecha_entero).toLocaleDateString('es-SV')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ISR Tramos Table ── */}
      {data && (
        <Card className="shadow-sm dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
              <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Tramos ISR Vigentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-900 dark:to-teal-900">
                    <th className="text-center p-3 font-semibold text-white">Tramo</th>
                    <th className="text-right p-3 font-semibold text-white">Desde</th>
                    <th className="text-right p-3 font-semibold text-white">Hasta</th>
                    <th className="text-right p-3 font-semibold text-white">Porcentaje</th>
                    <th className="text-right p-3 font-semibold text-white">Cuota Fija</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parametros.tramos_isr.map((t, idx) => (
                    <tr key={t.numero_tramo} className={`border-b dark:border-slate-700/50 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/30'}`}>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400">Tramo {t.numero_tramo}</Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${t.desde.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">{t.hasta ? `$${t.hasta.toLocaleString()}` : 'En adelante'}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">{(t.porcentaje * 100).toFixed(0)}%</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(t.cuota_fija)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Enhanced Data Table ── */}
      <Card className="shadow-sm dark:border-slate-700">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Retenciones ISR por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : !data || data.empleados.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">No hay datos para el período seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-900 dark:to-teal-900">
                    <th className="text-left p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('nombre')}>
                      <span className="flex items-center">Nombre <SortIcon field="nombre" /></span>
                    </th>
                    <th className="text-left p-3 font-semibold text-white">DUI</th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('salario_bruto')}>
                      <span className="flex items-center justify-end">Salario Bruto <SortIcon field="salario_bruto" /></span>
                    </th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('deducciones')}>
                      <span className="flex items-center justify-end">Deducciones <SortIcon field="deducciones" /></span>
                    </th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('renta_imponible')}>
                      <span className="flex items-center justify-end">Renta Imponible <SortIcon field="renta_imponible" /></span>
                    </th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('isr_retenido')}>
                      <span className="flex items-center justify-end">ISR Retenido <SortIcon field="isr_retenido" /></span>
                    </th>
                    <th className="text-center p-3 font-semibold text-white">Constancia</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmpleados.map((emp, idx) => (
                    <tr key={emp.id} className={`border-b dark:border-slate-700/50 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/15 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/30'}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {getInitials(emp.nombre)}
                          </div>
                          <span className="text-slate-800 dark:text-slate-200 font-medium">{emp.nombre}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.dui}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(emp.salario_bruto)}</td>
                      <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">${fmt(emp.deducciones)}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(emp.renta_imponible)}</td>
                      <td className="p-3 text-right font-mono text-red-700 dark:text-red-400 font-medium">${fmt(emp.isr_retenido)}</td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => generateConstancia(emp.id, emp.nombre)} title="Generar Constancia ISR PDF" disabled={constanciaLoading === emp.id} className="dark:text-slate-300 dark:hover:bg-slate-700">
                          {constanciaLoading === emp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-semibold">
                    <td className="p-3 text-slate-800 dark:text-slate-200" colSpan={2}>Totales ({data.totales.total_empleados})</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(data.totales.total_salario_bruto)}</td>
                    <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">${fmt(data.totales.total_deducciones)}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(data.totales.total_renta_imponible)}</td>
                    <td className="p-3 text-right font-mono text-red-700 dark:text-red-400">${fmt(data.totales.total_isr_retenido)}</td>
                    <td />
                  </tr>
                  <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-800 dark:to-teal-800">
                    <td className="p-3 text-white font-bold" colSpan={4}>Total Retenciones ISR — F-910</td>
                    <td className="p-3 text-right text-white font-bold font-mono" colSpan={3}>
                      ${fmt(data.totales.total_isr_retenido)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Download / Export Section ── */}
      {data && data.empleados.length > 0 && (
        <Card className="shadow-sm dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Descarga y Exportación
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={generateF910} disabled={downloading} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Descargar F-910
              </Button>
              <Button onClick={exportCSV} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
              <Button onClick={() => setShowPreview(p => !p)} variant="ghost" className="text-slate-600 dark:text-slate-400">
                <Eye className="h-4 w-4 mr-2" /> {showPreview ? 'Ocultar' : 'Vista Previa'}
              </Button>
            </div>

            {/* File format info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Formato F-910</p>
                <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70">Declaración de Retenciones — Formulario oficial del Ministerio de Hacienda</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Formato CSV</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Retenciones ISR en formato de valores separados por coma</p>
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-4 overflow-x-auto">
                <p className="text-[10px] text-slate-400 mb-2">Vista previa — Primeras líneas del formulario F-910</p>
                <pre className="text-xs text-emerald-400 font-mono leading-relaxed">
                  {filePreview.map((line, i) => (
                    <span key={i}>{line}{'\n'}</span>
                  ))}
                  <span className="text-slate-500">... ({data.empleados.length - 2} registros más)</span>
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
