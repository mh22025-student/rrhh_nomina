import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRoles } from '@/lib/auth-middleware';

// ============================================================
// POST /api/nomina/planillas/[id]/dispersion
// Generate bank dispersion file
// ============================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = requireRoles('ADMIN', 'APROBADOR')(request);
  if ('error' in authCheck) return authCheck.error;

  try {
    const { id } = await params;

    const planilla = await db.planilla.findUnique({
      where: { id },
      include: {
        detalles_planilla: {
          include: {
            empleado: {
              select: {
                id: true,
                codigo_empleado: true,
                primer_nombre: true,
                primer_apellido: true,
                dui: true,
              },
            },
          },
        },
      },
    });

    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 });
    }

    if (planilla.estado !== 'APROBADA') {
      return NextResponse.json(
        { error: 'Solo se puede generar dispersión para planillas aprobadas' },
        { status: 400 }
      );
    }

    // Get active banks
    const bancos = await db.banco.findMany({ where: { activo: true } });

    // For demo purposes, assign employees to banks randomly based on DUI hash
    // In production, this would come from employee bank account info
    const bankAssignments = new Map<string, Array<{
      empleado_id: string;
      codigo_empleado: string;
      nombre: string;
      dui: string;
      monto: number;
    }>>();

    for (const det of planilla.detalles_planilla) {
      // Simple hash to assign bank (in production: use empleado's bank account)
      const bankIndex = det.empleado.dui.length % bancos.length;
      const banco = bancos[bankIndex] || bancos[0];
      if (!banco) continue;

      const list = bankAssignments.get(banco.id) || [];
      list.push({
        empleado_id: det.empleado_id,
        codigo_empleado: det.empleado.codigo_empleado,
        nombre: `${det.empleado.primer_nombre} ${det.empleado.primer_apellido}`,
        dui: det.empleado.dui,
        monto: det.salario_neto,
      });
      bankAssignments.set(banco.id, list);
    }

    // Generate dispersion files and create RetornoBancario records
    const dispersiones = [];
    for (const [bancoId, empleados] of bankAssignments) {
      const banco = bancos.find(b => b.id === bancoId);
      if (!banco) continue;

      const totalMonto = empleados.reduce((sum, e) => sum + e.monto, 0);

      // Generate CSV content
      const csvLines: string[] = [];
      csvLines.push('CODIGO_EMPLEADO,NOMBRE,DUI,MONTO');
      for (const emp of empleados) {
        csvLines.push(`${emp.codigo_empleado},${emp.nombre},${emp.dui},${emp.monto.toFixed(2)}`);
      }
      const csvContent = csvLines.join('\n');

      // Create RetornoBancario record
      const retorno = await db.retornoBancario.create({
        data: {
          planilla_id: id,
          banco_id: bancoId,
          archivo_nombre: `dispersion_${banco.codigo}_${planilla.codigo_planilla}.csv`,
          fecha_envio: new Date(),
          estado: 'ENVIADO',
          total_registros: empleados.length,
          total_monto: Math.round(totalMonto * 100) / 100,
        },
      });

      dispersiones.push({
        banco_id: bancoId,
        banco_nombre: banco.nombre,
        banco_codigo: banco.codigo,
        total_empleados: empleados.length,
        total_monto: Math.round(totalMonto * 100) / 100,
        archivo_nombre: retorno.archivo_nombre,
        retorno_id: retorno.id,
        contenido_csv: csvContent,
      });
    }

    // Log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: authCheck.user.userId,
        usuario_email: authCheck.user.email,
        accion: 'GENERACION_DISPERSION',
        tabla_afectada: 'retornos_bancarios',
        registro_id: id,
        valor_nuevo: `${dispersiones.length} archivo(s) generado(s)`,
        resultado: 'EXITOSO',
        nivel_criticidad: 'ALTO',
        detalle_adicional: `Planilla ${planilla.codigo_planilla}`,
      },
    });

    return NextResponse.json({ dispersiones });
  } catch (error) {
    console.error('Error generating dispersion:', error);
    return NextResponse.json({ error: 'Error al generar dispersión bancaria' }, { status: 500 });
  }
}
