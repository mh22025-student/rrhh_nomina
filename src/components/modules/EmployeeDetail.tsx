'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Edit2, Save, X, FileText, Briefcase, Heart, DollarSign,
  Palmtree, FolderOpen, Loader2, AlertCircle, Plus, Clock
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
  perfilPuesto: { id: string; nombre_puesto: string; codigo: string; bandaSalarial: { nombre: string; salario_minimo: number; salario_maximo: number } | null } | null;
  contratos: Array<{
    id: string; tipo_contrato: string; salario_base_contrato: number; tipo_jornada: string;
    fecha_inicio: string; fecha_fin: string | null; activo: boolean; observaciones: string | null;
    perfilPuesto: { nombre_puesto: string } | null;
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

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

  const InfoField = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-sm text-slate-900 mt-0.5">{value || '—'}</p>
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">{getNombreCompleto()}</h2>
          <p className="text-sm text-slate-500">{empleado.codigo_empleado} • {empleado.area?.nombre || 'Sin área'}</p>
        </div>
        <Badge className={empleado.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {empleado.estado}
        </Badge>
        {(canEdit || canEditOwn) && !editing && (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit2 className="h-4 w-4 mr-1" /> Editar
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Guardar
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full h-auto gap-1">
          <TabsTrigger value="personal" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" /> Personal</TabsTrigger>
          <TabsTrigger value="contrato" className="text-xs gap-1"><Briefcase className="h-3.5 w-3.5" /> Contrato</TabsTrigger>
          <TabsTrigger value="previsional" className="text-xs gap-1"><Heart className="h-3.5 w-3.5" /> Previsional</TabsTrigger>
          <TabsTrigger value="nomina" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" /> Nómina</TabsTrigger>
          <TabsTrigger value="vacaciones" className="text-xs gap-1"><Palmtree className="h-3.5 w-3.5" /> Vacaciones</TabsTrigger>
          <TabsTrigger value="expediente" className="text-xs gap-1"><FolderOpen className="h-3.5 w-3.5" /> Expediente</TabsTrigger>
        </TabsList>

        {/* Tab 1: Datos Personales */}
        <TabsContent value="personal">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos Personales</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
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
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoField label="Primer Nombre" value={empleado.primer_nombre} />
                  <InfoField label="Segundo Nombre" value={empleado.segundo_nombre} />
                  <InfoField label="Primer Apellido" value={empleado.primer_apellido} />
                  <InfoField label="Segundo Apellido" value={empleado.segundo_apellido} />
                  <InfoField label="Apellido de Casada" value={empleado.apellido_casada} />
                  <InfoField label="DUI" value={empleado.dui} />
                  <InfoField label="NIT" value={empleado.nit} />
                  <InfoField label="Fecha de Nacimiento" value={formatDate(empleado.fecha_nacimiento)} />
                  <InfoField label="Género" value={empleado.genero} />
                  <InfoField label="Estado Civil" value={empleado.estado_civil} />
                  <InfoField label="Nacionalidad" value={empleado.nacionalidad} />
                  <InfoField label="Teléfono" value={empleado.telefono} />
                  <InfoField label="Email Personal" value={empleado.email_personal} />
                  <div className="sm:col-span-2 lg:col-span-3"><InfoField label="Dirección" value={empleado.direccion} /></div>
                  <Separator className="sm:col-span-2 lg:col-span-3" />
                  <InfoField label="Contacto Emergencia" value={empleado.contacto_emergencia_nombre} />
                  <InfoField label="Teléfono Emergencia" value={empleado.contacto_emergencia_telefono} />
                  <InfoField label="Relación Emergencia" value={empleado.contacto_emergencia_relacion} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Contrato */}
        <TabsContent value="contrato">
          <div className="space-y-4">
            {/* Active Contract */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Contrato Vigente</CardTitle>
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => setNewContractOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Nuevo Contrato
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activeContract ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoField label="Tipo de Contrato" value={activeContract.tipo_contrato} />
                    <InfoField label="Salario Base" value={formatSalary(activeContract.salario_base_contrato)} />
                    <InfoField label="Jornada" value={activeContract.tipo_jornada} />
                    <InfoField label="Fecha Inicio" value={formatDate(activeContract.fecha_inicio)} />
                    <InfoField label="Fecha Fin" value={activeContract.fecha_fin ? formatDate(activeContract.fecha_fin) : 'Indefinido'} />
                    <InfoField label="Puesto" value={activeContract.perfilPuesto?.nombre_puesto || '—'} />
                    <div className="sm:col-span-2 lg:col-span-3"><InfoField label="Observaciones" value={activeContract.observaciones} /></div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No hay contrato vigente</p>
                )}
              </CardContent>
            </Card>

            {/* Contract History */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Historial de Contratos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Salario</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empleado.contratos.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-500">Sin contratos registrados</TableCell></TableRow>
                    ) : (
                      empleado.contratos.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">{c.tipo_contrato}</TableCell>
                          <TableCell className="text-sm font-mono">{formatSalary(c.salario_base_contrato)}</TableCell>
                          <TableCell className="text-sm">{formatDate(c.fecha_inicio)}</TableCell>
                          <TableCell className="text-sm">{c.fecha_fin ? formatDate(c.fecha_fin) : 'Indefinido'}</TableCell>
                          <TableCell>
                            <Badge variant={c.activo ? 'default' : 'secondary'} className={c.activo ? 'bg-emerald-100 text-emerald-700' : ''}>
                              {c.activo ? 'Vigente' : 'Finalizado'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Datos Previsionales */}
        <TabsContent value="previsional">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos Previsionales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Número ISSS" value={empleado.numero_isss} />
                <InfoField label="Número AFP (NUP)" value={empleado.numero_afp} />
                <InfoField label="AFP Administradora" value={empleado.afp_administradora} />
                <InfoField label="Tipo de Sangre" value={empleado.tipo_sangre} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Nómina */}
        <TabsContent value="nomina">
          <div className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Salario Actual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoField label="Salario Base" value={formatSalary(empleado.salario_base)} />
                  <InfoField label="Puesto" value={empleado.perfilPuesto?.nombre_puesto} />
                  <InfoField label="Banda Salarial" value={empleado.perfilPuesto?.bandaSalarial?.nombre} />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Historial de Cambios Salariales</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Salario Anterior</TableHead>
                      <TableHead>Salario Nuevo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empleado.cambios_salariales.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-500">Sin cambios salariales registrados</TableCell></TableRow>
                    ) : (
                      empleado.cambios_salariales.map(cs => (
                        <TableRow key={cs.id}>
                          <TableCell className="text-sm">{formatDate(cs.fecha_cambio)}</TableCell>
                          <TableCell className="text-sm font-mono">{formatSalary(cs.salario_anterior)}</TableCell>
                          <TableCell className="text-sm font-mono">{formatSalary(cs.salario_nuevo)}</TableCell>
                          <TableCell className="text-sm">{cs.tipo_cambio}</TableCell>
                          <TableCell className="text-sm">{cs.motivo || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 5: Vacaciones */}
        <TabsContent value="vacaciones">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Saldo de Vacaciones</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Año</TableHead>
                    <TableHead>Días Derecho</TableHead>
                    <TableHead>Días Tomados</TableHead>
                    <TableHead>Días Pendientes</TableHead>
                    <TableHead>Días Vendidos</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empleado.vacaciones.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-slate-500">Sin registros de vacaciones</TableCell></TableRow>
                  ) : (
                    empleado.vacaciones.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="text-sm font-medium">{v.anio}</TableCell>
                        <TableCell className="text-sm">{v.dias_derecho}</TableCell>
                        <TableCell className="text-sm">{v.dias_tomados}</TableCell>
                        <TableCell className="text-sm font-semibold text-amber-600">{v.dias_pendientes}</TableCell>
                        <TableCell className="text-sm">{v.dias_vendidos}</TableCell>
                        <TableCell>
                          <Badge variant={v.estado === 'ABIERTO' ? 'default' : 'secondary'} className={v.estado === 'ABIERTO' ? 'bg-emerald-100 text-emerald-700' : ''}>
                            {v.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Expediente */}
        <TabsContent value="expediente">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Documentos del Empleado</CardTitle>
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
                <div className="space-y-2">
                  {empleado.documentos.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <FileText className="h-5 w-5 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.nombre_archivo}</p>
                        <p className="text-xs text-slate-500">{doc.tipo_documento} • {formatDate(doc.fecha_creacion)}</p>
                      </div>
                      {doc.descripcion && <p className="text-xs text-slate-400 hidden sm:block">{doc.descripcion}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Contract Dialog */}
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
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateContract} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Crear Contrato
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
