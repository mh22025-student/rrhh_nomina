'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  User, Calendar, FileText, Download, Plus, Clock, CheckCircle,
  Loader2, Briefcase, MapPin, DollarSign, Plane, FileBadge, Receipt,
  ChevronRight, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface SelfServicePortalProps {
  accessToken: string;
  userRole: string;
}

interface SelfServiceData {
  empleado: {
    id: string; codigo_empleado: string; primer_nombre: string; segundo_nombre: string | null;
    primer_apellido: string; segundo_apellido: string | null; dui: string;
    email_personal: string | null; telefono: string | null; fecha_ingreso: string;
    salario_base: number; genero: string | null; estado: string;
  };
  area: { id: string; nombre: string; codigo: string } | null;
  perfil_puesto: { id: string; nombre_puesto: string; banda_salarial: { nombre: string; grado: number } | null } | null;
  vacaciones: { id: string; anio: number; dias_derecho: number; dias_tomados: number; dias_pendientes: number; estado: string }[];
  recibos: { id: string; periodo_inicio: string; periodo_fin: string; tipo: string; salario_bruto: number; total_descuentos: number; salario_neto: number; isss_laboral: number; afp_laboral: number; isr_retenido: number }[];
  documentos: { id: string; tipo_documento: string; nombre_archivo: string; descripcion: string | null; fecha_creacion: string }[];
  solicitudes: { id: string; tipo: string; estado: string; detalle: string | null; fecha_solicitud: string; fecha_resolucion: string | null }[];
}

const solicitudTipos = [
  { value: 'VACACION', label: 'Vacaciones', icon: Plane, color: 'text-sky-600', bg: 'bg-sky-50' },
  { value: 'CONSTANCIA_EMPLEO', label: 'Constancia Empleo', icon: FileBadge, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'CONSTANCIA_SALARIAL', label: 'Constancia Salarial', icon: Receipt, color: 'text-violet-600', bg: 'bg-violet-50' },
  { value: 'CONSTANCIA_ISR', label: 'Constancia ISR', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
];

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};

