'use client';

import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Lock, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string | null;
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: Math.round((score / 5) * 100), label: 'Débil', color: 'bg-red-500' };
  if (score <= 3) return { score: Math.round((score / 5) * 100), label: 'Media', color: 'bg-amber-500' };
  return { score: Math.round((score / 5) * 100), label: 'Fuerte', color: 'bg-emerald-500' };
}

function Requirement({ met, text }: { met: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-emerald-600' : 'text-slate-400'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {text}
    </li>
  );
}

export default function ChangePasswordDialog({ open, onOpenChange, accessToken }: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const strength = getPasswordStrength(newPassword);

  const validations = {
    minLength: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasNumber: /\d/.test(newPassword),
    hasSpecial: /[^a-zA-Z0-9]/.test(newPassword),
    matches: confirmPassword.length > 0 && newPassword === confirmPassword,
    isDifferent: currentPassword.length > 0 && newPassword.length > 0 && currentPassword !== newPassword,
  };

  const isFormValid = validations.minLength && validations.matches && validations.isDifferent;

  const resetForm = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError('');
  }, []);

  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  }, [onOpenChange, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isFormValid) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al cambiar la contraseña');
        return;
      }

      toast({
        title: 'Contraseña actualizada',
        description: 'Su contraseña ha sido cambiada exitosamente.',
      });

      handleClose(false);
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" />
            Cambiar Contraseña
          </DialogTitle>
          <DialogDescription>
            Actualice su contraseña de acceso al sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña Actual</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                placeholder="Ingrese su contraseña actual"
                disabled={isSubmitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva Contraseña</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                placeholder="Ingrese la nueva contraseña"
                disabled={isSubmitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength meter */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Progress value={strength.score} className="h-2 flex-1" />
                  <span className={`ml-2 text-xs font-medium ${
                    strength.label === 'Débil' ? 'text-red-500' :
                    strength.label === 'Media' ? 'text-amber-500' :
                    'text-emerald-500'
                  }`}>
                    {strength.label}
                  </span>
                </div>
                <ul className="space-y-0.5 mt-1">
                  <Requirement met={validations.minLength} text="Mínimo 8 caracteres" />
                  <Requirement met={validations.hasUpper} text="Al menos una mayúscula" />
                  <Requirement met={validations.hasLower} text="Al menos una minúscula" />
                  <Requirement met={validations.hasNumber} text="Al menos un número" />
                  <Requirement met={validations.hasSpecial} text="Al menos un carácter especial" />
                </ul>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Confirme la nueva contraseña"
                disabled={isSubmitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !validations.matches && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <X className="h-3 w-3" />
                Las contraseñas no coinciden
              </p>
            )}
            {confirmPassword.length > 0 && validations.matches && (
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Las contraseñas coinciden
              </p>
            )}
          </div>

          {/* Different from current password check */}
          {currentPassword.length > 0 && newPassword.length > 0 && !validations.isDifferent && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              La nueva contraseña debe ser diferente a la actual
            </p>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Cambiar Contraseña'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
