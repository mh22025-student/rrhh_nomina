'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, ArrowLeft, ArrowRight, CheckCircle, Loader2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

interface NewEmployeeFormProps {
  accessToken: string | null;
  userRole: UserRole;
  onBack: () => void;
  onSuccess: () => void;
}

interface Area {
  id: string;
  nombre: string;
  codigo: string;
}

interface PerfilPuesto {
  id: string;
  nombre_puesto: string;
  codigo: string;
  area_id: string;
}

export default function NewEmployeeForm({ accessToken, userRole, onBack, onSuccess }: NewEmployeeFormProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilPuesto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const [form, setForm] = useState({
    // Step 1
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    apellido_casada: '',
    dui: '',
    nit: '',
    fecha_nacimiento: '',
    genero: '',
    estado_civil: '',
    direccion: '',
    telefono: '',
    email_personal: '',
    numero_isss: '',
    numero_afp: '',
    afp_administradora: '',
    tipo_sangre: '',
    nacionalidad: 'Salvadoreña',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
    contacto_emergencia_relacion: '',
    area_id: '',
    perfil_puesto_id: '',
    fecha_ingreso: '',
    // Step 2
    tipo_contrato: 'INDEFINIDO',
    salario_base_contrato: '',
    tipo_jornada: 'COMPLETA',
    fecha_inicio: '',
    fecha_fin: '',
    observaciones: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [areasRes, perfilesRes] = await Promise.all([
          fetch('/api/areas', { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch('/api/perfiles-puesto', { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);
        if (areasRes.ok) {
          const d = await areasRes.json();
          setAreas(d.data || d || []);
        }
        if (perfilesRes.ok) {
          const d = await perfilesRes.json();
          setPerfiles(d.data || d || []);
        }
      } catch { /* ignore */ }
    };
    fetchData();
  }, [accessToken]);

  const filteredPerfiles = form.area_id
    ? perfiles.filter(p => p.area_id === form.area_id)
    : perfiles;

  const formatDui = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 8) return digits;
    return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  };

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.primer_nombre.trim()) e.primer_nombre = 'Primer nombre es requerido';
    if (!form.primer_apellido.trim()) e.primer_apellido = 'Primer apellido es requerido';
    if (!form.dui.trim()) e.dui = 'DUI es requerido';
    else if (!/^\d{8}-\d$/.test(form.dui)) e.dui = 'Formato DUI inválido (########-#)';
    if (!form.area_id) e.area_id = 'Área es requerida';
    if (!form.perfil_puesto_id) e.perfil_puesto_id = 'Perfil de puesto es requerido';
    if (!form.fecha_ingreso) e.fecha_ingreso = 'Fecha de ingreso es requerida';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.tipo_contrato) e.tipo_contrato = 'Tipo de contrato es requerido';
    if (!form.salario_base_contrato || parseFloat(form.salario_base_contrato) <= 0) e.salario_base_contrato = 'Salario base debe ser mayor a 0';
    if (!form.tipo_jornada) e.tipo_jornada = 'Tipo de jornada es requerido';
    if (!form.fecha_inicio) e.fecha_inicio = 'Fecha de inicio es requerida';
    if (form.fecha_fin && new Date(form.fecha_fin) <= new Date(form.fecha_inicio)) e.fecha_fin = 'Fecha fin debe ser posterior a fecha inicio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          ...form,
          salario_base_contrato: parseFloat(form.salario_base_contrato),
          fecha_fin: form.fecha_fin || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Empleado creado', description: `Empleado ${data.data?.codigo_empleado} registrado exitosamente` });
        onSuccess();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al crear empleado', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const FieldError = ({ field }: { field: string }) =>
    errors[field] ? <p className="text-xs text-red-500 mt-0.5">{errors[field]}</p> : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" /> Nuevo Empleado
          </h2>
          <p className="text-sm text-slate-500">Complete la información del nuevo empleado</p>
        </div>
      </div>

      {/* Progress */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${step >= 1 ? 'text-emerald-600' : 'text-slate-400'}`}>
              1. Datos Personales
            </span>
            <span className={`text-sm font-medium ${step >= 2 ? 'text-emerald-600' : 'text-slate-400'}`}>
              2. Datos Contractuales
            </span>
          </div>
          <Progress value={(step / 2) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Step 1: Personal Data */}
      {step === 1 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos Personales y Laborales</CardTitle>
            <CardDescription>Información personal y asignación de puesto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Primer Nombre *</Label>
                <Input value={form.primer_nombre} onChange={e => updateField('primer_nombre', e.target.value)} className="h-9" />
                <FieldError field="primer_nombre" />
              </div>
              <div>
                <Label>Segundo Nombre</Label>
                <Input value={form.segundo_nombre} onChange={e => updateField('segundo_nombre', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Primer Apellido *</Label>
                <Input value={form.primer_apellido} onChange={e => updateField('primer_apellido', e.target.value)} className="h-9" />
                <FieldError field="primer_apellido" />
              </div>
              <div>
                <Label>Segundo Apellido</Label>
                <Input value={form.segundo_apellido} onChange={e => updateField('segundo_apellido', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Apellido de Casada</Label>
                <Input value={form.apellido_casada} onChange={e => updateField('apellido_casada', e.target.value)} className="h-9" />
              </div>
            </div>

            <Separator />

            {/* IDs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>DUI *</Label>
                <Input
                  placeholder="00000000-0"
                  value={form.dui}
                  onChange={e => updateField('dui', formatDui(e.target.value))}
                  className="h-9"
                  maxLength={10}
                />
                <FieldError field="dui" />
              </div>
              <div>
                <Label>NIT</Label>
                <Input value={form.nit} onChange={e => updateField('nit', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Fecha de Nacimiento</Label>
                <Input type="date" value={form.fecha_nacimiento} onChange={e => updateField('fecha_nacimiento', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Género</Label>
                <Select value={form.genero} onValueChange={v => updateField('genero', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MASCULINO">Masculino</SelectItem>
                    <SelectItem value="FEMENINO">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado Civil</Label>
                <Select value={form.estado_civil} onValueChange={v => updateField('estado_civil', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOLTERO/A">Soltero/a</SelectItem>
                    <SelectItem value="CASADO/A">Casado/a</SelectItem>
                    <SelectItem value="DIVORCIADO/A">Divorciado/a</SelectItem>
                    <SelectItem value="VIUDO/A">Viudo/a</SelectItem>
                    <SelectItem value="UNION_LIBRE">Unión Libre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nacionalidad</Label>
                <Input value={form.nacionalidad} onChange={e => updateField('nacionalidad', e.target.value)} className="h-9" />
              </div>
            </div>

            <Separator />

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Dirección</Label>
                <Input value={form.direccion} onChange={e => updateField('direccion', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={form.telefono} onChange={e => updateField('telefono', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Email Personal</Label>
                <Input type="email" value={form.email_personal} onChange={e => updateField('email_personal', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Tipo de Sangre</Label>
                <Select value={form.tipo_sangre} onValueChange={v => updateField('tipo_sangre', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Previsional */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Número ISSS</Label>
                <Input value={form.numero_isss} onChange={e => updateField('numero_isss', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Número AFP (NUP)</Label>
                <Input value={form.numero_afp} onChange={e => updateField('numero_afp', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>AFP Administradora</Label>
                <Select value={form.afp_administradora} onValueChange={v => updateField('afp_administradora', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRECER">CRECER</SelectItem>
                    <SelectItem value="CONFIA">CONFIA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Emergency Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Contacto Emergencia Nombre</Label>
                <Input value={form.contacto_emergencia_nombre} onChange={e => updateField('contacto_emergencia_nombre', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Contacto Emergencia Teléfono</Label>
                <Input value={form.contacto_emergencia_telefono} onChange={e => updateField('contacto_emergencia_telefono', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label>Contacto Emergencia Relación</Label>
                <Input value={form.contacto_emergencia_relacion} onChange={e => updateField('contacto_emergencia_relacion', e.target.value)} className="h-9" />
              </div>
            </div>

            <Separator />

            {/* Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Área *</Label>
                <Select value={form.area_id} onValueChange={v => { updateField('area_id', v); updateField('perfil_puesto_id', ''); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                  <SelectContent>
                    {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError field="area_id" />
              </div>
              <div>
                <Label>Perfil de Puesto *</Label>
                <Select value={form.perfil_puesto_id} onValueChange={v => updateField('perfil_puesto_id', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar puesto" /></SelectTrigger>
                  <SelectContent>
                    {filteredPerfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_puesto}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError field="perfil_puesto_id" />
              </div>
              <div>
                <Label>Fecha de Ingreso *</Label>
                <Input type="date" value={form.fecha_ingreso} onChange={e => updateField('fecha_ingreso', e.target.value)} className="h-9" />
                <FieldError field="fecha_ingreso" />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-end pt-4">
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleNext}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Contract Data */}
      {step === 2 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos Contractuales</CardTitle>
            <CardDescription>Información del contrato de trabajo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Contrato *</Label>
                <Select value={form.tipo_contrato} onValueChange={v => updateField('tipo_contrato', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
                    <SelectItem value="PLAZO_FIJO">Plazo Fijo</SelectItem>
                    <SelectItem value="OBRA_LABOR">Obra/Labor</SelectItem>
                    <SelectItem value="TEMPORAL">Temporal</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError field="tipo_contrato" />
              </div>
              <div>
                <Label>Tipo de Jornada *</Label>
                <Select value={form.tipo_jornada} onValueChange={v => updateField('tipo_jornada', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETA">Completa</SelectItem>
                    <SelectItem value="MEDIA">Media</SelectItem>
                    <SelectItem value="POR_HORAS">Por Horas</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError field="tipo_jornada" />
              </div>
            </div>

            <div>
              <Label>Salario Base (USD) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.salario_base_contrato}
                onChange={e => updateField('salario_base_contrato', e.target.value)}
                className="h-9"
              />
              <FieldError field="salario_base_contrato" />
              <p className="text-xs text-slate-500 mt-1">Se validará contra el salario mínimo legal del sector</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Fecha de Inicio *</Label>
                <Input type="date" value={form.fecha_inicio} onChange={e => updateField('fecha_inicio', e.target.value)} className="h-9" />
                <FieldError field="fecha_inicio" />
              </div>
              <div>
                <Label>Fecha de Fin (opcional)</Label>
                <Input type="date" value={form.fecha_fin} onChange={e => updateField('fecha_fin', e.target.value)} className="h-9" />
                <FieldError field="fecha_fin" />
                {form.tipo_contrato === 'INDEFINIDO' && (
                  <p className="text-xs text-slate-500 mt-1">Dejar vacío para contrato indefinido</p>
                )}
              </div>
            </div>

            <div>
              <Label>Observaciones</Label>
              <Input value={form.observaciones} onChange={e => updateField('observaciones', e.target.value)} className="h-9" />
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />} Guardar Empleado
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