export default function SelfServicePortal({ accessToken }: SelfServicePortalProps) {
  const { toast } = useToast();
  const [data, setData] = useState<SelfServiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState('');
  const [requestDetail, setRequestDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/selfservice', {
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
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmitRequest = async () => {
    if (!requestType) {
      toast({ title: 'Error', description: 'Seleccione un tipo de solicitud', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/selfservice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: requestType, detalle: requestDetail }),
      });
      if (res.ok) {
        toast({ title: 'Solicitud enviada', description: 'Su solicitud ha sido registrada exitosamente' });
        setShowRequestDialog(false);
        setRequestType('');
        setRequestDetail('');
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadBoleta = async (planillaId: string) => {
    try {
      setDownloadingId(planillaId);
      const res = await fetch(`/api/nomina/planillas/${planillaId}/boleta?empleado_id=${data!.empleado.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al generar boleta');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Boleta_${data!.empleado.codigo_empleado}_${planillaId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Boleta descargada', description: 'El PDF de su recibo ha sido descargado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar la boleta', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-sm max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No se pudieron cargar sus datos</p>
        </CardContent>
      </Card>
    );
  }

  const emp = data.empleado;
  const totalDiasPendientes = data.vacaciones.reduce((s, v) => s + v.dias_pendientes, 0);
  const totalDiasTomados = data.vacaciones.reduce((s, v) => s + v.dias_tomados, 0);
  const totalDiasDerecho = data.vacaciones.reduce((s, v) => s + v.dias_derecho, 0);
  const vacationProgress = totalDiasDerecho > 0 ? Math.round((totalDiasTomados / totalDiasDerecho) * 100) : 0;

  const getSolicitudBadge = (estado: string) => {
    if (estado === 'PENDIENTE') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (estado === 'APROBADA') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header card with gradient */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold ring-2 ring-white/30">
            {emp.primer_nombre[0]}{emp.primer_apellido[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">
              {emp.primer_nombre} {emp.segundo_nombre || ''} {emp.primer_apellido} {emp.segundo_apellido || ''}
            </h2>
            <p className="text-emerald-100 text-sm flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              {emp.codigo_empleado} · {data.perfil_puesto?.nombre_puesto || 'Sin puesto'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px]">
                {data.area?.nombre || 'Sin área'}
              </Badge>
              <Badge variant="secondary" className="bg-emerald-400/30 text-white border-0 text-[10px]">
                {emp.estado}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Vacation Balance with Progress */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plane className="h-4 w-4 text-sky-600" /> Saldo de Vacaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual progress */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">Días utilizados</span>
                <span className="text-xs font-semibold text-slate-700">{totalDiasTomados} / {totalDiasDerecho}</span>
              </div>
              <Progress value={vacationProgress} className="h-3" />
            </div>
          </div>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
              <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Pendientes</p>
              <p className="text-2xl font-bold text-emerald-700 mt-0.5">{totalDiasPendientes}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Tomados</p>
              <p className="text-2xl font-bold text-slate-700 mt-0.5">{totalDiasTomados}</p>
            </div>
            <div className="bg-teal-50 rounded-lg p-3 text-center border border-teal-100">
              <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Derecho</p>
              <p className="text-2xl font-bold text-teal-700 mt-0.5">{totalDiasDerecho}</p>
            </div>
          </div>
          {/* Per year breakdown */}
          {data.vacaciones.length > 0 && (
            <div className="space-y-1.5">
              {data.vacaciones.map((v) => {
                const yearProgress = v.dias_derecho > 0 ? Math.round((v.dias_tomados / v.dias_derecho) * 100) : 0;
                return (
                  <div key={v.id} className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700">Año {v.anio}</span>
                      <span className="text-[10px] text-slate-500">{v.dias_pendientes} pendientes</span>
                    </div>
                    <Progress value={yearProgress} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Pay Slips */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-violet-600" /> Recibos de Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recibos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Receipt className="h-8 w-8 mb-2 text-slate-300" />
              <p className="text-sm">No hay recibos disponibles</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recibos.map((recibo) => (
                <div key={recibo.id} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-lg border border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {new Date(recibo.periodo_inicio).toLocaleDateString('es-SV', { month: 'short', year: 'numeric' })}
                      </p>
                      <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600">
                        {recibo.tipo}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>Bruto: <span className="font-mono font-medium text-slate-700">{fmt(recibo.salario_bruto)}</span></span>
                      <span>Neto: <span className="font-mono font-semibold text-emerald-700">{fmt(recibo.salario_neto)}</span></span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 ml-2 h-8 text-xs gap-1.5"
                    onClick={() => handleDownloadBoleta(recibo.id)}
                    disabled={downloadingId === recibo.id}
                  >
                    {downloadingId === recibo.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Buttons */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" /> Nueva Solicitud
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5">
            {solicitudTipos.map((tipo) => (
              <button
                key={tipo.value}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer text-left group"
                onClick={() => { setRequestType(tipo.value); setShowRequestDialog(true); }}
              >
                <div className={`p-2 rounded-lg ${tipo.bg} group-hover:scale-110 transition-transform`}>
                  <tipo.icon className={`h-4 w-4 ${tipo.color}`} />
                </div>
                <span className="text-xs font-medium text-slate-700">{tipo.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 ml-auto" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* My Requests */}
      {data.solicitudes.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" /> Mis Solicitudes
              <Badge variant="secondary" className="ml-1 text-[10px] bg-slate-100 text-slate-600">
                {data.solicitudes.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.solicitudes.map((sol) => (
                <div key={sol.id} className="flex items-center justify-between p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{sol.tipo.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmtDate(sol.fecha_solicitud)}</p>
                  </div>
                  <Badge className={`text-[10px] border shrink-0 ml-2 ${getSolicitudBadge(sol.estado)}`}>
                    {sol.estado}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Info Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600" /> Información Personal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Código</p>
              <p className="font-medium text-slate-800 font-mono text-xs">{emp.codigo_empleado}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Área</p>
              <p className="font-medium text-slate-800">{data.area?.nombre || 'Sin área'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Puesto</p>
              <p className="font-medium text-slate-800">{data.perfil_puesto?.nombre_puesto || 'Sin puesto'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Fecha Ingreso</p>
              <p className="font-medium text-slate-800">{fmtDate(emp.fecha_ingreso)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">DUI</p>
              <p className="font-medium text-slate-800">{emp.dui}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Teléfono</p>
              <p className="font-medium text-slate-800">{emp.telefono || '—'}</p>
            </div>
            {data.perfil_puesto?.banda_salarial && (
              <div className="col-span-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Banda Salarial</p>
                <p className="font-medium text-slate-800">{data.perfil_puesto.banda_salarial.nombre} (Grado {data.perfil_puesto.banda_salarial.grado})</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud</DialogTitle>
            <DialogDescription>Complete la información para su solicitud</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Solicitud</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {solicitudTipos.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Detalle / Comentario</Label>
              <Textarea value={requestDetail} onChange={(e) => setRequestDetail(e.target.value)} placeholder="Información adicional..." rows={3} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancelar</Button>
              <Button onClick={handleSubmitRequest} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar Solicitud
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
