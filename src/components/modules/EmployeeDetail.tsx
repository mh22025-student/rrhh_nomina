'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Edit2, Save, X, FileText, Briefcase, Heart, DollarSign,
  Palmtree, FolderOpen, Loader2, AlertCircle, Plus, Clock,
  User, CalendarDays, AlertTriangle, Printer, MapPin, Phone, Mail,
  Shield, Building2, Hash, CreditCard, TrendingUp, ChevronDown,
  ChevronUp, Globe, Droplets, Users, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

interface EmployeeDetailProps {
  empleadoId: string;
  onBack: () => void;
  userRole: UserRole;
  accessToken: string | null;
}

interface EmpleadoDetail {
  id: string;
  codigo_empleado: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  apellido_casada: string | null;
  dui: string;
  nit: string | null;
  fecha_nacimiento: string | null;
  genero: string | null;
  estado_civil: string | null;
  direccion: string | null;
  telefono: string | null;
  email_personal: string | null;
  numero_isss: string | null;
  numero_afp: string | null;
  afp_administradora: string | null;
  tipo_sangre: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  contacto_emergencia_relacion: string | null;
  nacionalidad: string;
  fecha_ingreso: string;
  fecha_salida: string | null;
  salario_base: number;
  estado: string;
  area: { id: string; nombre: string; codigo: string } | null;
  perfil_puesto: { id: string; nombre_puesto: string; codigo: string; banda_salarial: { nombre: string; salario_minimo: number; salario_maximo: number } | null } | null;
  contratos: Array<{
    id: string; tipo_contrato: string; salario_base_contrato: number; tipo_jornada: string;
    fecha_inicio: string; fecha_fin: string | null; activo: boolean; observaciones: string | null;
    perfil_puesto: { nombre_puesto: string } | null;
  }>;
  vacaciones: Array<{
    id: string; anio: number; dias_derecho: number; dias_tomados: number;
    dias_pendientes: number; dias_vendidos: number; estado: string;
  }>;
  documentos: Array<{
    id: string; tipo_documento: string; nombre_archivo: string; descripcion: string | null; fecha_creacion: string;
  }>;
  incidencias: Array<{
    id: string; tipo: string; estado: string; fecha_inicio: string; fecha_fin: string | null;
    cantidad_horas: number | null; monto: number | null; descripcion: string | null;
  }>;
  cambios_salariales: Array<{
    id: string; salario_anterior: number; salario_nuevo: number; tipo_cambio: string;
    motivo: string | null; fecha_cambio: string;
  }>;
  usuario: { id: string; email: string; rol: string } | null;
}

/* ─── circular progress ring ─── */
function CircularProgress({ value, max, size = 80, strokeWidth = 6, color = 'emerald' }: {
  value: number; max: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - pct * circumference;
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    sky: 'text-sky-500',
    purple: 'text-purple-500',
  };
  const strokeClass = colorMap[color] || colorMap.emerald;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-slate-200 dark:text-slate-700" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={`${strokeClass} transition-all duration-700`} />
    </svg>
  );
}

