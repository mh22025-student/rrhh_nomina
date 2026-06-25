'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Download, Calendar, Loader2, CheckCircle, Clock, AlertCircle,
  Users, DollarSign, TrendingUp, ChevronLeft, ChevronRight, Landmark,
  ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Eye, Building2,
  AlertTriangle, Timer, CheckCircle2, RotateCcw, Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface AfpReportProps {
  accessToken: string;
  userRole: string;
}

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const mockTrendData = [
  { mes: 'Nov', total: 6290.80 },
  { mes: 'Dic', total: 5980.60 },
  { mes: 'Ene', total: 6530.20 },
  { mes: 'Feb', total: 6710.90 },
  { mes: 'Mar', total: 6890.50 },
  { mes: 'Abr', total: 7050.30 },
];

type SortField = 'nombre' | 'ibc' | 'cotizacion_laboral' | 'cotizacion_patronal';
type SortDir = 'asc' | 'desc';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDaysUntilDeadline(mes: number, anio: number): number {
  const deadline = new Date(anio, mes, 20);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AfpReport({ accessToken }: AfpReportProps) {
  const { toast } = useToast();
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<{
    periodo: { mes: number; anio: number };
    parametros: { tasa_afp_laboral: number; tasa_afp_patronal: number };
    empleados: { id: string; nombre: string; nup: string | null; afp_administradora: string | null; dui: string; ibc: number; cotizacion_laboral: number; cotizacion_patronal: number }[];
    por_administradora: Record<string, { empleados: { id: string; nombre: string; nup: string | null; dui: string; ibc: number; cotizacion_laboral: number; cotizacion_patronal: number }[]; total: number; total_cot_laboral: number; total_cot_patronal: number }>;
    totales: { total_empleados: number; total_ibc: number; total_cotizacion_laboral: number; total_cotizacion_patronal: number; total_general: number };
    presentaciones: { id: string; administradora: string; estado: string; fecha_presentacion: string | null; archivo_sepp: string | null }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingAdmin, setDownloadingAdmin] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showPreview, setShowPreview] = useState(false);

  // Presentation registration state
  const [showPresentacionDialog, setShowPresentacionDialog] = useState(false);
  const [presentacionSaving, setPresentacionSaving] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [formAdmin, setFormAdmin] = useState<string>('CRECER');
  const [formFecha, setFormFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formObservaciones, setFormObservaciones] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes/afp?mes=${mes}&anio=${anio}`, {
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

  const generateSEPP = async (admin: string) => {
    try {
      setDownloadingAdmin(admin);
      const res = await fetch(`/api/reportes/afp/download?mes=${mes}&anio=${anio}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al generar archivo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SEPP_${admin}_${mes}_${anio}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Archivo SEPP ${admin} generado`, description: 'El archivo CSV ha sido descargado' });
    } catch {
      toast({ title: 'Error', description: `No se pudo generar el archivo SEPP ${admin}`, variant: 'destructive' });
    } finally {
      setDownloadingAdmin(null);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Nombre', 'DUI', 'NUP', 'AFP', 'IBC', 'Cot. Laboral', 'Cot. Patronal'];
    const rows = data.empleados.map(e => [e.nombre, e.dui, e.nup || '', e.afp_administradora || '', fmt(e.ibc), fmt(e.cotizacion_laboral), fmt(e.cotizacion_patronal)]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planilla_AFP_${meses[parseInt(mes) - 1]}_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: 'Planilla AFP exportada correctamente' });
  };

  // Find the most recent planilla whose period matches the selected mes/anio
  const resolvePlanillaId = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/nomina/planillas?limit=10', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const payload = await res.json();
      const planillas = payload.data || payload.planillas || payload || [];
      if (!Array.isArray(planillas) || planillas.length === 0) return null;
      const matching = planillas.find((p: { fecha_inicio_periodo?: string; fecha_fin_periodo?: string }) => {
        const d = new Date(p.fecha_fin_periodo || p.fecha_inicio_periodo || '');
        return d.getMonth() + 1 === parseInt(mes) && d.getFullYear() === parseInt(anio);
      });
      return (matching || planillas[0]).id;
    } catch {
      return null;
    }
  };

  const registrarPresentacion = async () => {
    if (!formFecha || !formAdmin) {
      toast({ title: 'Datos requeridos', description: 'Seleccione AFP y fecha', variant: 'destructive' });
      return;
    }
    const planilla_id = await resolvePlanillaId();
    if (!planilla_id) {
      toast({ title: 'Sin planilla', description: 'No se encontró una planilla para asociar', variant: 'destructive' });
      return;
    }
    setPresentacionSaving(true);
    try {
      const res = await fetch('/api/reportes/afp/presentacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          planilla_id,
          administradora: formAdmin,
          fecha_presentacion: formFecha,
          observaciones: formObservaciones || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al registrar');
      }
      toast({
        title: 'Presentación registrada',
        description: `SEPP de ${formAdmin} marcada como PRESENTADO el ${new Date(formFecha).toLocaleDateString('es-SV')}.`,
      });
      setShowPresentacionDialog(false);
      setFormObservaciones('');
      fetchData();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo registrar', variant: 'destructive' });
    } finally {
      setPresentacionSaving(false);
    }
  };

  const revertirPresentacion = async (id: string, admin: string) => {
    setRevertingId(id);
    try {
      const res = await fetch(`/api/reportes/afp/presentacion?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al revertir');
      }
      toast({ title: 'Presentación revertida', description: `SEPP de ${admin} volvió a PENDIENTE` });
      fetchData();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo revertir', variant: 'destructive' });
    } finally {
      setRevertingId(null);
    }
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
      else if (sortField === 'ibc') cmp = a.ibc - b.ibc;
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
  const allPresentadas = data?.presentaciones?.length > 0 && data.presentaciones.every(p => p.estado === 'PRESENTADO' || p.estado === 'PRESENTADA');

  // Distribution by AFP administradora for donut chart
  const afpDistribution = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.por_administradora).map(([name, info]) => ({
      name,
      value: info.total_cot_laboral + info.total_cot_patronal,
      empleados: info.empleados.length
    }));
  }, [data]);

  const donutColors = ['#10b981', '#14b8a6', '#06b6d4', '#059669', '#0d9488'];
  const totalDistribution = afpDistribution.reduce((s, d) => s + d.value, 0);

  const conicGradient = afpDistribution.length > 0
    ? afpDistribution.reduce((acc, d, i) => {
        const startPct = (acc.cumulative / totalDistribution) * 100;
        const endPct = ((acc.cumulative + d.value) / totalDistribution) * 100;
        acc.segments.push(`${donutColors[i % donutColors.length]} ${startPct}% ${endPct}%`);
        acc.cumulative += d.value;
        return acc;
      }, { segments: [] as string[], cumulative: 0 }).segments.join(', ')
    : 'transparent 0% 100%';

  // File preview content
  const filePreview = data ? [
    `SEPP|${data.periodo.mes}|${data.periodo.anio}|${data.totales.total_empleados}`,
    `TASA_LABORAL|${(data.parametros.tasa_afp_laboral * 100).toFixed(2)}%`,
    `TASA_PATRONAL|${(data.parametros.tasa_afp_patronal * 100).toFixed(2)}%`,
    ...Object.entries(data.por_administradora).map(([admin, info]) =>
      `ADMIN|${admin}|${info.empleados.length}|${fmt(info.total)}`
    ),
    ...data.empleados.slice(0, 2).map(e => `${e.dui}|${e.nup || 'N/A'}|${e.afp_administradora || 'N/A'}|${e.nombre}|${fmt(e.ibc)}|${fmt(e.cotizacion_laboral)}`),
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
                <Landmark className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Planilla AFP</h2>
                <p className="text-emerald-100 text-sm">Administradora de Fondos de Pensiones</p>
                <p className="text-emerald-200/70 text-xs mt-0.5">Ley del SIP — Sistema de Ahorro para Pensiones</p>
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Descuento AFP</p>
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
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Tendencia Mensual de Cotizaciones AFP (6 meses)</CardTitle>
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

        {/* Donut Chart - Distribution by AFP */}
        <Card className="shadow-sm lg:col-span-2 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Distribución por Administradora</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {afpDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-36 text-sm text-slate-400">Sin datos</div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative w-28 h-28 shrink-0">
                  <div
                    className="w-full h-full rounded-full"
                    style={{ background: `conic-gradient(${conicGradient})` }}
                  />
                  <div className="absolute inset-3 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{afpDistribution.length}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {afpDistribution.map((d, i) => (
                    <div key={d.name} className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: donutColors[i % donutColors.length] }} />
                        <span className="text-slate-600 dark:text-slate-400 font-medium">{d.name}</span>
                        <span className="ml-auto font-mono text-slate-700 dark:text-slate-300 shrink-0">${fmt(d.value)}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 ml-4">{d.empleados} cotizantes</p>
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
              <div className={`p-4 sm:p-5 flex items-center gap-3 sm:w-56 ${allPresentadas ? 'bg-emerald-50 dark:bg-emerald-900/20' : daysUntilDeadline < 0 ? 'bg-red-50 dark:bg-red-900/20' : daysUntilDeadline <= 5 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                <div className={`p-2 rounded-full ${allPresentadas ? 'bg-emerald-200 dark:bg-emerald-800' : daysUntilDeadline < 0 ? 'bg-red-200 dark:bg-red-800' : daysUntilDeadline <= 5 ? 'bg-amber-200 dark:bg-amber-800' : 'bg-emerald-200 dark:bg-emerald-800'}`}>
                  {allPresentadas ? <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : daysUntilDeadline < 0 ? <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" /> : daysUntilDeadline <= 5 ? <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" /> : <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <div className="space-y-1">
                  {data.presentaciones.length > 0 ? data.presentaciones.map(p => (
                    <Badge key={p.id} className={(p.estado === 'PRESENTADO' || p.estado === 'PRESENTADA') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : p.estado === 'RECTIFICADA' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}>
                      {p.administradora}: {p.estado}
                    </Badge>
                  )) : (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">PENDIENTE</Badge>
                  )}
                </div>
              </div>
              {/* Details */}
              <div className="flex-1 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Plazo de presentación:</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Día 20 del mes siguiente</span>
                </div>
                {!allPresentadas && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Días restantes:</span>
                    <span className={`text-sm font-bold ${daysUntilDeadline < 0 ? 'text-red-600 dark:text-red-400' : daysUntilDeadline <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {daysUntilDeadline < 0 ? `Vencido por ${Math.abs(daysUntilDeadline)} días` : `${daysUntilDeadline} días`}
                    </span>
                  </div>
                )}
                {allPresentadas && data.presentaciones.map(p => p.fecha_presentacion ? (
                  <div key={p.id} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">{p.administradora}:</span>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {new Date(p.fecha_presentacion).toLocaleDateString('es-SV')}
                    </span>
                  </div>
                ) : null)}
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
                <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Laboral AFP</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{(data.parametros.tasa_afp_laboral * 100).toFixed(2)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Patronal AFP</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{(data.parametros.tasa_afp_patronal * 100).toFixed(2)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/50">
                <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Empleados</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{data.totales.total_empleados}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Enhanced Data Table ── */}
      <Card className="shadow-sm dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Datos de Cotización AFP
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
                    <th className="text-left p-3 font-semibold text-white">NUP</th>
                    <th className="text-left p-3 font-semibold text-white">AFP</th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('ibc')}>
                      <span className="flex items-center justify-end">IBC <SortIcon field="ibc" /></span>
                    </th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('cotizacion_laboral')}>
                      <span className="flex items-center justify-end">Desc. Laboral (7.25%) <SortIcon field="cotizacion_laboral" /></span>
                    </th>
                    <th className="text-right p-3 font-semibold text-white cursor-pointer select-none" onClick={() => handleSort('cotizacion_patronal')}>
                      <span className="flex items-center justify-end">Aporte Patronal (8.75%) <SortIcon field="cotizacion_patronal" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmpleados.map((emp, idx) => (
                    <tr key={emp.id} className={`border-b dark:border-slate-700/50 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/15 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/30'}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 dark:from-teal-600 dark:to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {getInitials(emp.nombre)}
                          </div>
                          <span className="text-slate-800 dark:text-slate-200 font-medium">{emp.nombre}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.nup || '-'}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${emp.afp_administradora === 'CRECER' ? 'border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400' : 'border-teal-300 text-teal-700 dark:border-teal-600 dark:text-teal-400'}`}>
                          {emp.afp_administradora || '-'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(emp.ibc)}</td>
                      <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400 font-medium">${fmt(emp.cotizacion_laboral)}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(emp.cotizacion_patronal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-semibold">
                    <td className="p-3 text-slate-800 dark:text-slate-200" colSpan={3}>Totales ({data.totales.total_empleados})</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(data.totales.total_ibc)}</td>
                    <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400">${fmt(data.totales.total_cotizacion_laboral)}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${fmt(data.totales.total_cotizacion_patronal)}</td>
                  </tr>
                  <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-800 dark:to-teal-800">
                    <td className="p-3 text-white font-bold" colSpan={4}>Total Planilla AFP</td>
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
              {Object.keys(data.por_administradora).map(admin => {
                const pres = data.presentaciones.find(p => p.administradora === admin);
                const isPres = pres?.estado === 'PRESENTADO' || pres?.estado === 'PRESENTADA';
                return (
                  <div key={admin} className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => generateSEPP(admin)} disabled={downloadingAdmin === admin} className={admin === 'CRECER' ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600' : 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600'}>
                      {downloadingAdmin === admin ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                      Descargar SEPP {admin}
                    </Button>
                    {!isPres ? (
                      <Button
                        onClick={() => { setFormAdmin(admin); setFormFecha(new Date().toISOString().split('T')[0]); setShowPresentacionDialog(true); }}
                        variant="outline"
                        className="border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/20"
                      >
                        <Send className="h-4 w-4 mr-2" /> Registrar {admin}
                      </Button>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            {pres?.fecha_presentacion ? `Presentado ${new Date(pres.fecha_presentacion).toLocaleDateString('es-SV')}` : 'Presentado'}
                          </span>
                        </div>
                        <Button
                          onClick={() => pres && revertirPresentacion(pres.id, admin)}
                          disabled={revertingId === pres?.id}
                          variant="ghost"
                          size="sm"
                          className="text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 h-8"
                        >
                          {revertingId === pres?.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
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
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Formato SEPP</p>
                <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70">Archivo de Planilla AFP — Formato oficial para presentación ante la Superintendencia del SIP</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Formato CSV</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Planilla AFP en formato de valores separados por coma</p>
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-4 overflow-x-auto">
                <p className="text-[10px] text-slate-400 mb-2">Vista previa — Primeras líneas del archivo SEPP</p>
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

      {/* ── Dialog: Registrar Presentación AFP ── */}
      <Dialog open={showPresentacionDialog} onOpenChange={setShowPresentacionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-teal-600" />
              Registrar Presentación SEPP — AFP {formAdmin}
            </DialogTitle>
            <DialogDescription>
              Registre la radicación de la planilla SEPP ante la AFP {formAdmin}. Esto actualizará el semáforo de cumplimiento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Administradora</Label>
              <div className="flex gap-2">
                {['CRECER', 'CONFIA'].map(a => (
                  <button
                    key={a}
                    onClick={() => setFormAdmin(a)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      formAdmin === a
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-teal-300'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha-presentacion-afp">Fecha de presentación *</Label>
              <Input
                id="fecha-presentacion-afp"
                type="date"
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Fecha en que se radicó la SEPP ante la AFP {formAdmin}.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="observaciones-afp">Observaciones (opcional)</Label>
              <Textarea
                id="observaciones-afp"
                placeholder="Ej. Presentada vía portal de la AFP..."
                value={formObservaciones}
                onChange={(e) => setFormObservaciones(e.target.value)}
                rows={3}
              />
            </div>
            <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
              <p className="text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                <strong>Acción auditable:</strong> Este registro quedará en el historial inmutable y se registrará en la bitácora con nivel de criticidad ALTA.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPresentacionDialog(false)} disabled={presentacionSaving}>
              Cancelar
            </Button>
            <Button onClick={registrarPresentacion} disabled={presentacionSaving} className="bg-teal-600 hover:bg-teal-700">
              {presentacionSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar Presentación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
