'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Loader2, CheckCircle, Clock, AlertCircle, Users, DollarSign, TrendingUp, CalendarDays, ChevronLeft, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface AfpReportProps {
  accessToken: string;
  userRole: string;
}

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const presentacionColors: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  PRESENTADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  RECTIFICADA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

// Mock trend data for 6 months
const mockTrendData = [
  { mes: 'Oct', total: 6120.40 },
  { mes: 'Nov', total: 6290.80 },
  { mes: 'Dic', total: 5980.60 },
  { mes: 'Ene', total: 6530.20 },
  { mes: 'Feb', total: 6710.90 },
  { mes: 'Mar', total: 6890.50 },
];

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

  const goToMesAnterior = () => {
    const m = parseInt(mes);
    const a = parseInt(anio);
    if (m === 1) {
      setMes('12');
      setAnio(String(a - 1));
    } else {
      setMes(String(m - 1));
    }
  };

  const goToMesActual = () => {
    setMes(String(new Date().getMonth() + 1));
    setAnio(String(new Date().getFullYear()));
  };

  const avgIbc = data ? (data.totales.total_empleados > 0 ? data.totales.total_ibc / data.totales.total_empleados : 0) : 0;
  const trendMax = Math.max(...mockTrendData.map(d => d.total));

  return (
    <div className="space-y-5">
      {/* Header with Enhanced Period Selector */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Planilla AFP</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Reporte de cotizaciones a Administradoras de Fondos de Pensiones</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={goToMesAnterior} className="text-xs gap-1 dark:border-slate-600 dark:text-slate-300">
              <ChevronLeft className="h-3.5 w-3.5" /> Mes Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={goToMesActual} className="text-xs gap-1 dark:border-slate-600 dark:text-slate-300">
              <CalendarDays className="h-3.5 w-3.5" /> Mes Actual
            </Button>
          </div>
        </div>

        {/* Visual Period Selector */}
        <Card className="shadow-sm dark:border-slate-700">
          <CardContent className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Período:</span>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-36 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={anio} onValueChange={setAnio}>
                <SelectTrigger className="w-24 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-900/20">
                {meses[parseInt(mes) - 1]} {anio}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Summary Header - 4 Stat Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="shadow-sm overflow-hidden dark:border-slate-700">
            <CardContent className="p-4 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Cotizantes</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{data.totales.total_empleados}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm overflow-hidden dark:border-slate-700">
            <CardContent className="p-4 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/40 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                  <DollarSign className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Cotización</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${data.totales.total_general.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm overflow-hidden dark:border-slate-700">
            <CardContent className="p-4 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/40 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/50">
                  <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Promedio IBC</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${avgIbc.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm overflow-hidden dark:border-slate-700">
            <CardContent className="p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700/50">
                  <CalendarDays className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Período</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{meses[data.periodo.mes - 1]} {data.periodo.anio}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mini Contribution Trend Chart */}
      <Card className="shadow-sm dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Tendencia de Cotizaciones AFP (6 meses)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex items-end gap-2 h-28">
            {mockTrendData.map((item, idx) => {
              const heightPct = trendMax > 0 ? (item.total / trendMax) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">${(item.total / 1000).toFixed(1)}k</span>
                  <div className="w-full relative" style={{ height: '80px' }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 dark:from-emerald-700 dark:to-emerald-500 transition-all duration-300"
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

      {/* Parameters */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Laboral AFP</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{(data.parametros.tasa_afp_laboral * 100).toFixed(2)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Patronal AFP</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{(data.parametros.tasa_afp_patronal * 100).toFixed(2)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Empleados</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.totales.total_empleados}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submission tracking */}
      {data && data.presentaciones.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {data.presentaciones.map((p) => (
            <Card key={p.id} className="shadow-sm flex-1 min-w-48 dark:border-slate-700">
              <CardContent className="p-3 flex items-center gap-3">
                <Badge className={presentacionColors[p.estado]}>{p.estado}</Badge>
                <div>
                  <p className="text-sm font-medium dark:text-slate-200">{p.administradora}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.fecha_presentacion ? new Date(p.fecha_presentacion).toLocaleDateString('es-SV') : 'Pendiente'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* SEPP generation buttons */}
      {data && (
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => generateSEPP('CRECER')} disabled={!data.por_administradora.CRECER?.total || downloadingAdmin === 'CRECER'} size="sm" className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
            {downloadingAdmin === 'CRECER' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />} Generar SEPP CRECER
          </Button>
          <Button onClick={() => generateSEPP('CONFIA')} disabled={!data.por_administradora.CONFIA?.total || downloadingAdmin === 'CONFIA'} size="sm" className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600">
            {downloadingAdmin === 'CONFIA' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />} Generar SEPP CONFIA
          </Button>
        </div>
      )}

      {/* Employee Table */}
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
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                  <tr className="border-b dark:border-slate-700">
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Nombre</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">NUP</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">AFP</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">IBC</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Cot. Laboral (7.25%)</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Cot. Patronal (8.75%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.empleados.map((emp, idx) => (
                    <tr key={emp.id} className={`border-b dark:border-slate-700/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
                      <td className="p-3 text-slate-800 dark:text-slate-200">{emp.nombre}</td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.nup || '-'}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs dark:border-slate-600 dark:text-slate-300">{emp.afp_administradora || '-'}</Badge></td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.ibc.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.cotizacion_laboral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.cotizacion_patronal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-semibold">
                    <td className="p-3 text-slate-800 dark:text-slate-200" colSpan={3}>Totales ({data.totales.total_empleados})</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_ibc.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_cotizacion_laboral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_cotizacion_patronal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-emerald-50 dark:bg-emerald-900/20">
                    <td className="p-3 text-emerald-800 dark:text-emerald-300 font-bold" colSpan={4}>Total General</td>
                    <td className="p-3 text-right text-emerald-800 dark:text-emerald-300 font-bold font-mono" colSpan={2}>
                      ${data.totales.total_general.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
