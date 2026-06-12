'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, Loader2 } from 'lucide-react';
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Retenciones ISR</h2>
          <p className="text-sm text-slate-500">Reporte de retenciones de Impuesto sobre la Renta</p>
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

      {/* ISR Tramos */}
      {data && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tramos ISR Vigentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-center p-2 font-semibold">Tramo</th>
                    <th className="text-right p-2 font-semibold">Desde</th>
                    <th className="text-right p-2 font-semibold">Hasta</th>
                    <th className="text-right p-2 font-semibold">Porcentaje</th>
                    <th className="text-right p-2 font-semibold">Cuota Fija</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parametros.tramos_isr.map((t) => (
                    <tr key={t.numero_tramo} className="border-b">
                      <td className="p-2 text-center"><Badge variant="outline">Tramo {t.numero_tramo}</Badge></td>
                      <td className="p-2 text-right">${t.desde.toLocaleString()}</td>
                      <td className="p-2 text-right">{t.hasta ? `$${t.hasta.toLocaleString()}` : 'En adelante'}</td>
                      <td className="p-2 text-right">{(t.porcentaje * 100).toFixed(0)}%</td>
                      <td className="p-2 text-right">${t.cuota_fija.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <Badge className={data.entero.estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-800' : 'bg-emerald-100 text-emerald-800'}>
              {data.entero.estado}
            </Badge>
            <div className="flex-1">
              <p className="text-sm font-medium">Entero de ISR</p>
              <p className="text-xs text-slate-500">
                {data.entero.fecha_entero ? `Enterado el ${new Date(data.entero.fecha_entero).toLocaleDateString('es-SV')}` : 'Pendiente de entero'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" /> Retenciones ISR por Empleado
          </CardTitle>
          <Button onClick={generateF910} disabled={!data || data.empleados.length === 0 || downloading} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            {downloading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />} Generar F-910
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
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
                    <th className="text-left p-3 font-semibold text-slate-700">DUI</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Salario Bruto</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Deducciones</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Renta Imponible</th>
                    <th className="text-right p-3 font-semibold text-slate-700">ISR Retenido</th>
                    <th className="text-center p-3 font-semibold text-slate-700">Constancia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.empleados.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50">
                      <td className="p-3">{emp.nombre}</td>
                      <td className="p-3 font-mono text-xs">{emp.dui}</td>
                      <td className="p-3 text-right">${emp.salario_bruto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">${emp.deducciones.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">${emp.renta_imponible.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-medium">${emp.isr_retenido.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => generateConstancia(emp.id, emp.nombre)} title="Generar constancia">
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-100 font-semibold">
                  <tr>
                    <td className="p-3" colSpan={2}>Totales ({data.totales.total_empleados})</td>
                    <td className="p-3 text-right">${data.totales.total_salario_bruto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">${data.totales.total_deducciones.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">${data.totales.total_renta_imponible.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right text-emerald-700">${data.totales.total_isr_retenido.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
