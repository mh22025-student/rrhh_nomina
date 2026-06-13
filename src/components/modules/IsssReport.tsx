'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, Loader2, CheckCircle, Clock, AlertCircle, Users, DollarSign, TrendingUp, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
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
const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];

const presentacionColors: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  PRESENTADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  RECTIFICADA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

const presentacionIcons: Record<string, React.ElementType> = {
  PENDIENTE: Clock,
  PRESENTADA: CheckCircle,
  RECTIFICADA: AlertCircle,
};

// Mock trend data for 6 months
const mockTrendData = [
  { mes: 'Oct', total: 4250.80 },
  { mes: 'Nov', total: 4380.15 },
  { mes: 'Dic', total: 4190.50 },
  { mes: 'Ene', total: 4520.30 },
  { mes: 'Feb', total: 4610.75 },
  { mes: 'Mar', total: 4750.00 },
];

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

  const avgSalario = data ? (data.totales.total_empleados > 0 ? data.totales.total_salario_cotizable / data.totales.total_empleados : 0) : 0;
  const trendMax = Math.max(...mockTrendData.map(d => d.total));

  return (
    <div className="space-y-5">
      {/* Header with Enhanced Period Selector */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Planilla ISSS</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Reporte de cotizaciones al Instituto Salvadoreño del Seguro Social</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick select buttons */}
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Promedio Salario</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${avgSalario.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
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
          <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Tendencia de Cotizaciones (6 meses)</CardTitle>
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

      {/* Parameters + Status */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Laboral</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{(data.parametros.tasa_isss_laboral * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Patronal</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{(data.parametros.tasa_isss_patronal * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tope Cotización</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">${data.parametros.tope_cotizacion_isss.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submission Status */}
      {data?.presentacion && (
        <Card className="shadow-sm dark:border-slate-700">
          <CardContent className="p-4 flex items-center gap-3">
            {(() => {
              const Icon = presentacionIcons[data.presentacion.estado] || Clock;
              return <Icon className="h-5 w-5 dark:text-slate-400" />;
            })()}
            <div className="flex-1">
              <p className="text-sm font-medium dark:text-slate-200">Estado de Presentación</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.presentacion.fecha_presentacion
                  ? `Presentada el ${new Date(data.presentacion.fecha_presentacion).toLocaleDateString('es-SV')}`
                  : 'Pendiente de presentación'}
              </p>
            </div>
            <Badge className={presentacionColors[data.presentacion.estado]}>
              {data.presentacion.estado}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Employee Table */}
      <Card className="shadow-sm dark:border-slate-700">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Datos de Cotización
          </CardTitle>
          <Button onClick={generateOIS} disabled={!data || data.empleados.length === 0 || downloading} size="sm" className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
            {downloading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />} Generar OIS
          </Button>
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
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                  <tr className="border-b dark:border-slate-700">
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Nombre</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">N° ISSS</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Salario Cotizable</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Cot. Laboral (3%)</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Cot. Patronal (7.5%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.empleados.map((emp, idx) => (
                    <tr key={emp.id} className={`border-b dark:border-slate-700/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
                      <td className="p-3 text-slate-800 dark:text-slate-200">{emp.nombre}</td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.numero_isss || '-'}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.salario_cotizable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.cotizacion_laboral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.cotizacion_patronal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-semibold">
                    <td className="p-3 text-slate-800 dark:text-slate-200" colSpan={2}>Totales ({data.totales.total_empleados} empleados)</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_salario_cotizable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_cotizacion_laboral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_cotizacion_patronal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-emerald-50 dark:bg-emerald-900/20">
                    <td className="p-3 text-emerald-800 dark:text-emerald-300 font-bold" colSpan={3}>Total General</td>
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
