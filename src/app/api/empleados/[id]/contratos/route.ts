import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';
import type { UserRole } from '@/lib/auth';

// GET /api/empleados/[id]/contratos - List contracts for employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  const contratos = await db.contrato.findMany({
    where: { empleado_id: id },
    include: {
      perfil_puesto: { select: { nombre_puesto: true, codigo: true } },
    },
    orderBy: { fecha_inicio: 'desc' },
  });

  return NextResponse.json({ data: contratos });
}

// POST /api/empleados/[id]/contratos - Create new contract
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = requireRoles('ADMIN', 'ANALISTA' as UserRole)(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }
  const { user } = roleCheck;
  const { id } = await params;

  try {
    const body = await request.json();

    // Validate required fields
    const required = ['tipo_contrato', 'salario_base_contrato', 'tipo_jornada', 'fecha_inicio'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json({ error: `El campo ${field} es requerido` }, { status: 400 });
      }
    }

    // Check employee exists
    const empleado = await db.empleado.findUnique({
      where: { id },
      include: { perfil_puesto: true },
    });
    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Validate salario_base_contrato >= salario mínimo
    const perfil = empleado.perfil_puesto || (body.perfil_puesto_id ? await db.perfilPuesto.findUnique({ where: { id: body.perfil_puesto_id }, include: { banda_salarial: true } }) : null);

    if (perfil) {
      const paramLegal = await db.parametroLegal.findFirst({
        where: { estado: 'ACTIVO' },
        orderBy: { fecha_vigencia_desde: 'desc' },
        include: { salarios_minimos: true },
      });
      if (paramLegal) {
        const salarioMinimo = paramLegal.salarios_minimos.find(
          s => s.sector === (perfil.sector_laboral || 'COMERCIO')
        );
        if (salarioMinimo && body.salario_base_contrato < salarioMinimo.salario_mensual) {
          return NextResponse.json({
            error: `El salario base del contrato ($${body.salario_base_contrato.toFixed(2)}) es menor al salario mínimo legal ($${salarioMinimo.salario_mensual.toFixed(2)})`,
          }, { status: 400 });
        }
      }
    }

    const result = await db.$transaction(async (tx) => {
      // If new contract is active, deactivate others
      if (body.activo !== false) {
        await tx.contrato.updateMany({
          where: { empleado_id: id, activo: true },
          data: { activo: false },
        });
      }

      const contrato = await tx.contrato.create({
        data: {
          empleado_id: id,
          perfil_puesto_id: body.perfil_puesto_id || empleado.perfil_puesto_id,
          tipo_contrato: body.tipo_contrato,
          salario_base_contrato: body.salario_base_contrato,
          tipo_jornada: body.tipo_jornada,
          fecha_inicio: new Date(body.fecha_inicio),
          fecha_fin: body.fecha_fin ? new Date(body.fecha_fin) : null,
          activo: body.activo !== false,
          observaciones: body.observaciones || null,
        },
      });

      // Sync salario_base on empleado if contract is active
      if (body.activo !== false) {
        await tx.empleado.update({
          where: { id },
          data: { salario_base: body.salario_base_contrato },
        });

        // Create salary history record if salary changed
        if (empleado.salario_base !== body.salario_base_contrato) {
          await tx.historialCambioSalarial.create({
            data: {
              empleado_id: id,
              salario_anterior: empleado.salario_base,
              salario_nuevo: body.salario_base_contrato,
              tipo_cambio: 'CONTRATO_NUEVO',
              motivo: body.observaciones || 'Nuevo contrato',
              autorizado_por_id: user.userId,
            },
          });
        }
      }

      // Log to bitacora
      await tx.bitacoraAuditoria.create({
        data: {
          usuario_id: user.userId,
          usuario_email: user.email,
          accion: 'CREAR_CONTRATO',
          tabla_afectada: 'contratos',
          registro_id: contrato.id,
          valor_nuevo: JSON.stringify({ tipo: body.tipo_contrato, salario: body.salario_base_contrato }),
          nivel_criticidad: 'NORMAL',
          detalle_adicional: `Nuevo contrato para empleado ${empleado.codigo_empleado}`,
        },
      });

      return contrato;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating contract:', error);
    return NextResponse.json({ error: 'Error al crear contrato' }, { status: 500 });
  }
}
