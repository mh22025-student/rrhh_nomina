'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send, Building2, Download, Loader2, CheckCircle, XCircle,
  Clock, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface BankDispersionProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PlanillaOption {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  total_neto_a_pagar: number;
  total_empleados: number;
}

interface DispersionResult {
  banco_id: string;
  banco_nombre: string;
  banco_codigo: string;
  total_empleados: number;
  total_monto: number;
  archivo_nombre: string;
  retorno_id: string;
  contenido_csv: string;
}

interface RetornoBancario {
  id: string;
  banco_id: string;
  archivo_nombre: string | null;
  fecha_envio: string | null;
  fecha_retorno: string | null;
  estado: string;
  total_registros: number;
  total_monto: number;
  errores_detalle: string | null;
  banco: { nombre: string; codigo: string };
}

export default function BankDispersion({ accessToken }: BankDispersionProps) {
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<PlanillaOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dispersions, setDispersions] = useState<DispersionResult[]>([]);
  const [retornos, setRetornos] = useState<RetornoBancario[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/planillas?limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setPlanillas(data.planillas?.filter((p: PlanillaOption) => p.estado === 'APROBADA') || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar planillas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  const fetchDetail = useCallback(async (planillaId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${planillaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setRetornos(data.planilla?.retornos_bancarios || []);
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchPlanillas(); }, [fetchPlanillas]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else setRetornos([]);
  }, [selectedId, fetchDetail]);

  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${selectedId}/dispersion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar dispersión');
      setDispersions(data.dispersiones || []);
      toast({ title: 'Dispersión Generada', description: `${data.dispersiones.length} archivo(s) generado(s)` });
      fetchDetail(selectedId);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al generar dispersión', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (disp: DispersionResult) => {
    const blob = new Blob([disp.contenido_csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = disp.archivo_nombre;
    a.click();
    URL.revokeObjectURL(url);
  };

  const retornoEstadoColors: Record<string, string> = {
    PENDIENTE: 'bg-slate-100 text-slate-700',
    ENVIADO: 'bg-blue-100 text-blue-800',
    PROCESADO: 'bg-emerald-100 text-emerald-800',
    CON_ERRORES: 'bg-red-100 text-red-800',
    RECHAZADO: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-4">
      {/* Select planilla */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" /> Dispersión Bancaria
          </CardTitle>
          <CardDescription>Genere archivos de dispersión para planillas aprobadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : planillas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No hay planillas aprobadas para dispersión</p>
          ) : (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione una planilla aprobada..." /></SelectTrigger>
                  <SelectContent>
                    {planillas.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo_planilla} — {p.tipo} — {fmt(p.total_neto_a_pagar)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!selectedId || generating}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Generar Dispersión
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank summary table */}
      {dispersions.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumen por Banco</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-slate-50/80">
                    <th className="text-left font-medium text-slate-500 p-3">Banco</th>
                    <th className="text-right font-medium text-slate-500 p-3">Empleados</th>
                    <th className="text-right font-medium text-slate-500 p-3">Total</th>
                    <th className="text-left font-medium text-slate-500 p-3">Archivo</th>
                    <th className="text-center font-medium text-slate-500 p-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {dispersions.map(d => (
                    <tr key={d.banco_id} className="border-b hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="font-medium">{d.banco_nombre}</p>
                            <p className="text-xs text-slate-400">Código: {d.banco_codigo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right">{d.total_empleados}</td>
                      <td className="p-3 text-right font-medium">{fmt(d.total_monto)}</td>
                      <td className="p-3 font-mono text-xs">{d.archivo_nombre}</td>
                      <td className="p-3 text-center">
                        <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>
                          <Download className="h-3.5 w-3.5 mr-1" /> Descargar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Return status tracking */}
      {retornos.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estado de Retornos Bancarios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-slate-50/80">
                    <th className="text-left font-medium text-slate-500 p-3">Banco</th>
                    <th className="text-left font-medium text-slate-500 p-3">Archivo</th>
                    <th className="text-left font-medium text-slate-500 p-3">Estado</th>
                    <th className="text-right font-medium text-slate-500 p-3">Registros</th>
                    <th className="text-right font-medium text-slate-500 p-3">Monto</th>
                    <th className="text-left font-medium text-slate-500 p-3">Fecha Envío</th>
                  </tr>
                </thead>
                <tbody>
                  {retornos.map(r => (
                    <tr key={r.id} className="border-b hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <span>{r.banco?.nombre || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">{r.archivo_nombre || '-'}</td>
                      <td className="p-3">
                        <Badge className={`text-[10px] ${retornoEstadoColors[r.estado] || 'bg-slate-100'}`} variant="secondary">
                          {r.estado}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{r.total_registros}</td>
                      <td className="p-3 text-right font-medium">{fmt(r.total_monto)}</td>
                      <td className="p-3 text-xs">{r.fecha_envio ? new Date(r.fecha_envio).toLocaleDateString('es-SV') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {retornos.some(r => r.estado === 'CON_ERRORES' || r.estado === 'RECHAZADO') && (
              <div className="p-3 bg-red-50 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Algunos retornos tienen errores. Revise los detalles con el banco.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
