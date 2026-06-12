'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, Clock, CheckCircle2, XCircle, Plus, Filter, Loader2, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

interface IncidenceManagerProps {
  accessToken: string | null;
  userRole: UserRole;
}

interface Incidencia {
  id: string;
  tipo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  cantidad_horas: number | null;
  tipo_horas_extra: string | null;
  monto: number | null;
  descripcion: string | null;
  numero_incapacidad: string | null;
  empleado: {
    id: string;
    codigo_empleado: string;
    primer_nombre: string;
    segundo_nombre: string | null;
    primer_apellido: string;
    segundo_apellido: string | null;
  };
  aprobada_por: { nombre: string; apellido: string } | null;
}

interface EmpleadoOption {
  id: string;
  codigo_empleado: string;
  primer_nombre: string;
  primer_apellido: string;
}

const TIPO_LABELS: Record<string, string> = {
  HORAS_EXTRA: 'Horas Extra',
  AUSENCIA: 'Ausencia',
  INCAPACIDAD_ISSS: 'Incapacidad ISSS',
  PERMISO: 'Permiso',
  COMISION: 'Comisión',
  BONO: 'Bono',
  DESCUENTO_ESPECIAL: 'Descuento Especial',
};

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  APROBADA: 'bg-emerald-100 text-emerald-700',
  RECHAZADA: 'bg-red-100 text-red-700',
};