export default function EmployeeDetail({ empleadoId, onBack, userRole, accessToken }: EmployeeDetailProps) {
  const [empleado, setEmpleado] = useState<EmpleadoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [newContractOpen, setNewContractOpen] = useState(false);
  const [contractData, setContractData] = useState({ tipo_contrato: 'INDEFINIDO', salario_base_contrato: '', tipo_jornada: 'COMPLETA', fecha_inicio: '', fecha_fin: '', observaciones: '' });
  const { toast } = useToast();

  const fetchEmpleado = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/empleados/${empleadoId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEmpleado(data.data);
      }
    } catch (err) {
      console.error('Error fetching employee:', err);
    } finally {
      setLoading(false);
    }
  }, [empleadoId, accessToken]);

  useEffect(() => { fetchEmpleado(); }, [fetchEmpleado]);

  const canEdit = userRole === 'ADMIN' || userRole === 'ANALISTA';
  const canEditOwn = userRole === 'EMPLEADO';

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-SV') : '—';
  const formatSalary = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const getNombreCompleto = () => {
    if (!empleado) return '';
    return `${empleado.primer_nombre}${empleado.segundo_nombre ? ' ' + empleado.segundo_nombre : ''} ${empleado.primer_apellido}${empleado.segundo_apellido ? ' ' + empleado.segundo_apellido : ''}`;
  };

  const getInitials = () => {
    if (!empleado) return '';
    const first = empleado.primer_nombre?.[0] || '';
    const last = empleado.primer_apellido?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  const handleEdit = () => {
    if (!empleado) return;
    setEditData({
      primer_nombre: empleado.primer_nombre,
      segundo_nombre: empleado.segundo_nombre || '',
      primer_apellido: empleado.primer_apellido,
      segundo_apellido: empleado.segundo_apellido || '',
      apellido_casada: empleado.apellido_casada || '',
      dui: empleado.dui,
      nit: empleado.nit || '',
      genero: empleado.genero || '',
      estado_civil: empleado.estado_civil || '',
      direccion: empleado.direccion || '',
      telefono: empleado.telefono || '',
      email_personal: empleado.email_personal || '',
      fecha_nacimiento: empleado.fecha_nacimiento ? new Date(empleado.fecha_nacimiento).toISOString().slice(0, 10) : '',
      numero_isss: empleado.numero_isss || '',
      numero_afp: empleado.numero_afp || '',
      afp_administradora: empleado.afp_administradora || '',
      tipo_sangre: empleado.tipo_sangre || '',
      contacto_emergencia_nombre: empleado.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: empleado.contacto_emergencia_telefono || '',
      contacto_emergencia_relacion: empleado.contacto_emergencia_relacion || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/empleados/${empleadoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Empleado actualizado', description: 'Los datos han sido guardados correctamente' });
        setEditing(false);
        fetchEmpleado();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al actualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateContract = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/empleados/${empleadoId}/contratos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          ...contractData,
          salario_base_contrato: parseFloat(contractData.salario_base_contrato),
          fecha_fin: contractData.fecha_fin || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Contrato creado', description: 'El nuevo contrato ha sido registrado' });
        setNewContractOpen(false);
        setContractData({ tipo_contrato: 'INDEFINIDO', salario_base_contrato: '', tipo_jornada: 'COMPLETA', fecha_inicio: '', fecha_fin: '', observaciones: '' });
        fetchEmpleado();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al crear contrato', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  /* ─── Not found ─── */
  if (!empleado) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-600">Empleado no encontrado</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeContract = empleado.contratos.find(c => c.activo);
  const totalVacPendientes = empleado.vacaciones.reduce((s, v) => s + v.dias_pendientes, 0);
  const totalVacDerecho = empleado.vacaciones.reduce((s, v) => s + v.dias_derecho, 0);

  /* ─── InfoField with icon ─── */
  const InfoField = ({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) => (
    <div className="flex items-start gap-2.5 py-2">
      {icon && <span className="mt-0.5 text-slate-400 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5 font-medium">{value || '—'}</p>
      </div>
    </div>
  );

  const EditField = ({ label, field, type = 'text' }: { label: string; field: string; type?: string }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={String(editData[field] || '')}
        onChange={e => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
        className="h-8 text-sm"
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════
          ENHANCED HEADER PROFILE CARD
         ═══════════════════════════════════════════ */}
      <Card className="overflow-hidden border-0 shadow-lg">
        {/* Gradient banner */}
        <div className="h-28 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-60" />
        </div>
        <div className="relative px-6 pb-5">
          {/* Avatar */}
          <div className="-mt-14 mb-4 flex items-end justify-between">
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 border-4 border-white shadow-lg flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{getInitials()}</span>
              </div>
              <div className="pb-1">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{getNombreCompleto()}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {empleado.perfil_puesto?.nombre_puesto || empleado.area?.nombre || 'Sin puesto asignado'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{empleado.area?.nombre || 'Sin área'}</span>
                  <Badge className={`ml-2 text-xs ${empleado.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {empleado.estado}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Volver
              </Button>
              {(canEdit || canEditOwn) && !editing && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleEdit}>
                  <Edit2 className="h-4 w-4 mr-1" /> Editar
                </Button>
              )}
              {editing && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Guardar
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Quick info row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Hash className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Código</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{empleado.codigo_empleado}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">DUI</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{empleado.dui}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Salario</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatSalary(empleado.salario_base)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-9 w-9 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Fecha Ingreso</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatDate(empleado.fecha_ingreso)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ═══════════════════════════════════════════
          ENHANCED TAB NAVIGATION
         ═══════════════════════════════════════════ */}
      <Tabs defaultValue="general" className="space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <TabsList className="bg-transparent h-auto p-0 gap-0 w-full justify-start overflow-x-auto">
            <TabsTrigger value="general" className="relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 transition-all flex items-center gap-1.5">
              <User className="h-4 w-4" /> General
            </TabsTrigger>
            <TabsTrigger value="contratos" className="relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 transition-all flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Contratos
            </TabsTrigger>
            <TabsTrigger value="salario" className="relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 transition-all flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" /> Salario
            </TabsTrigger>
            <TabsTrigger value="vacaciones" className="relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 transition-all flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Vacaciones
            </TabsTrigger>
            <TabsTrigger value="incidencias" className="relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 transition-all flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Incidencias
            </TabsTrigger>
            <TabsTrigger value="documentos" className="relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 transition-all flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4" /> Documentos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════════════════════════════════════
            TAB: GENERAL — Grouped info cards
           ═══════════════════════════════════════════ */}
        <TabsContent value="general">
          {editing ? (
            <Card className="shadow-sm border-emerald-200">
              <CardHeader className="pb-3 bg-emerald-50/50 dark:bg-emerald-900/10">
                <CardTitle className="text-base flex items-center gap-2">
                  <Edit2 className="h-4 w-4 text-emerald-600" />
                  Editar Datos Personales
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <EditField label="Primer Nombre" field="primer_nombre" />
                  <EditField label="Segundo Nombre" field="segundo_nombre" />
                  <EditField label="Primer Apellido" field="primer_apellido" />
                  <EditField label="Segundo Apellido" field="segundo_apellido" />
                  <EditField label="Apellido de Casada" field="apellido_casada" />
                  <EditField label="DUI" field="dui" />
                  <EditField label="NIT" field="nit" />
                  <EditField label="Fecha de Nacimiento" field="fecha_nacimiento" type="date" />
                  <div>
                    <Label className="text-xs">Género</Label>
                    <Select value={String(editData.genero || '')} onValueChange={v => setEditData(p => ({ ...p, genero: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Seleccionar</SelectItem>
                        <SelectItem value="MASCULINO">Masculino</SelectItem>
                        <SelectItem value="FEMENINO">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <EditField label="Teléfono" field="telefono" />
                  <EditField label="Email Personal" field="email_personal" type="email" />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <EditField label="Dirección" field="direccion" />
                  </div>
                  <Separator className="sm:col-span-2 lg:col-span-3" />
                  <EditField label="Contacto Emergencia Nombre" field="contacto_emergencia_nombre" />
                  <EditField label="Contacto Emergencia Teléfono" field="contacto_emergencia_telefono" />
                  <EditField label="Contacto Emergencia Relación" field="contacto_emergencia_relacion" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Datos Personales */}
              <Card className="shadow-sm border-l-4 border-l-emerald-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <User className="h-4 w-4" /> Datos Personales
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-0.5">
                  <InfoField label="Primer Nombre" value={empleado.primer_nombre} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoField label="Segundo Nombre" value={empleado.segundo_nombre} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoField label="Primer Apellido" value={empleado.primer_apellido} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoField label="Segundo Apellido" value={empleado.segundo_apellido} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoField label="Apellido de Casada" value={empleado.apellido_casada} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoField label="DUI" value={empleado.dui} icon={<CreditCard className="h-3.5 w-3.5" />} />
                  <InfoField label="NIT" value={empleado.nit} icon={<Hash className="h-3.5 w-3.5" />} />
                  <InfoField label="Fecha Nacimiento" value={formatDate(empleado.fecha_nacimiento)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                  <InfoField label="Género" value={empleado.genero} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoField label="Estado Civil" value={empleado.estado_civil} icon={<Users className="h-3.5 w-3.5" />} />
                  <InfoField label="Nacionalidad" value={empleado.nacionalidad} icon={<Globe className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>

              {/* Datos Laborales */}
              <Card className="shadow-sm border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Briefcase className="h-4 w-4" /> Datos Laborales
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-0.5">
                  <InfoField label="Código Empleado" value={empleado.codigo_empleado} icon={<Hash className="h-3.5 w-3.5" />} />
                  <InfoField label="Puesto" value={empleado.perfil_puesto?.nombre_puesto} icon={<Briefcase className="h-3.5 w-3.5" />} />
                  <InfoField label="Área" value={empleado.area?.nombre} icon={<Building2 className="h-3.5 w-3.5" />} />
                  <InfoField label="Fecha Ingreso" value={formatDate(empleado.fecha_ingreso)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                  <InfoField label="Fecha Salida" value={formatDate(empleado.fecha_salida)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                  <InfoField label="Estado" value={empleado.estado} icon={<Shield className="h-3.5 w-3.5" />} />
                  <InfoField label="Banda Salarial" value={empleado.perfil_puesto?.banda_salarial?.nombre} icon={<Award className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>

              {/* Contacto */}
              <Card className="shadow-sm border-l-4 border-l-sky-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-sky-700 dark:text-sky-400">
                    <Phone className="h-4 w-4" /> Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-0.5">
                  <InfoField label="Teléfono" value={empleado.telefono} icon={<Phone className="h-3.5 w-3.5" />} />
                  <InfoField label="Email Personal" value={empleado.email_personal} icon={<Mail className="h-3.5 w-3.5" />} />
                  <Separator className="my-2" />
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">Contacto de Emergencia</p>
                  <InfoField label="Nombre" value={empleado.contacto_emergencia_nombre} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoField label="Teléfono" value={empleado.contacto_emergencia_telefono} icon={<Phone className="h-3.5 w-3.5" />} />
                  <InfoField label="Relación" value={empleado.contacto_emergencia_relacion} icon={<Users className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>

              {/* Ubicación + Previsional */}
              <Card className="shadow-sm border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <MapPin className="h-4 w-4" /> Ubicación y Previsional
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-0.5">
                  <InfoField label="Dirección" value={empleado.direccion} icon={<MapPin className="h-3.5 w-3.5" />} />
                  <Separator className="my-2" />
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">Datos Previsionales</p>
                  <InfoField label="Número ISSS" value={empleado.numero_isss} icon={<Shield className="h-3.5 w-3.5" />} />
                  <InfoField label="Número AFP (NUP)" value={empleado.numero_afp} icon={<Shield className="h-3.5 w-3.5" />} />
                  <InfoField label="AFP Administradora" value={empleado.afp_administradora} icon={<Building2 className="h-3.5 w-3.5" />} />
                  <InfoField label="Tipo de Sangre" value={empleado.tipo_sangre} icon={<Droplets className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB: CONTRATOS — Timeline + status badges
           ═══════════════════════════════════════════ */}
        <TabsContent value="contratos">
          <div className="space-y-4">
            {/* Active Contract Highlighted */}
            <Card className={`shadow-sm ${activeContract ? 'border-emerald-300 border-2 bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    Contrato Vigente
                    {activeContract && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs ml-2">Activo</Badge>
                    )}
                  </CardTitle>
                  {canEdit && (
                    <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setNewContractOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Nuevo Contrato
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activeContract ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Tipo de Contrato" value={activeContract.tipo_contrato} icon={<FileText className="h-3.5 w-3.5" />} />
                    <InfoField label="Salario Base" value={formatSalary(activeContract.salario_base_contrato)} icon={<DollarSign className="h-3.5 w-3.5" />} />
                    <InfoField label="Jornada" value={activeContract.tipo_jornada} icon={<Clock className="h-3.5 w-3.5" />} />
                    <InfoField label="Fecha Inicio" value={formatDate(activeContract.fecha_inicio)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                    <InfoField label="Fecha Fin" value={activeContract.fecha_fin ? formatDate(activeContract.fecha_fin) : 'Indefinido'} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                    <InfoField label="Puesto" value={activeContract.perfil_puesto?.nombre_puesto || '—'} icon={<Briefcase className="h-3.5 w-3.5" />} />
                    {activeContract.observaciones && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <InfoField label="Observaciones" value={activeContract.observaciones} icon={<FileText className="h-3.5 w-3.5" />} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-10 text-slate-400">
                    <FileText className="h-10 w-10 mb-2" />
                    <p className="text-sm font-medium">No hay contrato vigente</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contract History Timeline */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  Historial de Contratos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {empleado.contratos.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Sin contratos registrados</p>
                ) : (
                  <div className="relative space-y-0">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
                    {empleado.contratos.map((c, idx) => (
                      <div key={c.id} className="relative flex items-start gap-4 py-3">
                        {/* Timeline dot */}
                        <div className={`relative z-10 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          c.activo
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-slate-300 bg-white dark:bg-slate-800'
                        }`}>
                          {c.activo && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        {/* Content card */}
                        <div className={`flex-1 p-3 rounded-lg border transition-colors ${
                          c.activo
                            ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10'
                            : 'border-slate-100 bg-slate-50/50 dark:bg-slate-800/30'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={c.activo ? 'default' : 'secondary'} className={c.activo ? 'bg-emerald-100 text-emerald-700' : 'text-xs'}>
                                {c.activo ? 'Vigente' : 'Finalizado'}
                              </Badge>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.tipo_contrato}</span>
                            </div>
                            <span className="text-sm font-mono text-emerald-600 font-semibold">{formatSalary(c.salario_base_contrato)}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(c.fecha_inicio)} — {c.fecha_fin ? formatDate(c.fecha_fin) : 'Indefinido'}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.tipo_jornada}</span>
                            {c.perfil_puesto && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{c.perfil_puesto.nombre_puesto}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Salary mini chart (sparkline) */}
                {empleado.contratos.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400 font-medium mb-2">Evolución Salarial en Contratos</p>
                    <div className="flex items-end gap-1 h-16">
                      {empleado.contratos.map((c, idx) => {
                        const maxSal = Math.max(...empleado.contratos.map(x => x.salario_base_contrato));
                        const minSal = Math.min(...empleado.contratos.map(x => x.salario_base_contrato));
                        const range = maxSal - minSal || 1;
                        const height = 20 + ((c.salario_base_contrato - minSal) / range) * 80;
                        return (
                          <div key={c.id} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className={`w-full rounded-t ${c.activo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} transition-all`}
                              style={{ height: `${height}%` }}
                            />
                            <span className="text-[9px] text-slate-400">{formatDate(c.fecha_inicio).slice(-4)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB: SALARIO — Large display + band + history
           ═══════════════════════════════════════════ */}
        <TabsContent value="salario">
          <div className="space-y-4">
            {/* Current salary large display */}
            <Card className="shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white">
                <p className="text-sm font-medium opacity-80 mb-1">Salario Base Mensual</p>
                <p className="text-4xl font-bold tracking-tight">{formatSalary(empleado.salario_base)}</p>
                <div className="flex items-center gap-3 mt-3 text-sm opacity-90">
                  <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {empleado.perfil_puesto?.nombre_puesto || 'Sin puesto'}</span>
                  <span>•</span>
                  <span>{empleado.area?.nombre || 'Sin área'}</span>
                </div>
              </div>
              {/* Salary band position indicator */}
              {empleado.perfil_puesto?.banda_salarial && (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500 font-medium">Posición en Banda Salarial</p>
                    <Badge variant="outline" className="text-xs">{empleado.perfil_puesto.banda_salarial.nombre}</Badge>
                  </div>
                  <div className="relative h-4 rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200 overflow-hidden">
                    <div
                      className="absolute top-0 h-full w-1.5 bg-slate-800 dark:bg-white rounded-full shadow-lg transition-all duration-500"
                      style={{
                        left: `${Math.min(100, Math.max(0,
                          ((empleado.salario_base - empleado.perfil_puesto.banda_salarial.salario_minimo) /
                          (empleado.perfil_puesto.banda_salarial.salario_maximo - empleado.perfil_puesto.banda_salarial.salario_minimo)) * 100
                        ))}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-slate-400">
                    <span>Mín: {formatSalary(empleado.perfil_puesto.banda_salarial.salario_minimo)}</span>
                    <span>Máx: {formatSalary(empleado.perfil_puesto.banda_salarial.salario_maximo)}</span>
                  </div>
                </div>
              )}
            </Card>

            {/* Next review date */}
            {empleado.cambios_salariales.length > 0 && (
              <Card className="shadow-sm border-amber-200 bg-amber-50/30 dark:bg-amber-900/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Último cambio salarial</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(empleado.cambios_salariales[0].fecha_cambio)} — {empleado.cambios_salariales[0].tipo_cambio}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Change history timeline */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Historial de Cambios Salariales
                </CardTitle>
              </CardHeader>
              <CardContent>
                {empleado.cambios_salariales.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Sin cambios salariales registrados</p>
                ) : (
                  <div className="relative space-y-0">
                    <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
                    {empleado.cambios_salariales.map(cs => {
                      const diff = cs.salario_nuevo - cs.salario_anterior;
                      const isIncrease = diff > 0;
                      return (
                        <div key={cs.id} className="relative flex items-start gap-4 py-3">
                          <div className={`relative z-10 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isIncrease ? 'border-emerald-500 bg-emerald-500' : 'border-amber-500 bg-amber-500'
                          }`}>
                            <TrendingUp className={`h-2.5 w-2.5 text-white ${!isIncrease ? 'rotate-180' : ''}`} />
                          </div>
                          <div className="flex-1 p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{cs.tipo_cambio}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{formatDate(cs.fecha_cambio)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-mono text-slate-600 dark:text-slate-400">{formatSalary(cs.salario_anterior)} → {formatSalary(cs.salario_nuevo)}</p>
                                <p className={`text-xs font-semibold ${isIncrease ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {isIncrease ? '+' : ''}{formatSalary(diff)}
                                </p>
                              </div>
                            </div>
                            {cs.motivo && <p className="text-xs text-slate-400 mt-1.5 italic">{cs.motivo}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB: VACACIONES — Circular progress + per-year
           ═══════════════════════════════════════════ */}
        <TabsContent value="vacaciones">
          <div className="space-y-4">
            {/* Vacation balance summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="relative">
                    <CircularProgress value={totalVacDerecho > 0 ? totalVacPendientes : 0} max={totalVacDerecho || 1} size={80} strokeWidth={6} color="emerald" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-emerald-700">{totalVacPendientes}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Días Pendientes</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{totalVacPendientes}</p>
                    <p className="text-xs text-slate-400">de {totalVacDerecho} totales</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <CalendarDays className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Días Tomados</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{empleado.vacaciones.reduce((s, v) => s + v.dias_tomados, 0)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Días Vendidos</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{empleado.vacaciones.reduce((s, v) => s + v.dias_vendidos, 0)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Request vacation button for EMPLEADO */}
            {userRole === 'EMPLEADO' && (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Palmtree className="h-4 w-4 mr-2" /> Solicitar Vacaciones
              </Button>
            )}

            {/* Per-year breakdown with progress bars */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palmtree className="h-4 w-4 text-emerald-600" />
                  Desglose por Año
                </CardTitle>
              </CardHeader>
              <CardContent>
                {empleado.vacaciones.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-slate-400">
                    <Palmtree className="h-10 w-10 mb-2" />
                    <p className="text-sm font-medium">Sin registros de vacaciones</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {empleado.vacaciones.map(v => {
                      const usedPct = v.dias_derecho > 0 ? (v.dias_tomados / v.dias_derecho) * 100 : 0;
                      const pendPct = v.dias_derecho > 0 ? (v.dias_pendientes / v.dias_derecho) * 100 : 0;
                      return (
                        <div key={v.id} className="p-4 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{v.anio}</span>
                              <Badge className={`text-xs ${v.estado === 'ABIERTO' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {v.estado}
                              </Badge>
                            </div>
                            <span className="text-sm font-semibold text-amber-600">{v.dias_pendientes} días pend.</span>
                          </div>
                          <div className="grid grid-cols-4 gap-3 text-center mb-3">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase">Derecho</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{v.dias_derecho}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase">Tomados</p>
                              <p className="text-sm font-semibold text-emerald-600">{v.dias_tomados}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase">Pendientes</p>
                              <p className="text-sm font-semibold text-amber-600">{v.dias_pendientes}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase">Vendidos</p>
                              <p className="text-sm font-semibold text-sky-600">{v.dias_vendidos}</p>
                            </div>
                          </div>
                          {/* Stacked progress bar */}
                          <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                            <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${usedPct}%` }} />
                            <div className="bg-amber-400 transition-all duration-500" style={{ width: `${pendPct}%` }} />
                          </div>
                          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Tomados</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Pendientes</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB: INCIDENCIAS
           ═══════════════════════════════════════════ */}
        <TabsContent value="incidencias">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Incidencias del Empleado
              </CardTitle>
              <CardDescription>Registro de incidencias, permisos y novedades</CardDescription>
            </CardHeader>
            <CardContent>
              {empleado.incidencias.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-slate-400">
                  <AlertTriangle className="h-10 w-10 mb-2" />
                  <p className="text-sm font-medium">Sin incidencias registradas</p>
                  <p className="text-xs">Las incidencias del empleado aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {empleado.incidencias.map(inc => {
                    const tipoColors: Record<string, string> = {
                      PERMISO: 'bg-sky-100 text-sky-700 border-sky-200',
                      VACACION: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                      ENFERMEDAD: 'bg-amber-100 text-amber-700 border-amber-200',
                      AUSENCIA: 'bg-red-100 text-red-700 border-red-200',
                      HORAS_EXTRA: 'bg-purple-100 text-purple-700 border-purple-200',
                    };
                    const estadoColors: Record<string, string> = {
                      PENDIENTE: 'bg-yellow-100 text-yellow-700',
                      APROBADA: 'bg-emerald-100 text-emerald-700',
                      RECHAZADA: 'bg-red-100 text-red-700',
                    };
                    return (
                      <div key={inc.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={tipoColors[inc.tipo] || 'bg-slate-100 text-slate-600'}>
                              {inc.tipo}
                            </Badge>
                            <Badge className={estadoColors[inc.estado] || 'bg-slate-100 text-slate-600'}>
                              {inc.estado}
                            </Badge>
                          </div>
                          <span className="text-xs text-slate-400">{formatDate(inc.fecha_inicio)}</span>
                        </div>
                        {inc.descripcion && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{inc.descripcion}</p>}
                        <div className="flex gap-4 mt-1.5 text-xs text-slate-400">
                          {inc.cantidad_horas && <span>{inc.cantidad_horas} hrs</span>}
                          {inc.monto && <span className="text-emerald-600 font-medium">{formatSalary(inc.monto)}</span>}
                          {inc.fecha_fin && <span>Fin: {formatDate(inc.fecha_fin)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB: DOCUMENTOS
           ═══════════════════════════════════════════ */}
        <TabsContent value="documentos">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-emerald-600" />
                Documentos del Empleado
              </CardTitle>
              <CardDescription>Documentos y archivos adjuntos del expediente</CardDescription>
            </CardHeader>
            <CardContent>
              {empleado.documentos.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-slate-400">
                  <FolderOpen className="h-10 w-10 mb-2" />
                  <p className="text-sm font-medium">Sin documentos registrados</p>
                  <p className="text-xs">Los documentos del empleado aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {empleado.documentos.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{doc.nombre_archivo}</p>
                        <p className="text-xs text-slate-500">{doc.tipo_documento} • {formatDate(doc.fecha_creacion)}</p>
                      </div>
                      {doc.descripcion && <p className="text-xs text-slate-400 hidden sm:block max-w-[200px] truncate">{doc.descripcion}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════
          NEW CONTRACT DIALOG
         ═══════════════════════════════════════════ */}
      <Dialog open={newContractOpen} onOpenChange={setNewContractOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Contrato</DialogTitle>
            <DialogDescription>Crear un nuevo contrato para {getNombreCompleto()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de Contrato</Label>
                <Select value={contractData.tipo_contrato} onValueChange={v => setContractData(p => ({ ...p, tipo_contrato: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
                    <SelectItem value="PLAZO_FIJO">Plazo Fijo</SelectItem>
                    <SelectItem value="OBRA_LABOR">Obra/Labor</SelectItem>
                    <SelectItem value="TEMPORAL">Temporal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo Jornada</Label>
                <Select value={contractData.tipo_jornada} onValueChange={v => setContractData(p => ({ ...p, tipo_jornada: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETA">Completa</SelectItem>
                    <SelectItem value="MEDIA">Media</SelectItem>
                    <SelectItem value="POR_HORAS">Por Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Salario Base (USD)</Label>
              <Input type="number" step="0.01" value={contractData.salario_base_contrato} onChange={e => setContractData(p => ({ ...p, salario_base_contrato: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha Inicio</Label>
                <Input type="date" value={contractData.fecha_inicio} onChange={e => setContractData(p => ({ ...p, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Fecha Fin (opcional)</Label>
                <Input type="date" value={contractData.fecha_fin} onChange={e => setContractData(p => ({ ...p, fecha_fin: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input value={contractData.observaciones} onChange={e => setContractData(p => ({ ...p, observaciones: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewContractOpen(false)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateContract} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Crear Contrato
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
