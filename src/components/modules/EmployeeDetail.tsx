'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Edit2, Save, X, FileText, Briefcase, Heart, DollarSign,
  Palmtree, FolderOpen, Loader2, AlertCircle, Plus, Clock,
  User, CalendarDays, AlertTriangle, Printer, MapPin, Phone, Mail,
  Shield, Building2, Hash, CreditCard, TrendingUp, ChevronDown,
  ChevronUp, ChevronRight, Globe, Droplets, Users, Award, Download, Search,
  FileCheck, Stamp, LetterText, FileSpreadsheet,
  Sparkles
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

/* ─── Document Category & Card Types ─── */
interface DocItem {
  id: string;
  title: string;
  description: string;
  category: 'contratos' | 'constancias' | 'boletas' | 'cartas' | 'otros';
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  date: string;
  status: 'Vigente' | 'Expirado' | 'Borrador';
  statusColor: string;
  onDownload?: () => void;
  onPrint?: () => void;
}

function getDocStatusColor(status: string): string {
  switch (status) {
    case 'Vigente': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'Expirado': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'Borrador': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

function getContractStatus(fechaFin: string | null, activo: boolean): 'Vigente' | 'Expirado' | 'Borrador' {
  if (!activo) return 'Expirado';
  if (!fechaFin) return 'Vigente';
  return new Date(fechaFin) > new Date() ? 'Vigente' : 'Expirado';
}

/* ─── DocumentGrid Component ─── */
function DocumentGrid({
  empleado,
  docCategory,
  docSearch,
  planillas,
  selectedPlanilla,
  setSelectedPlanilla,
  aguinaldoAnio,
  accessToken,
  formatDate,
  formatSalary,
  addToRecentDocs,
  getNombreCompleto,
  toast,
  recentDocs,
}: {
  empleado: EmpleadoDetail;
  docCategory: string;
  docSearch: string;
  planillas: Array<{ id: string; codigo_planilla: string; tipo: string; estado: string; fecha_inicio_periodo: string; fecha_fin_periodo: string }>;
  selectedPlanilla: string;
  setSelectedPlanilla: (v: string) => void;
  aguinaldoAnio: string;
  accessToken: string | null;
  formatDate: (d: string | null) => string;
  formatSalary: (amount: number) => string;
  addToRecentDocs: (doc: { id: string; title: string; type: string; date: string; category: string }) => void;
  getNombreCompleto: () => string;
  toast: (opts: { title: string; description?: string; variant?: string }) => void;
  recentDocs: Array<{ id: string; title: string; type: string; date: string; category: string }>;
}) {
  const handleDownloadBoleta = async (planillaId: string, planillaCodigo: string) => {
    try {
      const res = await fetch(`/api/nomina/planillas/${planillaId}/boleta?empleado_id=${empleado.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: 'Error', description: (data as { error?: string }).error || 'No se pudo generar la boleta', variant: 'destructive' });
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boleta-${empleado.codigo_empleado}-${planillaCodigo}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      addToRecentDocs({
        id: `boleta-${planillaId}`,
        title: `Boleta ${planillaCodigo}`,
        type: 'Boleta de Pago',
        date: new Date().toISOString(),
        category: 'boletas',
      });
      toast({ title: 'Boleta descargada', description: `Boleta de ${planillaCodigo} descargada exitosamente` });
    } catch {
      toast({ title: 'Error', description: 'Error de conexión al descargar boleta', variant: 'destructive' });
    }
  };

  const handleDownloadAguinaldo = async () => {
    try {
      const res = await fetch(`/api/nomina/aguinaldo/pdf?empleado_id=${empleado.id}&anio=${aguinaldoAnio}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: 'Error', description: (data as { error?: string }).error || 'No se pudo generar la constancia', variant: 'destructive' });
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aguinaldo-${empleado.codigo_empleado}-${aguinaldoAnio}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      addToRecentDocs({
        id: `aguinaldo-${aguinaldoAnio}`,
        title: `Constancia Aguinaldo ${aguinaldoAnio}`,
        type: 'Constancia de Aguinaldo',
        date: new Date().toISOString(),
        category: 'constancias',
      });
      toast({ title: 'Constancia descargada', description: `Constancia de aguinaldo ${aguinaldoAnio} descargada` });
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const handleGenerateTextDoc = (title: string, content: string, filename: string, category: string, docId: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    addToRecentDocs({
      id: docId,
      title,
      type: category,
      date: new Date().toISOString(),
      category: category === 'Constancia de Empleo' || category === 'Constancia de Salario' ? 'constancias' : 'cartas',
    });
    toast({ title: 'Documento generado', description: `${title} descargado exitosamente` });
  };

  const handlePrintDoc = (title: string, content: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>${title}</title>
        <style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6}h1{color:#047857}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;border:1px solid #e2e8f0;text-align:left}th{background:#f0fdf4}.header{text-align:center;margin-bottom:32px}.signature{margin-top:64px;display:flex;justify-content:space-between}.sig-line{border-top:1px solid #000;width:200px;text-align:center;padding-top:4px}</style>
        </head><body>${content}</body></html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  /* Build document list from employee data */
  const allDocuments: DocItem[] = (() => {
    const docs: DocItem[] = [];

    // Contratos from DB
    empleado.contratos.forEach(c => {
      const status = getContractStatus(c.fecha_fin, c.activo);
      docs.push({
        id: `contrato-${c.id}`,
        title: `Contrato ${c.tipo_contrato.replace(/_/g, ' ')}`,
        description: `Puesto: ${c.perfil_puesto?.nombre_puesto || 'N/A'} • Jornada: ${c.tipo_jornada.replace(/_/g, ' ')} • Salario: ${formatSalary(c.salario_base_contrato)}`,
        category: 'contratos',
        icon: <FileText className="h-5 w-5" />,
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        date: c.fecha_inicio,
        status,
        statusColor: getDocStatusColor(status),
        onDownload: () => {
          const content = generateConstanciaEmpleoHTML(empleado, formatDate, formatSalary);
          handleGenerateTextDoc(`Contrato ${c.tipo_contrato}`, content, `contrato-${empleado.codigo_empleado}-${c.tipo_contrato}.txt`, 'Contrato', `contrato-${c.id}`);
        },
        onPrint: () => {
          const content = generateConstanciaEmpleoHTML(empleado, formatDate, formatSalary);
          handlePrintDoc(`Contrato ${c.tipo_contrato}`, content);
        },
      });
    });

    // Constancias (generated)
    docs.push({
      id: 'constancia-empleo',
      title: 'Constancia de Empleo',
      description: 'Certifica que el empleado labora activamente en la empresa',
      category: 'constancias',
      icon: <Stamp className="h-5 w-5" />,
      iconBg: 'bg-teal-100 dark:bg-teal-900/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
      date: new Date().toISOString(),
      status: empleado.estado === 'ACTIVO' ? 'Vigente' : 'Expirado',
      statusColor: getDocStatusColor(empleado.estado === 'ACTIVO' ? 'Vigente' : 'Expirado'),
      onDownload: () => {
        const content = generateConstanciaEmpleoHTML(empleado, formatDate, formatSalary);
        handleGenerateTextDoc('Constancia de Empleo', content, `constancia-empleo-${empleado.codigo_empleado}.txt`, 'Constancia de Empleo', 'constancia-empleo');
      },
      onPrint: () => {
        const content = generateConstanciaEmpleoHTML(empleado, formatDate, formatSalary);
        handlePrintDoc('Constancia de Empleo', content);
      },
    });

    docs.push({
      id: 'constancia-salario',
      title: 'Constancia de Salario',
      description: `Salario actual: ${formatSalary(empleado.salario_base)}`,
      category: 'constancias',
      icon: <DollarSign className="h-5 w-5" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      date: new Date().toISOString(),
      status: empleado.estado === 'ACTIVO' ? 'Vigente' : 'Expirado',
      statusColor: getDocStatusColor(empleado.estado === 'ACTIVO' ? 'Vigente' : 'Expirado'),
      onDownload: () => {
        const content = generateConstanciaSalarioHTML(empleado, formatDate, formatSalary);
        handleGenerateTextDoc('Constancia de Salario', content, `constancia-salario-${empleado.codigo_empleado}.txt`, 'Constancia de Salario', 'constancia-salario');
      },
      onPrint: () => {
        const content = generateConstanciaSalarioHTML(empleado, formatDate, formatSalary);
        handlePrintDoc('Constancia de Salario', content);
      },
    });

    // Constancia de Aguinaldo
    docs.push({
      id: `constancia-aguinaldo-${aguinaldoAnio}`,
      title: `Constancia de Aguinaldo ${aguinaldoAnio}`,
      description: 'Cálculo de aguinaldo según ley salvadoreña',
      category: 'constancias',
      icon: <Palmtree className="h-5 w-5" />,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      date: new Date().toISOString(),
      status: 'Borrador',
      statusColor: getDocStatusColor('Borrador'),
      onDownload: handleDownloadAguinaldo,
      onPrint: handleDownloadAguinaldo,
    });

    // Boletas de Pago (from planillas)
    planillas.forEach(p => {
      docs.push({
        id: `boleta-${p.id}`,
        title: `Boleta ${p.codigo_planilla}`,
        description: `Período: ${formatDate(p.fecha_inicio_periodo)} - ${formatDate(p.fecha_fin_periodo)} • Tipo: ${p.tipo}`,
        category: 'boletas',
        icon: <FileSpreadsheet className="h-5 w-5" />,
        iconBg: 'bg-rose-100 dark:bg-rose-900/30',
        iconColor: 'text-rose-600 dark:text-rose-400',
        date: p.fecha_fin_periodo,
        status: p.estado === 'CERRADA' ? 'Vigente' : 'Borrador',
        statusColor: getDocStatusColor(p.estado === 'CERRADA' ? 'Vigente' : 'Borrador'),
        onDownload: () => handleDownloadBoleta(p.id, p.codigo_planilla),
        onPrint: () => handleDownloadBoleta(p.id, p.codigo_planilla),
      });
    });

    // Cartas
    docs.push({
      id: 'carta-referencia',
      title: 'Carta de Referencia Laboral',
      description: 'Referencia laboral del empleado',
      category: 'cartas',
      icon: <LetterText className="h-5 w-5" />,
      iconBg: 'bg-sky-100 dark:bg-sky-900/30',
      iconColor: 'text-sky-600 dark:text-sky-400',
      date: new Date().toISOString(),
      status: 'Borrador',
      statusColor: getDocStatusColor('Borrador'),
      onDownload: () => {
        const content = generateCartaReferenciaHTML(empleado, formatDate, formatSalary);
        handleGenerateTextDoc('Carta de Referencia', content, `carta-referencia-${empleado.codigo_empleado}.txt`, 'Carta de Referencia', 'carta-referencia');
      },
      onPrint: () => {
        const content = generateCartaReferenciaHTML(empleado, formatDate, formatSalary);
        handlePrintDoc('Carta de Referencia', content);
      },
    });

    // Otros - from empleado.documentos
    empleado.documentos.forEach(doc => {
      docs.push({
        id: `doc-${doc.id}`,
        title: doc.nombre_archivo,
        description: doc.descripcion || doc.tipo_documento,
        category: 'otros',
        icon: <FileCheck className="h-5 w-5" />,
        iconBg: 'bg-slate-100 dark:bg-slate-800/50',
        iconColor: 'text-slate-600 dark:text-slate-400',
        date: doc.fecha_creacion,
        status: 'Vigente',
        statusColor: getDocStatusColor('Vigente'),
      });
    });

    return docs;
  })();

  /* Filter documents */
  const filteredDocs = (() => {
    let result = allDocuments;
    if (docCategory !== 'todos') {
      result = result.filter(d => d.category === docCategory);
    }
    if (docSearch.trim()) {
      const q = docSearch.toLowerCase();
      result = result.filter(d => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
    }
    return result;
  })();

  /* Category counts */
  const categoryCounts = (() => {
    const counts: Record<string, number> = { todos: allDocuments.length };
    allDocuments.forEach(d => {
      counts[d.category] = (counts[d.category] || 0) + 1;
    });
    return counts;
  })();

  /* Recent docs from parent state */
  const recentDocItems = (() => {
    if (recentDocs.length === 0) return [];
    return recentDocs.map(rd => {
      const matchingDoc = allDocuments.find(d => d.id === rd.id);
      return {
        ...rd,
        icon: matchingDoc?.icon || <FileText className="h-4 w-4" />,
        iconBg: matchingDoc?.iconBg || 'bg-slate-100 dark:bg-slate-800/50',
        iconColor: matchingDoc?.iconColor || 'text-slate-600 dark:text-slate-400',
        onDownload: matchingDoc?.onDownload,
      };
    });
  })();

  if (filteredDocs.length === 0) {
    return (
      <Card className="shadow-sm border-dashed">
        <CardContent className="py-16 flex flex-col items-center text-slate-400 dark:text-slate-500">
          <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <FolderOpen className="h-10 w-10" />
          </div>
          <p className="text-base font-medium text-slate-600 dark:text-slate-300">No se encontraron documentos</p>
          <p className="text-sm mt-1">
            {docCategory !== 'todos' || docSearch
              ? 'Intenta con otra categoría o término de búsqueda'
              : 'Los documentos del empleado aparecerán aquí'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { key: 'todos', label: 'Total', icon: <FolderOpen className="h-3.5 w-3.5" /> },
          { key: 'contratos', label: 'Contratos', icon: <FileText className="h-3.5 w-3.5" /> },
          { key: 'constancias', label: 'Constancias', icon: <Stamp className="h-3.5 w-3.5" /> },
          { key: 'boletas', label: 'Boletas', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
          { key: 'cartas', label: 'Cartas', icon: <LetterText className="h-3.5 w-3.5" /> },
          { key: 'otros', label: 'Otros', icon: <FileCheck className="h-3.5 w-3.5" /> },
        ].map(stat => (
          <button
            key={stat.key}
            onClick={() => {} /* category change is handled by parent */}
            className={`p-2.5 rounded-lg border text-center transition-all ${
              docCategory === stat.key
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
              {stat.icon}
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{categoryCounts[stat.key] || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Document Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredDocs.map(doc => (
          <Card key={doc.id} className="shadow-sm hover:shadow-md transition-all group border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-lg ${doc.iconBg} flex items-center justify-center shrink-0`}>
                  <span className={doc.iconColor}>{doc.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate leading-tight">{doc.title}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${doc.statusColor}`}>
                      {doc.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{doc.description}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDate(doc.date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                {doc.onDownload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                    onClick={doc.onDownload}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Descargar
                  </Button>
                )}
                {doc.onPrint && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    onClick={doc.onPrint}
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                  </Button>
                )}
                {!doc.onDownload && !doc.onPrint && (
                  <span className="text-[11px] text-slate-400 italic">Sin acciones disponibles</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Documents Section */}
      {recentDocItems.length > 0 && (
        <Card className="shadow-sm border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Clock className="h-4 w-4" /> Documentos Recientes
            </CardTitle>
            <CardDescription className="text-xs">Últimos documentos accedidos o generados</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {recentDocItems.map(rd => (
                <button
                  key={rd.id}
                  onClick={rd.onDownload}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:border-emerald-200 dark:hover:border-emerald-700 transition-all text-left group"
                >
                  <div className={`h-8 w-8 rounded-md ${rd.iconBg} flex items-center justify-center shrink-0`}>
                    <span className={rd.iconColor}>{rd.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">{rd.title}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(rd.date)}</p>
                  </div>
                  <Download className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-500 shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── HTML Document Generators ─── */
function generateConstanciaEmpleoHTML(emp: EmpleadoDetail, formatDate: (d: string | null) => string, formatSalary: (n: number) => string): string {
  const nombre = `${emp.primer_nombre}${emp.segundo_nombre ? ' ' + emp.segundo_nombre : ''} ${emp.primer_apellido}${emp.segundo_apellido ? ' ' + emp.segundo_apellido : ''}`;
  const activeContract = emp.contratos.find(c => c.activo);
  return `
    <div class="header">
      <h1>CONSTANCIA DE EMPLEO</h1>
      <p><strong>Empresa S.A. de C.V.</strong></p>
    </div>
    <p>Por medio de la presente, quien suscribe certifica que:</p>
    <table>
      <tr><th>Nombre</th><td>${nombre}</td></tr>
      <tr><th>DUI</th><td>${emp.dui}</td></tr>
      <tr><th>Código Empleado</th><td>${emp.codigo_empleado}</td></tr>
      <tr><th>Puesto</th><td>${emp.perfil_puesto?.nombre_puesto || 'N/A'}</td></tr>
      <tr><th>Departamento</th><td>${emp.area?.nombre || 'N/A'}</td></tr>
      <tr><th>Fecha de Ingreso</th><td>${formatDate(emp.fecha_ingreso)}</td></tr>
      <tr><th>Tipo de Contrato</th><td>${activeContract?.tipo_contrato?.replace(/_/g, ' ') || 'N/A'}</td></tr>
      <tr><th>Salario Base</th><td>${formatSalary(emp.salario_base)}</td></tr>
      <tr><th>Estado</th><td>${emp.estado}</td></tr>
    </table>
    <p>La presente se extiende a solicitud del interesado en la ciudad de San Salvador, El Salvador, a los ${new Date().toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
    <div class="signature">
      <div class="sig-line">Firma y Sello<br/>Recursos Humanos</div>
    </div>
  `;
}

function generateConstanciaSalarioHTML(emp: EmpleadoDetail, formatDate: (d: string | null) => string, formatSalary: (n: number) => string): string {
  const nombre = `${emp.primer_nombre}${emp.segundo_nombre ? ' ' + emp.segundo_nombre : ''} ${emp.primer_apellido}${emp.segundo_apellido ? ' ' + emp.segundo_apellido : ''}`;
  const activeContract = emp.contratos.find(c => c.activo);
  const salario = emp.salario_base;
  const isss = salario * 0.03;
  const afp = salario * 0.0725;
  const rentaBase = salario - isss - afp;
  return `
    <div class="header">
      <h1>CONSTANCIA DE SALARIO</h1>
      <p><strong>Empresa S.A. de C.V.</strong></p>
    </div>
    <p>Por medio de la presente, certificamos los ingresos del empleado:</p>
    <table>
      <tr><th>Nombre</th><td>${nombre}</td></tr>
      <tr><th>DUI</th><td>${emp.dui}</td></tr>
      <tr><th>Código Empleado</th><td>${emp.codigo_empleado}</td></tr>
      <tr><th>Puesto</th><td>${emp.perfil_puesto?.nombre_puesto || 'N/A'}</td></tr>
      <tr><th>Departamento</th><td>${emp.area?.nombre || 'N/A'}</td></tr>
      <tr><th>Fecha de Ingreso</th><td>${formatDate(emp.fecha_ingreso)}</td></tr>
    </table>
    <h3>Detalle Salarial Mensual</h3>
    <table>
      <tr><th>Salario Base</th><td>${formatSalary(salario)}</td></tr>
      <tr><th>ISSS Laboral (3%)</th><td>-${formatSalary(isss)}</td></tr>
      <tr><th>AFP Laboral (7.25%)</th><td>-${formatSalary(afp)}</td></tr>
      <tr><th>Renta Imponible</th><td>${formatSalary(rentaBase)}</td></tr>
      <tr><th>Tipo Contrato</th><td>${activeContract?.tipo_contrato?.replace(/_/g, ' ') || 'N/A'}</td></tr>
    </table>
    <p>La presente se extiende a solicitud del interesado en la ciudad de San Salvador, El Salvador, a los ${new Date().toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
    <div class="signature">
      <div class="sig-line">Firma y Sello<br/>Recursos Humanos</div>
    </div>
  `;
}

function generateCartaReferenciaHTML(emp: EmpleadoDetail, formatDate: (d: string | null) => string, formatSalary: (n: number) => string): string {
  const nombre = `${emp.primer_nombre}${emp.segundo_nombre ? ' ' + emp.segundo_nombre : ''} ${emp.primer_apellido}${emp.segundo_apellido ? ' ' + emp.segundo_apellido : ''}`;
  return `
    <div class="header">
      <h1>CARTA DE REFERENCIA LABORAL</h1>
      <p><strong>Empresa S.A. de C.V.</strong></p>
    </div>
    <p>A quien corresponda:</p>
    <p>Por medio de la presente, hacemos constar que <strong>${nombre}</strong>, portador(a) del Documento Único de Identidad número <strong>${emp.dui}</strong>, ha laborado en nuestra institución desde el ${formatDate(emp.fecha_ingreso)} hasta la fecha, desempeñando el cargo de <strong>${emp.perfil_puesto?.nombre_puesto || 'N/A'}</strong> en el departamento de <strong>${emp.area?.nombre || 'N/A'}</strong>.</p>
    <p>Durante su permanencia en nuestra empresa, el(la) mencionado(a) funcionario(a) ha demostrado responsabilidad, honradez y eficiencia en el cumplimiento de sus labores, razón por la cual nos permitimos dar la más amplia referencia sobre su persona.</p>
    <p>Y para los usos que estime convenientes, se extiende la presente en la ciudad de San Salvador, El Salvador, a los ${new Date().toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
    <div class="signature">
      <div class="sig-line">Firma y Sello<br/>Recursos Humanos</div>
    </div>
  `;
}

/* ─── Document Generator Component (inside dialog) ─── */
function DocumentGenerator({
  docGenType,
  setDocGenType,
  empleado,
  planillas,
  selectedPlanilla,
  setSelectedPlanilla,
  aguinaldoAnio,
  setAguinaldoAnio,
  accessToken,
  formatDate,
  formatSalary,
  getNombreCompleto,
  addToRecentDocs,
  docGenGenerating,
  setDocGenGenerating,
  onClose,
  toast,
}: {
  docGenType: string;
  setDocGenType: (v: string) => void;
  empleado: EmpleadoDetail;
  planillas: Array<{ id: string; codigo_planilla: string; tipo: string; estado: string; fecha_inicio_periodo: string; fecha_fin_periodo: string }>;
  selectedPlanilla: string;
  setSelectedPlanilla: (v: string) => void;
  aguinaldoAnio: string;
  setAguinaldoAnio: (v: string) => void;
  accessToken: string | null;
  formatDate: (d: string | null) => string;
  formatSalary: (n: number) => string;
  getNombreCompleto: () => string;
  addToRecentDocs: (doc: { id: string; title: string; type: string; date: string; category: string }) => void;
  docGenGenerating: boolean;
  setDocGenGenerating: (v: boolean) => void;
  onClose: () => void;
  toast: (opts: { title: string; description?: string; variant?: string }) => void;
}) {
  const nombre = getNombreCompleto();
  const activeContract = empleado.contratos.find(c => c.activo);

  const handleGenerate = async () => {
    setDocGenGenerating(true);
    try {
      if (docGenType === 'boleta_pago') {
        if (!selectedPlanilla) {
          toast({ title: 'Error', description: 'Seleccione una planilla', variant: 'destructive' });
          setDocGenGenerating(false);
          return;
        }
        const p = planillas.find(pl => pl.id === selectedPlanilla);
        const res = await fetch(`/api/nomina/planillas/${selectedPlanilla}/boleta?empleado_id=${empleado.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({ title: 'Error', description: (data as { error?: string }).error || 'Error al generar boleta', variant: 'destructive' });
          setDocGenGenerating(false);
          return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boleta-${empleado.codigo_empleado}-${p?.codigo_planilla || 'planilla'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        addToRecentDocs({
          id: `boleta-${selectedPlanilla}`,
          title: `Boleta ${p?.codigo_planilla || ''}`,
          type: 'Boleta de Pago',
          date: new Date().toISOString(),
          category: 'boletas',
        });
      } else if (docGenType === 'constancia_aguinaldo') {
        const res = await fetch(`/api/nomina/aguinaldo/pdf?empleado_id=${empleado.id}&anio=${aguinaldoAnio}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({ title: 'Error', description: (data as { error?: string }).error || 'Error al generar constancia', variant: 'destructive' });
          setDocGenGenerating(false);
          return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aguinaldo-${empleado.codigo_empleado}-${aguinaldoAnio}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        addToRecentDocs({
          id: `aguinaldo-${aguinaldoAnio}`,
          title: `Constancia Aguinaldo ${aguinaldoAnio}`,
          type: 'Constancia de Aguinaldo',
          date: new Date().toISOString(),
          category: 'constancias',
        });
      } else {
        // Text-based documents
        let content = '';
        let filename = '';
        let title = '';
        let category = 'constancias';

        if (docGenType === 'constancia_empleo') {
          content = generateConstanciaEmpleoHTML(empleado, formatDate, formatSalary);
          filename = `constancia-empleo-${empleado.codigo_empleado}.txt`;
          title = 'Constancia de Empleo';
        } else if (docGenType === 'constancia_salario') {
          content = generateConstanciaSalarioHTML(empleado, formatDate, formatSalary);
          filename = `constancia-salario-${empleado.codigo_empleado}.txt`;
          title = 'Constancia de Salario';
        } else if (docGenType === 'carta_referencia') {
          content = generateCartaReferenciaHTML(empleado, formatDate, formatSalary);
          filename = `carta-referencia-${empleado.codigo_empleado}.txt`;
          title = 'Carta de Referencia';
          category = 'cartas';
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        addToRecentDocs({
          id: docGenType,
          title,
          type: title,
          date: new Date().toISOString(),
          category,
        });
      }

      toast({ title: 'Documento generado', description: 'El documento ha sido generado y descargado exitosamente' });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Error al generar el documento', variant: 'destructive' });
    } finally {
      setDocGenGenerating(false);
    }
  };

  const renderPreview = () => {
    if (docGenType === 'constancia_empleo') {
      return (
        <div className="space-y-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 text-center mb-3">CONSTANCIA DE EMPLEO</h4>
            <Separator className="mb-3" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Nombre:</span><span className="font-medium text-slate-900 dark:text-slate-100">{nombre}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">DUI:</span><span className="font-medium text-slate-900 dark:text-slate-100">{empleado.dui}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Puesto:</span><span className="font-medium text-slate-900 dark:text-slate-100">{empleado.perfil_puesto?.nombre_puesto || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Departamento:</span><span className="font-medium text-slate-900 dark:text-slate-100">{empleado.area?.nombre || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Fecha Ingreso:</span><span className="font-medium text-slate-900 dark:text-slate-100">{formatDate(empleado.fecha_ingreso)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tipo Contrato:</span><span className="font-medium text-slate-900 dark:text-slate-100">{activeContract?.tipo_contrato?.replace(/_/g, ' ') || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Estado:</span><Badge className={getDocStatusColor(empleado.estado === 'ACTIVO' ? 'Vigente' : 'Expirado')}>{empleado.estado}</Badge></div>
            </div>
          </div>
        </div>
      );
    }

    if (docGenType === 'constancia_salario') {
      const salario = empleado.salario_base;
      const isss = salario * 0.03;
      const afp = salario * 0.0725;
      return (
        <div className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300 text-center mb-3">CONSTANCIA DE SALARIO</h4>
            <Separator className="mb-3" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Nombre:</span><span className="font-medium text-slate-900 dark:text-slate-100">{nombre}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Puesto:</span><span className="font-medium text-slate-900 dark:text-slate-100">{empleado.perfil_puesto?.nombre_puesto || 'N/A'}</span></div>
              <Separator className="my-2" />
              <div className="flex justify-between"><span className="text-slate-500">Salario Base:</span><span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatSalary(salario)}</span></div>
              <div className="flex justify-between text-red-600 dark:text-red-400"><span>ISSS Laboral (3%):</span><span>-{formatSalary(isss)}</span></div>
              <div className="flex justify-between text-red-600 dark:text-red-400"><span>AFP Laboral (7.25%):</span><span>-{formatSalary(afp)}</span></div>
            </div>
          </div>
        </div>
      );
    }

    if (docGenType === 'carta_referencia') {
      return (
        <div className="space-y-3">
          <div className="bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-sky-700 dark:text-sky-300 text-center mb-3">CARTA DE REFERENCIA LABORAL</h4>
            <Separator className="mb-3" />
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Por medio de la presente, hacemos constar que <strong>{nombre}</strong>, portador(a) del DUI <strong>{empleado.dui}</strong>,
              ha laborado en nuestra institución desde el {formatDate(empleado.fecha_ingreso)} hasta la fecha,
              desempeñando el cargo de <strong>{empleado.perfil_puesto?.nombre_puesto || 'N/A'}</strong> en el
              departamento de <strong>{empleado.area?.nombre || 'N/A'}</strong>.
            </p>
          </div>
        </div>
      );
    }

    if (docGenType === 'constancia_aguinaldo') {
      return (
        <div className="space-y-3">
          <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300 text-center mb-3">CONSTANCIA DE AGUINALDO</h4>
            <Separator className="mb-3" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Empleado:</span><span className="font-medium text-slate-900 dark:text-slate-100">{nombre}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Año:</span><span className="font-medium text-slate-900 dark:text-slate-100">{aguinaldoAnio}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Salario Base:</span><span className="font-medium text-slate-900 dark:text-slate-100">{formatSalary(empleado.salario_base)}</span></div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Se generará un PDF con el cálculo completo de aguinaldo.</p>
          </div>
          <div>
            <Label className="text-xs">Año del Aguinaldo</Label>
            <Select value={aguinaldoAnio} onValueChange={setAguinaldoAnio}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (docGenType === 'boleta_pago') {
      return (
        <div className="space-y-3">
          <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-rose-700 dark:text-rose-300 text-center mb-3">BOLETA DE PAGO</h4>
            <Separator className="mb-3" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Empleado:</span><span className="font-medium text-slate-900 dark:text-slate-100">{nombre}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Código:</span><span className="font-medium text-slate-900 dark:text-slate-100">{empleado.codigo_empleado}</span></div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Se generará un PDF con el detalle completo de la boleta.</p>
          </div>
          <div>
            <Label className="text-xs">Seleccionar Planilla</Label>
            <Select value={selectedPlanilla} onValueChange={setSelectedPlanilla}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar planilla..." /></SelectTrigger>
              <SelectContent>
                {planillas.length === 0 ? (
                  <SelectItem value="_none" disabled>No hay planillas disponibles</SelectItem>
                ) : (
                  planillas.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo_planilla} — {formatDate(p.fecha_inicio_periodo)} a {formatDate(p.fecha_fin_periodo)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setDocGenType('')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
      >
        <ChevronDown className="h-4 w-4 rotate-90" /> Cambiar tipo de documento
      </button>

      {renderPreview()}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleGenerate}
          disabled={docGenGenerating}
        >
          {docGenGenerating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          Generar y Descargar
        </Button>
      </div>
    </div>
  );
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

  // Document management state
  const [docCategory, setDocCategory] = useState<string>('todos');
  const [docSearch, setDocSearch] = useState('');
  const [docGenOpen, setDocGenOpen] = useState(false);
  const [docGenType, setDocGenType] = useState<string>('');
  const [docGenGenerating, setDocGenGenerating] = useState(false);
  const [recentDocs, setRecentDocs] = useState<Array<{ id: string; title: string; type: string; date: string; category: string }>>([]);
  const [planillas, setPlanillas] = useState<Array<{ id: string; codigo_planilla: string; tipo: string; estado: string; fecha_inicio_periodo: string; fecha_fin_periodo: string }>>([]);
  const [selectedPlanilla, setSelectedPlanilla] = useState<string>('');
  const [aguinaldoAnio, setAguinaldoAnio] = useState<string>(new Date().getFullYear().toString());

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

  // Fetch planillas for boleta generation
  useEffect(() => {
    const fetchPlanillas = async () => {
      try {
        const res = await fetch('/api/nomina/planillas?limit=50&estado=CERRADA', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (res.ok && data.data) {
          setPlanillas(data.data.map((p: { id: string; codigo_planilla: string; tipo: string; estado: string; fecha_inicio_periodo: string; fecha_fin_periodo: string }) => ({
            id: p.id,
            codigo_planilla: p.codigo_planilla,
            tipo: p.tipo,
            estado: p.estado,
            fecha_inicio_periodo: p.fecha_inicio_periodo,
            fecha_fin_periodo: p.fecha_fin_periodo,
          })));
        }
      } catch {
        // silently ignore
      }
    };
    if (accessToken) fetchPlanillas();
  }, [accessToken]);

  // Load recent docs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`recentDocs_${empleadoId}`);
      if (stored) setRecentDocs(JSON.parse(stored));
    } catch {
      // silently ignore
    }
  }, [empleadoId]);

  const addToRecentDocs = useCallback((doc: { id: string; title: string; type: string; date: string; category: string }) => {
    setRecentDocs(prev => {
      const filtered = prev.filter(d => d.id !== doc.id);
      const updated = [doc, ...filtered].slice(0, 5);
      try { localStorage.setItem(`recentDocs_${empleadoId}`, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, [empleadoId]);

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

  // Seniority calculation
  const getSeniority = () => {
    if (!empleado.fecha_ingreso) return { years: 0, months: 0, days: 0, text: 'N/A' };
    const start = new Date(empleado.fecha_ingreso);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();
    if (days < 0) { months--; days += 30; }
    if (months < 0) { years--; months += 12; }
    const text = years > 0 ? `${years} año${years > 1 ? 's' : ''} ${months} mes${months !== 1 ? 'es' : ''}` : `${months} mes${months !== 1 ? 'es' : ''} ${days} día${days !== 1 ? 's' : ''}`;
    return { years, months, days, text };
  };
  const seniority = getSeniority();

  // Age calculation
  const getAge = () => {
    if (!empleado.fecha_nacimiento) return null;
    const birth = new Date(empleado.fecha_nacimiento);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };
  const age = getAge();

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════
          BREADCRUMB NAVIGATION
         ═══════════════════════════════════════════ */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Directorio
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-800 dark:text-slate-200 font-medium truncate">{getNombreCompleto()}</span>
      </div>

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

          {/* Quick info row - 6 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-2">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Hash className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Código</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">{empleado.codigo_empleado}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <CreditCard className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">DUI</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">{empleado.dui}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Salario</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{formatSalary(empleado.salario_base)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-8 w-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                <CalendarDays className="h-3.5 w-3.5 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Antigüedad</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{seniority.text}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                <Shield className="h-3.5 w-3.5 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">ISSS</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">{empleado.numero_isss || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                <Heart className="h-3.5 w-3.5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">AFP</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">{empleado.numero_afp || '—'}</p>
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
                  <InfoField label="Fecha Nacimiento" value={`${formatDate(empleado.fecha_nacimiento)}${age ? ` (${age} años)` : ''}`} icon={<CalendarDays className="h-3.5 w-3.5" />} />
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

            {/* Request vacation button for EMPLEADO + Legal reference */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Art. 177 CT — 15 días después de 1 año de servicio</span>
              </div>
              {userRole === 'EMPLEADO' && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Palmtree className="h-4 w-4 mr-2" /> Solicitar Vacaciones
                </Button>
              )}
            </div>

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
          <div className="space-y-4">
            {/* Summary by type */}
            {empleado.incidencias.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {(() => {
                  const byType: Record<string, { count: number; total: number }> = {};
                  empleado.incidencias.forEach(inc => {
                    if (!byType[inc.tipo]) byType[inc.tipo] = { count: 0, total: 0 };
                    byType[inc.tipo].count++;
                    if (inc.monto) byType[inc.tipo].total += inc.monto;
                  });
                  const tipoIcons: Record<string, React.ReactNode> = {
                    HORAS_EXTRA: <Clock className="h-4 w-4" />,
                    BONO: <DollarSign className="h-4 w-4" />,
                    COMISION: <TrendingUp className="h-4 w-4" />,
                    INCAPACIDAD_ISSS: <Heart className="h-4 w-4" />,
                    PERMISO: <CalendarDays className="h-4 w-4" />,
                    DESCUENTO_ESPECIAL: <AlertTriangle className="h-4 w-4" />,
                  };
                  const tipoColors: Record<string, string> = {
                    HORAS_EXTRA: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                    BONO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                    COMISION: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
                    INCAPACIDAD_ISSS: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                    PERMISO: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
                    DESCUENTO_ESPECIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                  };
                  return Object.entries(byType).map(([tipo, data]) => (
                    <div key={tipo} className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={tipoColors[tipo] || 'bg-slate-100 text-slate-600 p-1 rounded'}>
                          {tipoIcons[tipo] || <AlertTriangle className="h-4 w-4" />}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{tipo.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{data.count}</p>
                      {data.total > 0 && <p className="text-xs text-emerald-600 font-medium">{formatSalary(data.total)}</p>}
                    </div>
                  ));
                })()}
              </div>
            )}
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
                        HORAS_EXTRA: 'bg-orange-100 text-orange-700 border-orange-200',
                        BONO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                        COMISION: 'bg-teal-100 text-teal-700 border-teal-200',
                        INCAPACIDAD_ISSS: 'bg-red-100 text-red-700 border-red-200',
                      };
                      const estadoColors: Record<string, string> = {
                        PENDIENTE: 'bg-yellow-100 text-yellow-700',
                        APROBADA: 'bg-emerald-100 text-emerald-700',
                        RECHAZADA: 'bg-red-100 text-red-700',
                      };
                      const borderColors: Record<string, string> = {
                        HORAS_EXTRA: 'border-l-orange-400',
                        BONO: 'border-l-emerald-400',
                        COMISION: 'border-l-teal-400',
                        INCAPACIDAD_ISSS: 'border-l-red-400',
                        PERMISO: 'border-l-sky-400',
                      };
                      return (
                        <div key={inc.id} className={`p-3 rounded-lg border border-slate-100 dark:border-slate-700 border-l-4 ${borderColors[inc.tipo] || 'border-l-slate-300'} bg-slate-50/50 dark:bg-slate-800/30`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={tipoColors[inc.tipo] || 'bg-slate-100 text-slate-600'}>
                                {inc.tipo.replace(/_/g, ' ')}
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
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB: DOCUMENTOS — Enhanced Document Management
           ═══════════════════════════════════════════ */}
        <TabsContent value="documentos">
          <div className="space-y-4">
            {/* Header with Generate Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-emerald-600" />
                  Gestión de Documentos
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Documentos, constancias y certificaciones del empleado</p>
              </div>
              {(canEdit || canEditOwn) && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  onClick={() => { setDocGenType(''); setDocGenOpen(true); }}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" /> Generar Documento
                </Button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { key: 'todos', label: 'Todos', icon: <FolderOpen className="h-3.5 w-3.5" /> },
                { key: 'contratos', label: 'Contratos', icon: <FileText className="h-3.5 w-3.5" /> },
                { key: 'constancias', label: 'Constancias', icon: <Stamp className="h-3.5 w-3.5" /> },
                { key: 'boletas', label: 'Boletas de Pago', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
                { key: 'cartas', label: 'Cartas', icon: <LetterText className="h-3.5 w-3.5" /> },
                { key: 'otros', label: 'Otros', icon: <FileCheck className="h-3.5 w-3.5" /> },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setDocCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    docCategory === cat.key
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar documentos..."
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Document Grid */}
            <DocumentGrid
              empleado={empleado}
              docCategory={docCategory}
              docSearch={docSearch}
              planillas={planillas}
              selectedPlanilla={selectedPlanilla}
              setSelectedPlanilla={setSelectedPlanilla}
              aguinaldoAnio={aguinaldoAnio}
              accessToken={accessToken}
              formatDate={formatDate}
              formatSalary={formatSalary}
              addToRecentDocs={addToRecentDocs}
              getNombreCompleto={getNombreCompleto}
              toast={toast}
              recentDocs={recentDocs}
            />
          </div>
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

      {/* ═══════════════════════════════════════════
          DOCUMENT GENERATION DIALOG
         ═══════════════════════════════════════════ */}
      <Dialog open={docGenOpen} onOpenChange={setDocGenOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Generar Documento
            </DialogTitle>
            <DialogDescription>Seleccione el tipo de documento a generar para {getNombreCompleto()}</DialogDescription>
          </DialogHeader>

          {!docGenType ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">Seleccione el tipo de documento:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'constancia_empleo', label: 'Constancia de Empleo', icon: <Stamp className="h-5 w-5" />, desc: 'Certifica que la persona labora en la empresa', color: 'emerald' },
                  { value: 'constancia_salario', label: 'Constancia de Salario', icon: <DollarSign className="h-5 w-5" />, desc: 'Certifica el salario actual del empleado', color: 'amber' },
                  { value: 'carta_referencia', label: 'Carta de Referencia', icon: <LetterText className="h-5 w-5" />, desc: 'Carta de referencia laboral', color: 'sky' },
                  { value: 'constancia_aguinaldo', label: 'Constancia de Aguinaldo', icon: <Palmtree className="h-5 w-5" />, desc: 'Constancia de cálculo de aguinaldo', color: 'purple' },
                  { value: 'boleta_pago', label: 'Boleta de Pago', icon: <FileSpreadsheet className="h-5 w-5" />, desc: 'Boleta de pago de planilla', color: 'rose' },
                ].map(docType => {
                  const colorMap: Record<string, string> = {
                    emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
                    sky: 'border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/10 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20',
                    purple: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20',
                    rose: 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20',
                  };
                  const iconColorMap: Record<string, string> = {
                    emerald: 'text-emerald-600 dark:text-emerald-400',
                    amber: 'text-amber-600 dark:text-amber-400',
                    sky: 'text-sky-600 dark:text-sky-400',
                    purple: 'text-purple-600 dark:text-purple-400',
                    rose: 'text-rose-600 dark:text-rose-400',
                  };
                  return (
                    <button
                      key={docType.value}
                      onClick={() => setDocGenType(docType.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${colorMap[docType.color] || colorMap.emerald}`}
                    >
                      <div className={`${iconColorMap[docType.color] || iconColorMap.emerald} mb-2`}>{docType.icon}</div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{docType.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{docType.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <DocumentGenerator
              docGenType={docGenType}
              setDocGenType={setDocGenType}
              empleado={empleado}
              planillas={planillas}
              selectedPlanilla={selectedPlanilla}
              setSelectedPlanilla={setSelectedPlanilla}
              aguinaldoAnio={aguinaldoAnio}
              setAguinaldoAnio={setAguinaldoAnio}
              accessToken={accessToken}
              formatDate={formatDate}
              formatSalary={formatSalary}
              getNombreCompleto={getNombreCompleto}
              addToRecentDocs={addToRecentDocs}
              docGenGenerating={docGenGenerating}
              setDocGenGenerating={setDocGenGenerating}
              onClose={() => { setDocGenType(''); setDocGenOpen(false); }}
              toast={toast}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