export default function IncidenceManager({ accessToken, userRole }: IncidenceManagerProps) {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 0 });
  const [tipoFilter, setTipoFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    empleado_id: '',
    tipo: 'HORAS_EXTRA',
    fecha_inicio: '',
    fecha_fin: '',
    descripcion: '',
    // Conditional
    cantidad_horas: '',
    tipo_horas_extra: 'DIURNA',
    monto: '',
    numero_incapacidad: '',
  });

  const fetchIncidencias = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));
      if (tipoFilter && tipoFilter !== 'all') params.set('tipo', tipoFilter);
      if (estadoFilter && estadoFilter !== 'all') params.set('estado', estadoFilter);

      const res = await fetch(`/api/incidencias?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setIncidencias(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching incidencias:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, pagination.page, pagination.pageSize, tipoFilter, estadoFilter]);

  useEffect(() => { fetchIncidencias(); }, [fetchIncidencias]);

  // Fetch employees for dropdown
  useEffect(() => {
    const fetchEmpleados = async () => {
      try {
        const res = await fetch('/api/empleados?pageSize=100&estado=ACTIVO', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (res.ok) setEmpleados(data.data || []);
      } catch { /* ignore */ }
    };
    fetchEmpleados();
  }, [accessToken]);

  // Summary counts
  const summary = {
    total: pagination.total,
    pendientes: incidencias.filter(i => i.estado === 'PENDIENTE').length,
    aprobadas: incidencias.filter(i => i.estado === 'APROBADA').length,
    rechazadas: incidencias.filter(i => i.estado === 'RECHAZADA').length,
  };

  const handleCreate = async () => {
    // Validate
    if (!form.empleado_id) { toast({ title: 'Error', description: 'Seleccione un empleado', variant: 'destructive' }); return; }
    if (!form.tipo) { toast({ title: 'Error', description: 'Seleccione el tipo de incidencia', variant: 'destructive' }); return; }
    if (!form.fecha_inicio) { toast({ title: 'Error', description: 'Fecha inicio es requerida', variant: 'destructive' }); return; }

    if (form.tipo === 'HORAS_EXTRA' && (!form.cantidad_horas || parseFloat(form.cantidad_horas) <= 0)) {
      toast({ title: 'Error', description: 'Cantidad de horas es requerida para HORAS_EXTRA', variant: 'destructive' });
      return;
    }
    if (['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo) && (!form.monto || parseFloat(form.monto) <= 0)) {
      toast({ title: 'Error', description: 'Monto es requerido', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        empleado_id: form.empleado_id,
        tipo: form.tipo,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || null,
        descripcion: form.descripcion || null,
      };

      if (form.tipo === 'HORAS_EXTRA') {
        body.cantidad_horas = parseFloat(form.cantidad_horas);
        body.tipo_horas_extra = form.tipo_horas_extra;
      }
      if (form.tipo === 'INCAPACIDAD_ISSS') {
        body.numero_incapacidad = form.numero_incapacidad;
      }
      if (['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo)) {
        body.monto = parseFloat(form.monto);
      }

      const res = await fetch('/api/incidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Incidencia creada', description: 'La incidencia ha sido registrada' });
        setDialogOpen(false);
        resetForm();
        fetchIncidencias();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al crear incidencia', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleApproveReject = async (id: string, estado: 'APROBADA' | 'RECHAZADA') => {
    try {
      const res = await fetch(`/api/incidencias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `Incidencia ${estado.toLowerCase()}`, description: `La incidencia ha sido ${estado === 'APROBADA' ? 'aprobada' : 'rechazada'}` });
        fetchIncidencias();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al actualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setForm({
      empleado_id: '', tipo: 'HORAS_EXTRA', fecha_inicio: '', fecha_fin: '',
      descripcion: '', cantidad_horas: '', tipo_horas_extra: 'DIURNA',
      monto: '', numero_incapacidad: '',
    });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-SV');
  const formatMonto = (v: number | null) => v ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const getNombreEmp = (inc: Incidencia) =>
    `${inc.empleado.primer_nombre} ${inc.empleado.primer_apellido}`;

  const canCreate = userRole === 'ADMIN' || userRole === 'ANALISTA';
  const canApprove = userRole === 'ADMIN' || userRole === 'APROBADOR';

  const filteredEmpleados = searchEmpleado
    ? empleados.filter(e => `${e.primer_nombre} ${e.primer_apellido} ${e.codigo_empleado}`.toLowerCase().includes(searchEmpleado.toLowerCase()))
    : empleados;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-emerald-600" /> Incidencias de Nómina
        </h2>
        {canCreate && (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Incidencia
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100"><AlertCircle className="h-5 w-5 text-slate-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-900">{summary.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Pendientes</p>
              <p className="text-xl font-bold text-amber-600">{summary.pendientes}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Aprobadas</p>
              <p className="text-xl font-bold text-emerald-600">{summary.aprobadas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50"><XCircle className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Rechazadas</p>
              <p className="text-xl font-bold text-red-600">{summary.rechazadas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={tipoFilter} onValueChange={v => { setTipoFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estadoFilter} onValueChange={v => { setEstadoFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="APROBADA">Aprobada</SelectItem>
                <SelectItem value="RECHAZADA">Rechazada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Fecha Inicio</TableHead>
                <TableHead className="hidden md:table-cell">Fecha Fin</TableHead>
                <TableHead>Horas/Monto</TableHead>
                <TableHead>Estado</TableHead>
                {canApprove && <TableHead>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: canApprove ? 7 : 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : incidencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canApprove ? 7 : 6} className="text-center py-12">
                    <div className="flex flex-col items-center text-slate-400">
                      <AlertCircle className="h-10 w-10 mb-2" />
                      <p className="text-sm font-medium">No se encontraron incidencias</p>
                      <p className="text-xs">Intente ajustar los filtros</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                incidencias.map(inc => (
                  <TableRow key={inc.id}>
                    <TableCell className="text-sm">
                      <p className="font-medium">{getNombreEmp(inc)}</p>
                      <p className="text-xs text-slate-500 font-mono">{inc.empleado.codigo_empleado}</p>
                    </TableCell>
                    <TableCell className="text-sm">{TIPO_LABELS[inc.tipo] || inc.tipo}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{formatDate(inc.fecha_inicio)}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{inc.fecha_fin ? formatDate(inc.fecha_fin) : '—'}</TableCell>
                    <TableCell className="text-sm">
                      {inc.cantidad_horas ? `${inc.cantidad_horas}h` : formatMonto(inc.monto)}
                    </TableCell>
                    <TableCell>
                      <Badge className={ESTADO_COLORS[inc.estado] || 'bg-slate-100 text-slate-600'}>
                        {inc.estado}
                      </Badge>
                    </TableCell>
                    {canApprove && (
                      <TableCell>
                        {inc.estado === 'PENDIENTE' && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 h-7 px-2"
                              onClick={() => handleApproveReject(inc.id, 'APROBADA')}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 h-7 px-2"
                              onClick={() => handleApproveReject(inc.id, 'RECHAZADA')}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Incidence Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Incidencia</DialogTitle>
            <DialogDescription>Registrar una incidencia de nómina</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Employee search */}
            <div>
              <Label>Empleado *</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Buscar empleado..."
                  value={searchEmpleado}
                  onChange={e => setSearchEmpleado(e.target.value)}
                  className="h-9"
                />
                <Select value={form.empleado_id} onValueChange={v => setForm(p => ({ ...p, empleado_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                  <SelectContent>
                    {filteredEmpleados.slice(0, 20).map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.primer_nombre} {e.primer_apellido} ({e.codigo_empleado})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha Inicio *</Label>
                <Input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} className="h-9" />
              </div>
            </div>

            <div>
              <Label>Fecha Fin</Label>
              <Input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} className="h-9" />
            </div>

            {/* Conditional: HORAS_EXTRA */}
            {form.tipo === 'HORAS_EXTRA' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cantidad de Horas *</Label>
                  <Input type="number" step="0.5" value={form.cantidad_horas} onChange={e => setForm(p => ({ ...p, cantidad_horas: e.target.value }))} className="h-9" />
                  <p className="text-xs text-amber-600 mt-0.5">Máximo 10h/semana (Art. 169 CT)</p>
                </div>
                <div>
                  <Label>Tipo de Horas Extra</Label>
                  <Select value={form.tipo_horas_extra} onValueChange={v => setForm(p => ({ ...p, tipo_horas_extra: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIURNA">Diurna</SelectItem>
                      <SelectItem value="NOCTURNA">Nocturna</SelectItem>
                      <SelectItem value="DESCANSO">Día de Descanso</SelectItem>
                      <SelectItem value="ASUETO">Asueto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Conditional: INCAPACIDAD_ISSS */}
            {form.tipo === 'INCAPACIDAD_ISSS' && (
              <div>
                <Label>Número de Incapacidad *</Label>
                <Input value={form.numero_incapacidad} onChange={e => setForm(p => ({ ...p, numero_incapacidad: e.target.value }))} className="h-9" />
              </div>
            )}

            {/* Conditional: COMISION/BONO/DESCUENTO_ESPECIAL */}
            {['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo) && (
              <div>
                <Label>Monto (USD) *</Label>
                <Input type="number" step="0.01" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} className="h-9" />
              </div>
            )}

            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className="h-9" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Crear Incidencia
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
