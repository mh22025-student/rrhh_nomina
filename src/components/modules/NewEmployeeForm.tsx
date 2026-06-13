'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserPlus, ArrowLeft, ArrowRight, CheckCircle, Loader2, AlertCircle,
  User, FileText, Briefcase, ClipboardCheck, Mail, Phone, MapPin,
  Calendar, Shield, Heart, Building2, ChevronLeft, ChevronRight,
  CreditCard, Banknote, Clock, AlertTriangle, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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
  area_padre_id?: string | null;
  nivel?: number;
}

interface PerfilPuesto {
  id: string;
  nombre_puesto: string;
  codigo: string;
  area_id: string;
  banda_salarial_id?: string | null;
}

interface BandaSalarial {
  id: string;
  grado: number;
  nombre: string;
  salario_minimo: number;
  salario_medio: number;
  salario_maximo: number;
}

const STEPS = [
  { num: 1, label: 'Datos Personales', icon: User },
  { num: 2, label: 'Datos Laborales', icon: Briefcase },
  { num: 3, label: 'Contrato', icon: FileText },
  { num: 4, label: 'Revisión', icon: ClipboardCheck },
];

export default function NewEmployeeForm({ accessToken, userRole, onBack, onSuccess }: NewEmployeeFormProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilPuesto[]>([]);
  const [bandas, setBandas] = useState<BandaSalarial[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    // Step 1 - Personal
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
    nacionalidad: 'Salvadoreña',
    // Contact
    direccion: '',
    telefono: '',
    email_personal: '',
    // Previsional
    numero_isss: '',
    numero_afp: '',
    afp_administradora: '',
    tipo_sangre: '',
    // Step 2 - Laborales
    area_id: '',
    perfil_puesto_id: '',
    fecha_ingreso: '',
    // Step 3 - Contract
    tipo_contrato: 'INDEFINIDO',
    salario_base_contrato: '',
    tipo_jornada: 'COMPLETA',
    fecha_inicio: '',
    fecha_fin: '',
    observaciones: '',
    // Bank
    cuenta_bancaria: '',
    banco: '',
    // Emergency
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
    contacto_emergencia_relacion: '',
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

        // Try fetching salary bands
        try {
          const bandasRes = await fetch('/api/bandas-salariales', { headers: { Authorization: `Bearer ${accessToken}` } });
          if (bandasRes.ok) {
            const d = await bandasRes.json();
            setBandas(d.data || d || []);
          }
        } catch { /* bandas endpoint may not exist */ }
      } catch { /* ignore */ }
    };
    fetchData();
  }, [accessToken]);

  const filteredPerfiles = useMemo(
    () => form.area_id ? perfiles.filter(p => p.area_id === form.area_id) : perfiles,
    [form.area_id, perfiles]
  );

  const selectedPerfil = useMemo(
    () => perfiles.find(p => p.id === form.perfil_puesto_id),
    [perfiles, form.perfil_puesto_id]
  );

  const selectedBanda = useMemo(() => {
    if (!selectedPerfil?.banda_salarial_id) return null;
    return bandas.find(b => b.id === selectedPerfil.banda_salarial_id) || null;
  }, [selectedPerfil, bandas]);

  const selectedArea = useMemo(
    () => areas.find(a => a.id === form.area_id),
    [areas, form.area_id]
  );

  const formatDui = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 8) return digits;
    return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  };

  const formatNit = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 4) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length <= 13) return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`;
  };

  const formatIsss = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    return digits;
  };

  const formatAfp = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    return digits;
  };

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.primer_nombre.trim()) e.primer_nombre = 'Primer nombre es requerido';
    if (!form.primer_apellido.trim()) e.primer_apellido = 'Primer apellido es requerido';
    if (!form.dui.trim()) e.dui = 'DUI es requerido';
    else if (!/^\d{8}-\d$/.test(form.dui)) e.dui = 'Formato DUI inválido (########-#)';
    if (form.nit && !/^\d{4}-\d{6}-\d{3}-\d$/.test(form.nit)) e.nit = 'Formato NIT inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.area_id) e.area_id = 'Área es requerida';
    if (!form.perfil_puesto_id) e.perfil_puesto_id = 'Perfil de puesto es requerido';
    if (!form.fecha_ingreso) e.fecha_ingreso = 'Fecha de ingreso es requerida';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.tipo_contrato) e.tipo_contrato = 'Tipo de contrato es requerido';
    if (!form.salario_base_contrato || parseFloat(form.salario_base_contrato) <= 0) e.salario_base_contrato = 'Salario base debe ser mayor a 0';
    if (!form.tipo_jornada) e.tipo_jornada = 'Tipo de jornada es requerido';
    if (!form.fecha_inicio) e.fecha_inicio = 'Fecha de inicio es requerida';
    if (form.fecha_fin && new Date(form.fecha_fin) <= new Date(form.fecha_inicio)) e.fecha_fin = 'Fecha fin debe ser posterior a fecha inicio';
    if (form.tipo_contrato === 'PLAZO_FIJO' && !form.fecha_fin) e.fecha_fin = 'Fecha fin es requerida para contrato a plazo fijo';
    // Salary band validation
    if (selectedBanda && form.salario_base_contrato) {
      const salary = parseFloat(form.salario_base_contrato);
      if (salary < selectedBanda.salario_minimo) {
        e.salario_base_contrato = `Salario menor al mínimo de banda ($${selectedBanda.salario_minimo.toFixed(2)})`;
      }
      if (salary > selectedBanda.salario_maximo) {
        e.salario_base_contrato = `Salario excede el máximo de banda ($${selectedBanda.salario_maximo.toFixed(2)})`;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
  };

  const handleSubmit = async () => {
    if (!confirmed) {
      toast({ title: 'Confirmación requerida', description: 'Debe confirmar que los datos son correctos', variant: 'destructive' });
      return;
    }
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
    errors[field] ? <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors[field]}</p> : null;

  const salaryPercent = useMemo(() => {
    if (!selectedBanda || !form.salario_base_contrato) return null;
    const salary = parseFloat(form.salario_base_contrato);
    const range = selectedBanda.salario_maximo - selectedBanda.salario_minimo;
    if (range <= 0) return 50;
    return Math.round(((salary - selectedBanda.salario_minimo) / range) * 100);
  }, [selectedBanda, form.salario_base_contrato]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-emerald-600" /> Nuevo Empleado
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Complete la información del nuevo empleado paso a paso</p>
        </div>
      </div>

      {/* Progress Steps */}
      <Card className="shadow-sm border-emerald-200 dark:border-emerald-800/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isComplete = step > s.num;
              return (
                <React.Fragment key={s.num}>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${isComplete ? 'bg-emerald-600 text-white shadow-sm' : isActive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-400 dark:border-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      {isComplete ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={`text-xs font-medium text-center hidden sm:block ${isActive || isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-5 sm:mb-0 transition-all ${step > s.num ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <Progress value={(step / 4) * 100} className="h-1.5 mt-3" />
        </CardContent>
      </Card>

      {/* Step 1: Datos Personales */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Nombres */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <User className="h-4 w-4" /> Nombres
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Primer Nombre *</Label>
                  <Input value={form.primer_nombre} onChange={e => updateField('primer_nombre', e.target.value)} className="h-9" placeholder="Juan" />
                  <FieldError field="primer_nombre" />
                </div>
                <div>
                  <Label className="text-xs">Segundo Nombre</Label>
                  <Input value={form.segundo_nombre} onChange={e => updateField('segundo_nombre', e.target.value)} className="h-9" placeholder="Carlos" />
                </div>
                <div>
                  <Label className="text-xs">Primer Apellido *</Label>
                  <Input value={form.primer_apellido} onChange={e => updateField('primer_apellido', e.target.value)} className="h-9" placeholder="Pérez" />
                  <FieldError field="primer_apellido" />
                </div>
                <div>
                  <Label className="text-xs">Segundo Apellido</Label>
                  <Input value={form.segundo_apellido} onChange={e => updateField('segundo_apellido', e.target.value)} className="h-9" placeholder="García" />
                </div>
                <div>
                  <Label className="text-xs">Apellido de Casada</Label>
                  <Input value={form.apellido_casada} onChange={e => updateField('apellido_casada', e.target.value)} className="h-9" placeholder="De López" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Shield className="h-4 w-4" /> Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">DUI *</Label>
                  <Input
                    placeholder="00000000-0"
                    value={form.dui}
                    onChange={e => updateField('dui', formatDui(e.target.value))}
                    className="h-9"
                    maxLength={10}
                  />
                  <FieldError field="dui" />
                  <p className="text-xs text-slate-400 mt-0.5">Formato: ########-#</p>
                </div>
                <div>
                  <Label className="text-xs">NIT</Label>
                  <Input
                    placeholder="0000-000000-000-0"
                    value={form.nit}
                    onChange={e => updateField('nit', formatNit(e.target.value))}
                    className="h-9"
                    maxLength={17}
                  />
                  <FieldError field="nit" />
                </div>
                <div>
                  <Label className="text-xs">Fecha de Nacimiento</Label>
                  <Input type="date" value={form.fecha_nacimiento} onChange={e => updateField('fecha_nacimiento', e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Género</Label>
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <button
                      type="button"
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-all ${form.genero === 'MASCULINO' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      onClick={() => updateField('genero', 'MASCULINO')}
                    >
                      👨 Masculino
                    </button>
                    <button
                      type="button"
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-all ${form.genero === 'FEMENINO' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      onClick={() => updateField('genero', 'FEMENINO')}
                    >
                      👩 Femenino
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Estado Civil</Label>
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
                  <Label className="text-xs">Nacionalidad</Label>
                  <Input value={form.nacionalidad} onChange={e => updateField('nacionalidad', e.target.value)} className="h-9" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contacto y Ubicación */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Contacto y Ubicación
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Dirección</Label>
                  <Input value={form.direccion} onChange={e => updateField('direccion', e.target.value)} className="h-9" placeholder="Calle, Colonia, Ciudad" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Teléfono</Label>
                  <Input value={form.telefono} onChange={e => updateField('telefono', e.target.value)} className="h-9" placeholder="2XXX-XXXX" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email Personal</Label>
                  <Input type="email" value={form.email_personal} onChange={e => updateField('email_personal', e.target.value)} className="h-9" placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Sangre</Label>
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
            </CardContent>
          </Card>

          {/* Previsional */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Heart className="h-4 w-4" /> Datos Previsionales
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Número ISSS</Label>
                  <Input
                    value={form.numero_isss}
                    onChange={e => updateField('numero_isss', formatIsss(e.target.value))}
                    className="h-9"
                    placeholder="000000000"
                    maxLength={9}
                  />
                </div>
                <div>
                  <Label className="text-xs">Número AFP (NUP)</Label>
                  <Input
                    value={form.numero_afp}
                    onChange={e => updateField('numero_afp', formatAfp(e.target.value))}
                    className="h-9"
                    placeholder="000000000000"
                    maxLength={12}
                  />
                </div>
                <div>
                  <Label className="text-xs">AFP Administradora</Label>
                  <Select value={form.afp_administradora} onValueChange={v => updateField('afp_administradora', v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CRECER">CRECER</SelectItem>
                      <SelectItem value="CONFIA">CONFIA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-end">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleNext}>
              Siguiente <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Datos Laborales */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Area Selection */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Área Organizacional
              </CardTitle>
              <CardDescription className="text-xs">Seleccione el área y puesto del empleado</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Área *</Label>
                  <Select value={form.area_id} onValueChange={v => { updateField('area_id', v); updateField('perfil_puesto_id', ''); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                    <SelectContent>
                      {areas.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-1.5">
                            {a.nivel && a.nivel > 1 && <span className="text-slate-400">{'─'.repeat(a.nivel - 1)} </span>}
                            {a.nombre}
                            <span className="text-xs text-slate-400">({a.codigo})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError field="area_id" />
                  {selectedArea && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {selectedArea.nombre} — {selectedArea.codigo}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Perfil de Puesto *</Label>
                  <Select value={form.perfil_puesto_id} onValueChange={v => updateField('perfil_puesto_id', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={form.area_id ? `${filteredPerfiles.length} puestos disponibles` : 'Seleccione área primero'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPerfiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="h-3 w-3 text-slate-400" />
                            {p.nombre_puesto}
                            <span className="text-xs text-slate-400">({p.codigo})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError field="perfil_puesto_id" />
                  {selectedPerfil && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> {selectedPerfil.nombre_puesto}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Salary Band */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Salario
              </CardTitle>
              <CardDescription className="text-xs">Asignación salarial dentro de la banda correspondiente</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {selectedBanda && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Banda Salarial: {selectedBanda.nombre}</span>
                    <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs">Grado {selectedBanda.grado}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-500">${selectedBanda.salario_minimo.toLocaleString()}</span>
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                      <div className="absolute h-full bg-gradient-to-r from-emerald-300 to-teal-400 dark:from-emerald-600 dark:to-teal-500 rounded-full" style={{ width: '100%' }} />
                      {salaryPercent !== null && (
                        <div className="absolute h-3 w-3 bg-emerald-600 dark:bg-emerald-400 rounded-full border-2 border-white dark:border-slate-800 shadow-sm -top-0.5" style={{ left: `calc(${Math.min(Math.max(salaryPercent, 2), 98)}% - 6px)` }} />
                      )}
                    </div>
                    <span className="text-xs text-slate-500">${selectedBanda.salario_maximo.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Medio: ${selectedBanda.salario_medio.toLocaleString()}</p>
                </div>
              )}
              <div>
                <Label className="text-xs">Salario Base (USD) *</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.salario_base_contrato}
                    onChange={e => updateField('salario_base_contrato', e.target.value)}
                    className="h-9 pl-6"
                  />
                </div>
                <FieldError field="salario_base_contrato" />
                {selectedBanda && form.salario_base_contrato && !errors.salario_base_contrato && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Dentro del rango de banda salarial
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Hire Date */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Fecha de Ingreso
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="max-w-xs">
                <Label className="text-xs">Fecha de Ingreso *</Label>
                <Input type="date" value={form.fecha_ingreso} onChange={e => updateField('fecha_ingreso', e.target.value)} className="h-9" />
                <FieldError field="fecha_ingreso" />
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleNext}>
              Siguiente <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Contract */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Contract Type */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Tipo de Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`p-3 rounded-lg border-2 text-left transition-all ${form.tipo_contrato === 'INDEFINIDO' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-300' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                  onClick={() => { updateField('tipo_contrato', 'INDEFINIDO'); updateField('fecha_fin', ''); }}
                >
                  <p className={`text-sm font-bold ${form.tipo_contrato === 'INDEFINIDO' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>Indefinido</p>
                  <p className="text-xs text-slate-500 mt-0.5">Sin fecha de finalización</p>
                </button>
                <button
                  type="button"
                  className={`p-3 rounded-lg border-2 text-left transition-all ${form.tipo_contrato === 'PLAZO_FIJO' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-300' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                  onClick={() => updateField('tipo_contrato', 'PLAZO_FIJO')}
                >
                  <p className={`text-sm font-bold ${form.tipo_contrato === 'PLAZO_FIJO' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>Plazo Fijo</p>
                  <p className="text-xs text-slate-500 mt-0.5">Con fecha de finalización</p>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs">Fecha de Inicio *</Label>
                  <Input type="date" value={form.fecha_inicio} onChange={e => updateField('fecha_inicio', e.target.value)} className="h-9" />
                  <FieldError field="fecha_inicio" />
                </div>
                <div>
                  <Label className="text-xs">Fecha de Fin {form.tipo_contrato === 'PLAZO_FIJO' ? '*' : '(opcional)'}</Label>
                  <Input type="date" value={form.fecha_fin} onChange={e => updateField('fecha_fin', e.target.value)} className="h-9" disabled={form.tipo_contrato === 'INDEFINIDO'} />
                  <FieldError field="fecha_fin" />
                  {form.tipo_contrato === 'INDEFINIDO' && (
                    <p className="text-xs text-slate-400 mt-0.5">No aplica para contrato indefinido</p>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Tipo de Jornada *</Label>
                <Select value={form.tipo_jornada} onValueChange={v => updateField('tipo_jornada', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETA">Completa (8h)</SelectItem>
                    <SelectItem value="MEDIA">Media (4h)</SelectItem>
                    <SelectItem value="POR_HORAS">Por Horas</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError field="tipo_jornada" />
              </div>
            </CardContent>
          </Card>

          {/* Position and Salary Confirmation */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Confirmación de Puesto y Salario
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Área</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedArea?.nombre || 'No seleccionada'}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Puesto</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedPerfil?.nombre_puesto || 'No seleccionado'}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Salario Base</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    ${form.salario_base_contrato ? parseFloat(form.salario_base_contrato).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">Tipo de Contrato</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{form.tipo_contrato === 'INDEFINIDO' ? 'Indefinido' : 'Plazo Fijo'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Información Bancaria
              </CardTitle>
              <CardDescription className="text-xs">Datos para depósito de salario</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Banco</Label>
                  <Select value={form.banco} onValueChange={v => updateField('banco', v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar banco" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAC">BAC Credomatic</SelectItem>
                      <SelectItem value="BANCOAGRICOLA">Banco Agrícola</SelectItem>
                      <SelectItem value="SCOTIABANK">Scotiabank</SelectItem>
                      <SelectItem value="BANCO_DAVIVIENDA">Banco Davivienda</SelectItem>
                      <SelectItem value="BANCO_CUSCATLAN">Banco Cuscatlán</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Número de Cuenta</Label>
                  <Input value={form.cuenta_bancaria} onChange={e => updateField('cuenta_bancaria', e.target.value)} className="h-9" placeholder="Número de cuenta" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Contacto de Emergencia
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input value={form.contacto_emergencia_nombre} onChange={e => updateField('contacto_emergencia_nombre', e.target.value)} className="h-9" placeholder="Nombre completo" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Teléfono</Label>
                  <Input value={form.contacto_emergencia_telefono} onChange={e => updateField('contacto_emergencia_telefono', e.target.value)} className="h-9" placeholder="7XXX-XXXX" />
                </div>
                <div>
                  <Label className="text-xs">Relación</Label>
                  <Select value={form.contacto_emergencia_relacion} onValueChange={v => updateField('contacto_emergencia_relacion', v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESPOSO/A">Esposo/a</SelectItem>
                      <SelectItem value="PADRE">Padre</SelectItem>
                      <SelectItem value="MADRE">Madre</SelectItem>
                      <SelectItem value="HIJO/A">Hijo/a</SelectItem>
                      <SelectItem value="HERMANO/A">Hermano/a</SelectItem>
                      <SelectItem value="OTRO">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observations */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Eye className="h-4 w-4" /> Observaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Input value={form.observaciones} onChange={e => updateField('observaciones', e.target.value)} className="h-9" placeholder="Observaciones adicionales..." />
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleNext}>
              Siguiente <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Personal Data Summary */}
          <Card className="shadow-sm border-emerald-200 dark:border-emerald-800/40">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <User className="h-4 w-4" /> Datos Personales
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 dark:text-emerald-400" onClick={() => setStep(1)}>
                  <EditIcon /> Editar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Nombre</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.primer_nombre} {form.segundo_nombre}</p></div>
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Apellido</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.primer_apellido} {form.segundo_apellido}</p></div>
                {form.apellido_casada && <div><p className="text-xs text-slate-500 dark:text-slate-400">Apellido Casada</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.apellido_casada}</p></div>}
                <div><p className="text-xs text-slate-500 dark:text-slate-400">DUI</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.dui}</p></div>
                {form.nit && <div><p className="text-xs text-slate-500 dark:text-slate-400">NIT</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.nit}</p></div>}
                {form.fecha_nacimiento && <div><p className="text-xs text-slate-500 dark:text-slate-400">Fecha Nacimiento</p><p className="font-medium text-slate-900 dark:text-slate-100">{new Date(form.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-SV')}</p></div>}
                {form.genero && <div><p className="text-xs text-slate-500 dark:text-slate-400">Género</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.genero === 'MASCULINO' ? 'Masculino' : 'Femenino'}</p></div>}
                {form.estado_civil && <div><p className="text-xs text-slate-500 dark:text-slate-400">Estado Civil</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.estado_civil}</p></div>}
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Nacionalidad</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.nacionalidad}</p></div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {form.direccion && <div><p className="text-xs text-slate-500 dark:text-slate-400">Dirección</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.direccion}</p></div>}
                {form.telefono && <div><p className="text-xs text-slate-500 dark:text-slate-400">Teléfono</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.telefono}</p></div>}
                {form.email_personal && <div><p className="text-xs text-slate-500 dark:text-slate-400">Email</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.email_personal}</p></div>}
                {form.tipo_sangre && <div><p className="text-xs text-slate-500 dark:text-slate-400">Tipo Sangre</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.tipo_sangre}</p></div>}
                {form.numero_isss && <div><p className="text-xs text-slate-500 dark:text-slate-400">ISSS</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.numero_isss}</p></div>}
                {form.numero_afp && <div><p className="text-xs text-slate-500 dark:text-slate-400">AFP</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.numero_afp}</p></div>}
              </div>
            </CardContent>
          </Card>

          {/* Labor Data Summary */}
          <Card className="shadow-sm border-emerald-200 dark:border-emerald-800/40">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Datos Laborales
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 dark:text-emerald-400" onClick={() => setStep(2)}>
                  <EditIcon /> Editar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Área</p><p className="font-medium text-slate-900 dark:text-slate-100">{selectedArea?.nombre || '—'}</p></div>
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Puesto</p><p className="font-medium text-slate-900 dark:text-slate-100">{selectedPerfil?.nombre_puesto || '—'}</p></div>
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Fecha Ingreso</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.fecha_ingreso ? new Date(form.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-SV') : '—'}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Contract Summary */}
          <Card className="shadow-sm border-emerald-200 dark:border-emerald-800/40">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Contrato
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 dark:text-emerald-400" onClick={() => setStep(3)}>
                  <EditIcon /> Editar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Tipo Contrato</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.tipo_contrato === 'INDEFINIDO' ? 'Indefinido' : 'Plazo Fijo'}</p></div>
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Tipo Jornada</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.tipo_jornada === 'COMPLETA' ? 'Completa' : form.tipo_jornada === 'MEDIA' ? 'Media' : 'Por Horas'}</p></div>
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Salario Base</p><p className="font-bold text-emerald-700 dark:text-emerald-300">${form.salario_base_contrato ? parseFloat(form.salario_base_contrato).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</p></div>
                <div><p className="text-xs text-slate-500 dark:text-slate-400">Fecha Inicio</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.fecha_inicio ? new Date(form.fecha_inicio + 'T12:00:00').toLocaleDateString('es-SV') : '—'}</p></div>
                {form.fecha_fin && <div><p className="text-xs text-slate-500 dark:text-slate-400">Fecha Fin</p><p className="font-medium text-slate-900 dark:text-slate-100">{new Date(form.fecha_fin + 'T12:00:00').toLocaleDateString('es-SV')}</p></div>}
                {form.banco && <div><p className="text-xs text-slate-500 dark:text-slate-400">Banco</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.banco}</p></div>}
                {form.cuenta_bancaria && <div><p className="text-xs text-slate-500 dark:text-slate-400">Cuenta</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.cuenta_bancaria}</p></div>}
              </div>
              {(form.contacto_emergencia_nombre || form.contacto_emergencia_telefono) && (
                <>
                  <Separator className="my-3" />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Contacto de Emergencia</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    {form.contacto_emergencia_nombre && <div><p className="text-xs text-slate-500 dark:text-slate-400">Nombre</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.contacto_emergencia_nombre}</p></div>}
                    {form.contacto_emergencia_telefono && <div><p className="text-xs text-slate-500 dark:text-slate-400">Teléfono</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.contacto_emergencia_telefono}</p></div>}
                    {form.contacto_emergencia_relacion && <div><p className="text-xs text-slate-500 dark:text-slate-400">Relación</p><p className="font-medium text-slate-900 dark:text-slate-100">{form.contacto_emergencia_relacion}</p></div>}
                  </div>
                </>
              )}
              {form.observaciones && (
                <>
                  <Separator className="my-3" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Observaciones</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-0.5">{form.observaciones}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Confirmation */}
          <Card className="shadow-sm border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                  className="mt-0.5"
                />
                <div>
                  <Label className="text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" onClick={() => setConfirmed(!confirmed)}>
                    Confirmo que los datos ingresados son correctos y completos
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Al confirmar, se creará el empleado con un contrato activo y registro de vacaciones
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm"
              onClick={handleSubmit}
              disabled={saving || !confirmed}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />} Registrar Empleado
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple edit icon component
function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
