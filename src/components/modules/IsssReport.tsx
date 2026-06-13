'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Download, Calendar, Loader2, CheckCircle, Clock, AlertCircle,
  Users, DollarSign, TrendingUp, ChevronLeft, ChevronRight, Shield,
  ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Eye, Building2,
  AlertTriangle, Timer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface IsssReportProps {
  accessToken: string;
  userRole: string;
}

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const mockTrendData = [
  { mes: 'Nov', total: 4380.15 },
  { mes: 'Dic', total: 4190.50 },
  { mes: 'Ene', total: 4520.30 },
  { mes: 'Feb', total: 4610.75 },
  { mes: 'Mar', total: 4750.00 },
  { mes: 'Abr', total: 4890.25 },
];

type SortField = 'nombre' | 'salario_cotizable' | 'cotizacion_laboral' | 'cotizacion_patronal';
type SortDir = 'asc' | 'desc';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDaysUntilDeadline(mes: number, anio: number): number {
  const deadline = new Date(anio, mes, 15);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function IsssReport({ accessToken }: IsssReportProps) {
  const { toast } = useToast();
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<{
    periodo: { mes: number; anio: number };
    parametros: { tasa_isss_laboral: number; tasa_isss_patronal: number; tope_cotizacion_isss: number };
    empleados: { id: string; nombre: string; numero_isss: string | null; dui: string; salario_cotizable: number; cotizacion_laboral: number; cotizacion_patronal: number; area: string | null; puesto: string | null }[];
    totales: { total_empleados: number; total_salario_cotizable: number; total_cotizacion_laboral: number; total_cotizacion_patronal: number; total_general: number };
    presentacion: { id: string; estado: string; fecha_presentacion: string | null; archivo_ois: string | null } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showPreview, setShowPreview] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes/isss?mes=${mes}&anio=${anio}`, {
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

  const generateOIS = async () => {
    try {
      setDownloading(true);
      const res = await fetch(`/api/reportes/isss/download?mes=${mes}&anio=${anio}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al generar archivo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OIS_${mes}_${anio}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Archivo OIS generado', description: 'El archivo CSV ha sido descargado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el archivo OIS', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Nombre', 'DUI', 'N° ISSS', 'Salario Cotizable', 'Cot. Laboral', 'Cot. Patronal'];
    const rows = data.empleados.map(e => [e.nombre, e.dui, e.numero_isss || '', fmt(e.salario_cotizable), fmt(e.cotizacion_laboral), fmt(e.cotizacion_patronal)]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planilla_ISSS_${meses[parseInt(mes) - 1]}_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: 'Planilla ISSS exportada correctamente' });
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
      else if (sortField === 'salario_cotizable') cmp = a.salario_cotizable - b.salario_cotizable;
      else if (sortField === 'cotizacion_laboral') cmp = a.cotizacion_laboral - b.cotizacion_laboral;
      else if (sortField === 'cotizacion_patronal') cmp = a.cotizacion_patronal - b.cotizacion_patronal;
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
  const isPresentada = data?.presentacion?.estado === 'PRESENTADA';

  // Distribution by area for donut chart
  const areaDistribution = useMemo(() => {
    if (!data) return [];
    const areas: Record<string, number> = {};
    data.empleados.forEach(e => {
      const area = e.area || 'Sin área';
      areas[area] = (areas[area] || 0) + e.cotizacion_laboral + e.cotizacion_patronal;
    });
    return Object.entries(areas).map(([name, value]) => ({ name, value }));
  }, [data]);

  const donutColors = ['#10b981', '#14b8a6', '#06b6d4', '#059669', '#0d9488', '#0e7490'];
  const totalDistribution = areaDistribution.reduce((s, d) => s + d.value, 0);

  const conicGradient = areaDistribution.length > 0
    ? areaDistribution.reduce((acc, d, i) => {
        const startPct = (acc.cumulative / totalDistribution) * 100;
        const endPct = ((acc.cumulative + d.value) / totalDistribution) * 100;
        acc.segments.push(`${donutColors[i % donutColors.length]} ${startPct}% ${endPct}%`);
        acc.cumulative += d.value;
        return acc;
      }, { segments: [] as string[], cumulative: 0 }).segments.join(', ')
    : 'transparent 0% 100%';

  // File preview content
  const filePreview = data ? [
    `OIS|${data.periodo.mes}|${data.periodo.anio}|${data.totales.total_empleados}`,
    `TASA_LABORAL|${(data.parametros.tasa_isss_laboral * 100).toFixed(1)}%`,
    `TASA_PATRONAL|${(data.parametros.tasa_isss_patronal * 100).toFixed(1)}%`,
    `TOPE|${data.parametros.tope_cotizacion_isss}`,
    ...data.empleados.slice(0, 2).map(e => `${e.dui}|${e.numero_isss || 'N/A'}|${e.nombre}|${fmt(e.salario_cotizable)}|${fmt(e.cotizacion_laboral)}`),
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
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Planilla ISSS</h2>
                <p className="text-emerald-100 text-sm">Instituto Salvadoreño del Seguro Social</p>
                <p className="text-emerald-200/70 text-xs mt-0.5">Art. 6 Ley del ISSS</p>
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Cotizantes</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{data.totales.total_empleados}</p>
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Descuento ISSS</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${fmt(data.totales.total_cotizacion_laboral)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm overflow-hidden border-l-4 border-l-teal-500 dark:border-l-teal-400 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                  <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Aporte Patronal</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${fmt(data.totales.total_cotizacion_patronal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm overflow-hidden border-l-4 border-l-emerald-700 dark:border-l-emerald-500 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                  <TrendingUp className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Planilla</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${fmt(data.totales.total_general)}</p>
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
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Tendencia Mensual de Cotizaciones (6 meses)</CardTitle>
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

        {/* Donut Chart - Distribution by Area */}
        <Card className="shadow-sm lg:col-span-2 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Distribución por Área</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {areaDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-36 text-sm text-slate-400">Sin datos</div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative w-28 h-28 shrink-0">
                  <div
                    className="w-full h-full rounded-full"
                    style={{ background: `conic-gradient(${conicGradient})` }}
                  />
                  <div className="absolute inset-3 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{areaDistribution.length}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {areaDistribution.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: donutColors[i % donutColors.length] }} />
                      <span className="text-slate-600 dark:text-slate-400 truncate">{d.name}</span>
                      <span className="ml-auto font-mono text-slate-700 dark:text-slate-300 shrink-0">${fmt(d.value)}</span>
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
              <div className={`p-4 sm:p-5 flex items-center gap-3 sm:w-56 ${isPresentada ? 'bg-emerald-50 dark:bg-emerald-900/20' : daysUntilDeadline < 0 ? 'bg-red-50 dark:bg-red-900/20' : daysUntilDeadline <= 5 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                <div className={`p-2 rounded-full ${isPresentada ? 'bg-emerald-200 dark:bg-emerald-800' : daysUntilDeadline < 0 ? 'bg-red-200 dark:bg-red-800' : daysUntilDeadline <= 5 ? 'bg-amber-200 dark:bg-amber-800' : 'bg-emerald-200 dark:bg-emerald-800'}`}>
                  {isPresentada ? <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : daysUntilDeadline < 0 ? <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" /> : daysUntilDeadline <= 5 ? <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" /> : <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <div>
                  <Badge className={isPresentada ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : daysUntilDeadline < 0 ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : daysUntilDeadline <= 5 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'}>
                    {data.presentacion?.estado || 'PENDIENTE'}
                  </Badge>
                </div>
              </div>
              {/* Details */}
              <div className="flex-1 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Plazo de presentación:</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Día 15 del mes siguiente</span>
                </div>
                {!isPresentada && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Días restantes:</span>
                    <span className={`text-sm font-bold ${daysUntilDeadline < 0 ? 'text-red-600 dark:text-red-400' : daysUntilDeadline <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {daysUntilDeadline < 0 ? `Vencido por ${Math.abs(daysUntilDeadline)} días` : `${daysUntilDeadline} días`}
                    </span>
                  </div>
                )}
                {isPresentada && data.presentacion?.fecha_presentacion && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Presentada el:</span>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {new Date(data.presentacion.fecha_presentacion).toLocaleDateString('es-SV')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Parameters Row ── */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Laboral</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{(data.parametros.tasa_isss_laboral * 100).toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Patronal</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{(data.parametros.tasa_isss_patronal * 100).toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/50">
                <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tope Cotización</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">${data.parametros.tope_cotizacion_isss.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Enhanced Data Table ── */}
      <Card className="shadow-sm dark:border-slate-700">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Datos de Cotización
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
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
                    <th className="text-left p-3 font-semibold text-white">N° ISSS</th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('salario_cotizable')}>
                      <span className="flex items-center justify-end">Salario Cotizable <SortIcon field="salario_cotizable" /></span>
                    </th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('cotizacion_laboral')}>
                      <span className="flex items-center justify-end">Desc. Laboral (3%) <SortIcon field="cotizacion_laboral" /></span>
                    </th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('cotizacion_patronal')}>
                      <span className="flex items-center justify-end">Aporte Patronal (7.5%) <SortIcon field="cotizacion_patronal" /></span>
                    </th>
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
                          <div>
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{emp.nombre}</span>
                            {emp.area && <p className="text-[10px] text-slate-400 dark:text-slate-500">{emp.area}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.numero_isss || '-'}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(emp.salario_cotizable)}</td>
                      <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400 font-medium">${fmt(emp.cotizacion_laboral)}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(emp.cotizacion_patronal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-semibold">
                    <td className="p-3 text-slate-800 dark:text-slate-200" colSpan={2}>Totales ({data.totales.total_empleados} empleados)</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(data.totales.total_salario_cotizable)}</td>
                    <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">${fmt(data.totales.total_cotizacion_laboral)}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(data.totales.total_cotizacion_patronal)}</td>
                  </tr>
                  <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-800 dark:to-teal-800">
                    <td className="p-3 text-white font-bold" colSpan={3}>Total Planilla ISSS</td>
                    <td className="p-3 text-right text-white font-bold font-mono" colSpan={2}>
                      ${fmt(data.totales.total_general)}
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
              <Button onClick={generateOIS} disabled={downloading} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Descargar Planilla OIS
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
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Formato OIS</p>
                <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70">Archivo de Planilla ISSS — Formato oficial para presentación ante el ISSS</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Formato CSV</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Planilla ISSS en formato de valores separados por coma</p>
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-4 overflow-x-auto">
                <p className="text-[10px] text-slate-400 mb-2">Vista previa — Primeras líneas del archivo OIS</p>
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
