'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
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
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  PRESENTADA: 'bg-emerald-100 text-emerald-800',
  RECTIFICADA: 'bg-blue-100 text-blue-800',
};

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

  const generateSEPP = (admin: string) => {
    if (!data) return;
    const adminData = data.por_administradora[admin];
    if (!adminData) return;

    const lines = adminData.empleados.map((e) =>
      `${e.nup || '0000000000'}|${e.dui}|${e.nombre}|${e.ibc.toFixed(2)}|${e.cotizacion_laboral.toFixed(2)}|${e.cotizacion_patronal.toFixed(2)}`
    );
    const content = `SEPP|${admin}|${data.periodo.mes}|${data.periodo.anio}\n${lines.join('\n')}\nT|${adminData.total}|${adminData.total_cot_laboral.toFixed(2)}|${adminData.total_cot_patronal.toFixed(2)}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SEPP_${admin}_${data.periodo.mes}_${data.periodo.anio}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Archivo SEPP ${admin} generado`, description: 'El archivo ha sido descargado' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Planilla AFP</h2>
          <p className="text-sm text-slate-500">Reporte de cotizaciones a Administradoras de Fondos de Pensiones</p>
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

      {/* Parameters */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Tasa Laboral AFP</p>
              <p className="text-xl font-bold text-slate-900">{(data.parametros.tasa_afp_laboral * 100).toFixed(2)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Tasa Patronal AFP</p>
              <p className="text-xl font-bold text-slate-900">{(data.parametros.tasa_afp_patronal * 100).toFixed(2)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Total Empleados</p>
              <p className="text-xl font-bold text-slate-900">{data.totales.total_empleados}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submission tracking */}
      {data && data.presentaciones.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {data.presentaciones.map((p) => (
            <Card key={p.id} className="shadow-sm flex-1 min-w-48">
              <CardContent className="p-3 flex items-center gap-3">
                <Badge className={presentacionColors[p.estado]}>{p.estado}</Badge>
                <div>
                  <p className="text-sm font-medium">{p.administradora}</p>
                  <p className="text-xs text-slate-500">
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
          <Button onClick={() => generateSEPP('CRECER')} disabled={!data.por_administradora.CRECER?.total} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Download className="h-3.5 w-3.5 mr-1" /> Generar SEPP CRECER
          </Button>
          <Button onClick={() => generateSEPP('CONFIA')} disabled={!data.por_administradora.CONFIA?.total} size="sm" className="bg-teal-600 hover:bg-teal-700">
            <Download className="h-3.5 w-3.5 mr-1" /> Generar SEPP CONFIA
          </Button>
        </div>
      )}

      {/* Employee Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" /> Datos de Cotización AFP
          </CardTitle>
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
                    <th className="text-left p-3 font-semibold text-slate-700">NUP</th>
                    <th className="text-left p-3 font-semibold text-slate-700">AFP</th>
                    <th className="text-right p-3 font-semibold text-slate-700">IBC</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Cot. Laboral (7.25%)</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Cot. Patronal (8.75%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.empleados.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50">
                      <td className="p-3">{emp.nombre}</td>
                      <td className="p-3 font-mono text-xs">{emp.nup || '-'}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{emp.afp_administradora || '-'}</Badge></td>
                      <td className="p-3 text-right">${emp.ibc.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">${emp.cotizacion_laboral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">${emp.cotizacion_patronal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-100 font-semibold">
                  <tr>
                    <td className="p-3" colSpan={3}>Totales ({data.totales.total_empleados})</td>
                    <td className="p-3 text-right">${data.totales.total_ibc.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">${data.totales.total_cotizacion_laboral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">${data.totales.total_cotizacion_patronal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-emerald-50">
                    <td className="p-3 text-emerald-800" colSpan={4}>Total General</td>
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
