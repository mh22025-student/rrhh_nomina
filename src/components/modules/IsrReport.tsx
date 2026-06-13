'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, Loader2, Users, DollarSign, TrendingUp, CalendarDays, ChevronLeft } from 'lucide-react';
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

// Mock trend data for 6 months
const mockTrendData = [
  { mes: 'Oct', total: 2850.30 },
  { mes: 'Nov', total: 2920.60 },
  { mes: 'Dic', total: 2780.40 },
  { mes: 'Ene', total: 3100.80 },
  { mes: 'Feb', total: 3250.15 },
  { mes: 'Mar', total: 3380.90 },
];

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

  const generateConstancia = (empId: string, empNombre: string) => {
    if (!data) return;
    const emp = data.empleados.find((e) => e.id === empId);
    if (!emp) return;

    const content = `CONSTANCIA DE RETENCIÓN ISR\n\nNombre: ${empNombre}\nDUI: ${emp.dui}\nPeríodo: ${meses[data.periodo.mes - 1]} ${data.periodo.anio}\n\nSalario Bruto: $${emp.salario_bruto.toFixed(2)}\nDeducciones (ISSS+AFP): $${emp.deducciones.toFixed(2)}\nRenta Imponible: $${emp.renta_imponible.toFixed(2)}\nISR Retenido: $${emp.isr_retenido.toFixed(2)}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Constancia_ISR_${emp.dui}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Constancia generada', description: `Constancia ISR de ${empNombre}` });
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

  const avgSalario = data ? (data.totales.total_empleados > 0 ? data.totales.total_salario_bruto / data.totales.total_empleados : 0) : 0;
  const trendMax = Math.max(...mockTrendData.map(d => d.total));

  return (
    <div className="space-y-5">
      {/* Header with Enhanced Period Selector */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Retenciones ISR</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Reporte de retenciones de Impuesto sobre la Renta</p>
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total ISR Retenido</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">${data.totales.total_isr_retenido.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
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

      {/* Mini ISR Trend Chart */}
      <Card className="shadow-sm dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Tendencia de Retenciones ISR (6 meses)</CardTitle>
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

      {/* ISR Tramos */}
      {data && (
        <Card className="shadow-sm dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base dark:text-slate-200">Tramos ISR Vigentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                    <th className="text-center p-2 font-semibold text-slate-700 dark:text-slate-300">Tramo</th>
                    <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Desde</th>
                    <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Hasta</th>
                    <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Porcentaje</th>
                    <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Cuota Fija</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parametros.tramos_isr.map((t, idx) => (
                    <tr key={t.numero_tramo} className={`border-b dark:border-slate-700/50 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
                      <td className="p-2 text-center"><Badge variant="outline" className="text-xs dark:border-slate-600 dark:text-slate-300">Tramo {t.numero_tramo}</Badge></td>
                      <td className="p-2 text-right font-mono text-slate-800 dark:text-slate-200">${t.desde.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono text-slate-800 dark:text-slate-200">{t.hasta ? `$${t.hasta.toLocaleString()}` : 'En adelante'}</td>
                      <td className="p-2 text-right font-mono text-slate-800 dark:text-slate-200">{(t.porcentaje * 100).toFixed(0)}%</td>
                      <td className="p-2 text-right font-mono text-slate-800 dark:text-slate-200">${t.cuota_fija.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submission Status */}
      {data?.entero && (
        <Card className="shadow-sm dark:border-slate-700">
          <CardContent className="p-4 flex items-center gap-3">
            <Badge className={data.entero.estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'}>
              {data.entero.estado}
            </Badge>
            <div className="flex-1">
              <p className="text-sm font-medium dark:text-slate-200">Entero de ISR</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.entero.fecha_entero ? `Enterado el ${new Date(data.entero.fecha_entero).toLocaleDateString('es-SV')}` : 'Pendiente de entero'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Table */}
      <Card className="shadow-sm dark:border-slate-700">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Retenciones ISR por Empleado
          </CardTitle>
          <Button onClick={generateF910} disabled={!data || data.empleados.length === 0 || downloading} size="sm" className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
            {downloading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />} Generar F-910
          </Button>
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
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">DUI</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Salario Bruto</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Deducciones</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Renta Imponible</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">ISR Retenido</th>
                    <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Constancia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.empleados.map((emp, idx) => (
                    <tr key={emp.id} className={`border-b dark:border-slate-700/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
                      <td className="p-3 text-slate-800 dark:text-slate-200">{emp.nombre}</td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.dui}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.salario_bruto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.deducciones.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${emp.renta_imponible.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-medium font-mono text-emerald-700 dark:text-emerald-400">${emp.isr_retenido.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => generateConstancia(emp.id, emp.nombre)} title="Generar constancia" className="dark:text-slate-300 dark:hover:bg-slate-700">
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-semibold">
                    <td className="p-3 text-slate-800 dark:text-slate-200" colSpan={2}>Totales ({data.totales.total_empleados})</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_salario_bruto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_deducciones.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">${data.totales.total_renta_imponible.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-emerald-700 dark:text-emerald-400">${data.totales.total_isr_retenido.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td />
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
