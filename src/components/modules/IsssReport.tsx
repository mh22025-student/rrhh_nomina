'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
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

const presentacionColors: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  PRESENTADA: 'bg-emerald-100 text-emerald-800',
  RECTIFICADA: 'bg-blue-100 text-blue-800',
};

const presentacionIcons: Record<string, React.ElementType> = {
  PENDIENTE: Clock,
  PRESENTADA: CheckCircle,
  RECTIFICADA: AlertCircle,
};

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

  const generateOIS = () => {
    if (!data) return;
    // Simulate OIS file generation
    const lines = data.empleados.map((e) =>
      `${e.numero_isss || '0000000000'}|${e.dui}|${e.nombre}|${e.salario_cotizable.toFixed(2)}|${e.cotizacion_laboral.toFixed(2)}|${e.cotizacion_patronal.toFixed(2)}`
    );
    const content = `OIS|${data.periodo.mes}|${data.periodo.anio}\n${lines.join('\n')}\nT|${data.totales.total_empleados}|${data.totales.total_salario_cotizable.toFixed(2)}|${data.totales.total_cotizacion_laboral.toFixed(2)}|${data.totales.total_cotizacion_patronal.toFixed(2)}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OIS_${data.periodo.mes}_${data.periodo.anio}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Archivo OIS generado', description: 'El archivo ha sido descargado' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Planilla ISSS</h2>
          <p className="text-sm text-slate-500">Reporte de cotizaciones al Instituto Salvadoreño del Seguro Social</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Parameters + Status */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Tasa Laboral</p>
              <p className="text-xl font-bold text-slate-900">{(data.parametros.tasa_isss_laboral * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Tasa Patronal</p>
              <p className="text-xl font-bold text-slate-900">{(data.parametros.tasa_isss_patronal * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Tope Cotización</p>
              <p className="text-xl font-bold text-slate-900">${data.parametros.tope_cotizacion_isss.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submission Status */}
      {data?.presentacion && (
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            {(() => {
              const Icon = presentacionIcons[data.presentacion.estado] || Clock;
              return <Icon className="h-5 w-5" />;
            })()}
            <div className="flex-1">
              <p className="text-sm font-medium">Estado de Presentación</p>
              <p className="text-xs text-slate-500">
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
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" /> Datos de Cotización
          </CardTitle>
          <Button onClick={generateOIS} disabled={!data || data.empleados.length === 0} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Download className="h-3.5 w-3.5 mr-1" /> Generar OIS
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !data || data.empleados.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No hay datos para el período seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold text-slate-700">Nombre</th>
                    <th className="text-left p-3 font-semibold text-slate-700">N° ISSS</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Salario Cotizable</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Cot. Laboral (3%)</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Cot. Patronal (7.5%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.empleados.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50">
                      <td className="p-3">{emp.nombre}</td>
                      <td className="p-3 font-mono text-xs">{emp.numero_isss || '-'}</td>
                      <td className="p-3 text-right">${emp.salario_cotizable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">${emp.cotizacion_laboral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">${emp.cotizacion_patronal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-100 font-semibold">
                  <tr>
                    <td className="p-3" colSpan={2}>Totales ({data.totales.total_empleados} empleados)</td>
                    <td className="p-3 text-right">${data.totales.total_salario_cotizable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">${data.totales.total_cotizacion_laboral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">${data.totales.total_cotizacion_patronal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-emerald-50">
                    <td className="p-3 text-emerald-800" colSpan={3}>Total General</td>
                    <td className="p-3 text-right text-emerald-800" colSpan={2}>
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
