'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plug, TestTube2, Loader2, Activity, CheckCircle, XCircle, Clock, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface IntegrationsProps {
  accessToken: string;
  userRole: string;
}

interface LogEntry { id: string; tipo_operacion: string; estado: string; mensaje_error: string | null; duracion_ms: number | null; fecha_creacion: string; }

interface Integracion {
  id: string; tipo: string; nombre: string; configuracion: string | null;
  credenciales_cifradas: string | null; activo: boolean;
  ultimo_test: string | null; estado_test: string | null;
  logs: LogEntry[];
}

const tipoIcons: Record<string, string> = {
  BANCO: '🏦', ISSS: '🏥', AFP: '💼', SMTP: '📧', MH: '🏛️',
};

const tipoColors: Record<string, string> = {
  BANCO: 'bg-blue-50 border-blue-200',
  ISSS: 'bg-emerald-50 border-emerald-200',
  AFP: 'bg-purple-50 border-purple-200',
  SMTP: 'bg-amber-50 border-amber-200',
  MH: 'bg-red-50 border-red-200',
};

const estadoTestColors: Record<string, string> = {
  EXITOSO: 'bg-emerald-100 text-emerald-800',
  FALLIDO: 'bg-red-100 text-red-800',
};

const logEstadoColors: Record<string, string> = {
  EXITOSO: 'bg-emerald-100 text-emerald-800',
  FALLIDO: 'bg-red-100 text-red-800',
  ERROR: 'bg-red-100 text-red-800',
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
};

export default function Integrations({ accessToken, userRole }: IntegrationsProps) {
  const { toast } = useToast();
  const [integraciones, setIntegraciones] = useState<Integracion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editIntegracion, setEditIntegracion] = useState<Integracion | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({ tipo: 'BANCO', nombre: '', configuracion: '', credenciales_cifradas: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integraciones', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setIntegraciones(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, test: true }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: data.estado_test === 'EXITOSO' ? 'Conexión exitosa' : 'Conexión fallida',
          description: data.estado_test === 'EXITOSO' ? 'La prueba de conexión fue exitosa' : 'No se pudo establecer la conexión',
          variant: data.estado_test === 'EXITOSO' ? 'default' : 'destructive',
        });
        fetchData();
      }
    } catch {
      toast({ title: 'Error', description: 'Error al probar conexión', variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  const handleCreate = async () => {
    if (!form.nombre || !form.tipo) {
      toast({ title: 'Error', description: 'Tipo y nombre son requeridos', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({ title: 'Integración creada', description: 'La integración ha sido registrada' });
        setShowCreateDialog(false);
        setForm({ tipo: 'BANCO', nombre: '', configuracion: '', credenciales_cifradas: '' });
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editIntegracion) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editIntegracion.id,
          nombre: form.nombre,
          configuracion: form.configuracion ? JSON.parse(form.configuracion) : null,
          activo: editIntegracion.activo,
        }),
      });
      if (res.ok) {
        toast({ title: 'Integración actualizada' });
        setEditIntegracion(null);
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión o JSON inválido', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (int: Integracion) => {
    setEditIntegracion(int);
    setForm({
      tipo: int.tipo,
      nombre: int.nombre,
      configuracion: int.configuracion || '',
      credenciales_cifradas: int.credenciales_cifradas || '',
    });
  };

  const canManage = userRole === 'ADMIN';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Integraciones</h2>
          <p className="text-sm text-slate-500">Configuración de conexiones con sistemas externos</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreateDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plug className="h-4 w-4 mr-2" /> Nueva Integración
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : integraciones.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center">
            <Plug className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700">No hay integraciones</h3>
            <p className="text-sm text-slate-500">Configure integraciones con sistemas externos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integraciones.map((integ) => (
            <Card key={integ.id} className={`shadow-sm border ${tipoColors[integ.tipo] || 'border-slate-200'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-xl">{tipoIcons[integ.tipo] || '🔌'}</span>
                  <span className="flex-1 truncate">{integ.nombre}</span>
                  {!integ.activo && <Badge variant="secondary" className="text-xs">Inactiva</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{integ.tipo}</Badge>
                  {integ.estado_test ? (
                    <Badge className={estadoTestColors[integ.estado_test] || 'bg-gray-100'}>
                      {integ.estado_test === 'EXITOSO' ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      {integ.estado_test}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Sin test</Badge>
                  )}
                </div>

                {integ.ultimo_test && (
                  <p className="text-xs text-slate-500">
                    Último test: {new Date(integ.ultimo_test).toLocaleString('es-SV')}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleTest(integ.id)}
                    disabled={testing === integ.id}
                  >
                    {testing === integ.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <TestTube2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    Probar
                  </Button>
                  {canManage && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(integ)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Activity Log */}
                {integ.logs.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Actividad Reciente
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {integ.logs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          <Badge className={`${logEstadoColors[log.estado] || 'bg-gray-100'} text-[10px] px-1 py-0`}>
                            {log.estado}
                          </Badge>
                          <span className="text-slate-500 truncate">{log.tipo_operacion}</span>
                          <span className="text-slate-400 ml-auto shrink-0">
                            {log.duracion_ms ? `${log.duracion_ms}ms` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Integración</DialogTitle>
            <DialogDescription>Configure una nueva conexión con un sistema externo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANCO">🏦 Banco</SelectItem>
                  <SelectItem value="ISSS">🏥 ISSS</SelectItem>
                  <SelectItem value="AFP">💼 AFP</SelectItem>
                  <SelectItem value="SMTP">📧 SMTP</SelectItem>
                  <SelectItem value="MH">🏛️ Ministerio de Hacienda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre descriptivo" />
            </div>
            <div className="space-y-2">
              <Label>Configuración (JSON)</Label>
              <Textarea value={form.configuracion} onChange={(e) => setForm({ ...form, configuracion: e.target.value })} placeholder='{"host": "...", "port": 443}' rows={4} className="font-mono text-xs" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editIntegracion} onOpenChange={(open) => !open && setEditIntegracion(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-600" />
              Editar Integración: {editIntegracion?.nombre}
            </DialogTitle>
            <DialogDescription>Modifique la configuración de la integración</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Configuración (JSON)</Label>
              <Textarea value={form.configuracion} onChange={(e) => setForm({ ...form, configuracion: e.target.value })} rows={6} className="font-mono text-xs" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditIntegracion(null)}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
