'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  User, Calendar, FileText, Download, Plus, Clock, CheckCircle,
  Loader2, Briefcase, MapPin, DollarSign, Plane, FileBadge, Receipt,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
  { value: 'VACACION', label: 'Solicitar Vacaciones', icon: Plane },
  { value: 'CONSTANCIA_EMPLEO', label: 'Constancia de Empleo', icon: FileBadge },
  { value: 'CONSTANCIA_SALARIAL', label: 'Constancia Salarial', icon: Receipt },
  { value: 'CONSTANCIA_ISR', label: 'Constancia ISR', icon: FileText },
];

export default function SelfServicePortal({ accessToken }: SelfServicePortalProps) {
  const { toast } = useToast();
  const [data, setData] = useState<SelfServiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
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

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-32 w-full" />
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

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
            {emp.primer_nombre[0]}{emp.primer_apellido[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">
              {emp.primer_nombre} {emp.segundo_nombre || ''} {emp.primer_apellido} {emp.segundo_apellido || ''}
            </h2>
            <p className="text-emerald-100 text-sm">
              {emp.codigo_empleado} · {data.perfil_puesto?.nombre_puesto || 'Sin puesto'}
            </p>
          </div>
        </div>
      </div>

      {/* Personal Info Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600" /> Información Personal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Código</p>
              <p className="font-medium">{emp.codigo_empleado}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Área</p>
              <p className="font-medium">{data.area?.nombre || 'Sin área'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Puesto</p>
              <p className="font-medium">{data.perfil_puesto?.nombre_puesto || 'Sin puesto'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Fecha Ingreso</p>
              <p className="font-medium">{new Date(emp.fecha_ingreso).toLocaleDateString('es-SV')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">DUI</p>
              <p className="font-medium">{emp.dui}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Teléfono</p>
              <p className="font-medium">{emp.telefono || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vacation Balance */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plane className="h-4 w-4 text-emerald-600" /> Saldo de Vacaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-xs text-emerald-600">Días Pendientes</p>
              <p className="text-2xl font-bold text-emerald-700">{totalDiasPendientes}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500">Días Tomados</p>
              <p className="text-2xl font-bold text-slate-700">{totalDiasTomados}</p>
            </div>
          </div>
          {data.vacaciones.length > 0 && (
            <div className="space-y-1.5">
              {data.vacaciones.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs bg-slate-50 rounded p-2">
                  <span className="font-medium">Año {v.anio}</span>
                  <span className="text-slate-500">{v.dias_derecho} derecho · {v.dias_tomados} tomados · {v.dias_pendientes} pendientes</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Pay Slips */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-600" /> Recibos Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recibos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No hay recibos disponibles</p>
          ) : (
            <div className="space-y-2">
              {data.recibos.map((recibo) => (
                <div key={recibo.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(recibo.periodo_inicio).toLocaleDateString('es-SV', { month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-slate-500">
                      Bruto: ${recibo.salario_bruto.toFixed(2)} · Neto: ${recibo.salario_neto.toFixed(2)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-3.5 w-3.5" />
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
            <Plus className="h-4 w-4 text-emerald-600" /> Solicitudes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {solicitudTipos.map((tipo) => (
              <Button
                key={tipo.value}
                variant="outline"
                className="h-auto py-3 flex flex-col items-center gap-1.5"
                onClick={() => { setRequestType(tipo.value); setShowRequestDialog(true); }}
              >
                <tipo.icon className="h-5 w-5 text-emerald-600" />
                <span className="text-xs">{tipo.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* My Requests */}
      {data.solicitudes.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" /> Mis Solicitudes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.solicitudes.map((sol) => (
                <div key={sol.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium">{sol.tipo.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500">{new Date(sol.fecha_solicitud).toLocaleDateString('es-SV')}</p>
                  </div>
                  <Badge className={
                    sol.estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-800' :
                    sol.estado === 'APROBADA' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {sol.estado}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
