'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, Edit2, Loader2, KeyRound, Users
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

interface UserManagementProps {
  accessToken: string | null;
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  estado: string;
  ultimo_login: string | null;
  debe_cambiar_password: boolean;
  fecha_creacion: string;
  empleado: { codigo_empleado: string; primer_nombre: string; primer_apellido: string } | null;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  ANALISTA: 'bg-blue-100 text-blue-700',
  APROBADOR: 'bg-emerald-100 text-emerald-700',
  GERENCIA: 'bg-purple-100 text-purple-700',
  AUDITOR: 'bg-amber-100 text-amber-700',
  EMPLEADO: 'bg-slate-100 text-slate-600',
};

export default function UserManagement({ accessToken }: UserManagementProps) {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    email: '', password: '', nombre: '', apellido: '', rol: 'EMPLEADO',
  });

  const [editForm, setEditForm] = useState({ rol: '', estado: '' });
  const [resetForm, setResetForm] = useState({ new_password: '' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) setUsers(data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    if (!newUser.email || !newUser.password || !newUser.nombre || !newUser.apellido) {
      toast({ title: 'Error', description: 'Todos los campos son requeridos', variant: 'destructive' });
      return;
    }
    if (newUser.password.length < 8) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 8 caracteres', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Usuario creado', description: `${newUser.email} registrado exitosamente` });
        setDialogOpen(false);
        setNewUser({ email: '', password: '', nombre: '', apellido: '', rol: 'EMPLEADO' });
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al crear usuario', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Usuario actualizado', description: 'Los cambios han sido guardados' });
        setEditDialogOpen(false);
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al actualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (!resetForm.new_password || resetForm.new_password.length < 8) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 8 caracteres', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reset_password: true, new_password: resetForm.new_password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Contraseña restablecida', description: 'El usuario deberá cambiarla en su próximo inicio de sesión' });
        setResetDialogOpen(false);
        setResetForm({ new_password: '' });
      } else {
        toast({ title: 'Error', description: data.error || 'Error al restablecer', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('¿Está seguro de desactivar este usuario?')) return;
    try {
      const res = await fetch(`/api/usuarios/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Usuario desactivado', description: 'El usuario ha sido desactivado' });
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al desactivar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-SV', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-600" /> Gestión de Usuarios
        </h2>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Usuario
        </Button>
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="hidden md:table-cell">Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Último Login</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center text-slate-400">
                      <Users className="h-10 w-10 mb-2" />
                      <p className="text-sm font-medium">No hay usuarios registrados</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm font-medium">
                      {u.nombre} {u.apellido}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_COLORS[u.rol] || 'bg-slate-100 text-slate-600'}>
                        {u.rol}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={u.estado === 'ACTIVO' ? 'default' : 'secondary'} className={u.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                        {u.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 hidden lg:table-cell">{formatDate(u.ultimo_login)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                          setSelectedUser(u);
                          setEditForm({ rol: u.rol, estado: u.estado });
                          setEditDialogOpen(true);
                        }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                          setSelectedUser(u);
                          setResetForm({ new_password: '' });
                          setResetDialogOpen(true);
                        }}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        {u.estado === 'ACTIVO' && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => handleDeactivate(u.id)}>
                            <Shield className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>Crear una nueva cuenta de usuario en el sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={newUser.nombre} onChange={e => setNewUser(p => ({ ...p, nombre: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label>Apellido *</Label>
                <Input value={newUser.apellido} onChange={e => setNewUser(p => ({ ...p, apellido: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label>Contraseña *</Label>
              <Input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className="h-9" />
              <p className="text-xs text-slate-500 mt-0.5">Mínimo 8 caracteres. El usuario deberá cambiarla al iniciar sesión.</p>
            </div>
            <div>
              <Label>Rol *</Label>
              <Select value={newUser.rol} onValueChange={v => setNewUser(p => ({ ...p, rol: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="ANALISTA">ANALISTA</SelectItem>
                  <SelectItem value="APROBADOR">APROBADOR</SelectItem>
                  <SelectItem value="GERENCIA">GERENCIA</SelectItem>
                  <SelectItem value="AUDITOR">AUDITOR</SelectItem>
                  <SelectItem value="EMPLEADO">EMPLEADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Crear Usuario
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>Modificar rol y estado de {selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rol</Label>
              <Select value={editForm.rol} onValueChange={v => setEditForm(p => ({ ...p, rol: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="ANALISTA">ANALISTA</SelectItem>
                  <SelectItem value="APROBADOR">APROBADOR</SelectItem>
                  <SelectItem value="GERENCIA">GERENCIA</SelectItem>
                  <SelectItem value="AUDITOR">AUDITOR</SelectItem>
                  <SelectItem value="EMPLEADO">EMPLEADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={editForm.estado} onValueChange={v => setEditForm(p => ({ ...p, estado: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INACTIVO">Inactivo</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleEdit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>Establecer nueva contraseña para {selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nueva Contraseña</Label>
              <Input type="password" value={resetForm.new_password} onChange={e => setResetForm(p => ({ ...p, new_password: e.target.value }))} className="h-9" />
              <p className="text-xs text-slate-500 mt-0.5">Mínimo 8 caracteres. El usuario deberá cambiarla al iniciar sesión.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleResetPassword} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Restablecer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
