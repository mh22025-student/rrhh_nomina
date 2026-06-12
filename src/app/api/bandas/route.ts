import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRoles } from '@/lib/auth-middleware';

// GET /api/bandas - List all bandas
export async function GET(request: NextRequest) {
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const bandas = await db.bandaSalarial.findMany({
      where: { activo: true },
      include: {
        _count: { select: { perfiles_puesto: true } },
      },
      orderBy: { grado: 'asc' },
    });

    // Get employee count per band through profiles
    const bandasWithEmployees = await Promise.all(
      bandas.map(async (banda) => {
        const employeeCount = await db.empleado.count({
          where: {
            perfil_puesto: { banda_salarial_id: banda.id },
            estado: 'ACTIVO',
          },
        });
        return { ...banda, num_empleados: employeeCount };
      })
    );

    return NextResponse.json(bandasWithEmployees);
  } catch (error) {
    console.error('Error fetching bandas:', error);
    return NextResponse.json({ error: 'Error al obtener bandas salariales' }, { status: 500 });
  }
}

// PUT /api/bandas - Update banda (ADMIN, APROBADOR only)
export async function PUT(request: NextRequest) {
  const roleCheck = requireRoles('ADMIN', 'APROBADOR')(request);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  try {
    const body = await request.json();
    const { id, salario_minimo, salario_medio, salario_maximo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de banda requerido' }, { status: 400 });
    }

    const existing = await db.bandaSalarial.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Banda salarial no encontrada' }, { status: 404 });
    }

    // Validate: min cannot be less than minimum wage
    const minWage = await db.salarioMinimoSector.findFirst({
      where: { sector: 'COMERCIO' },
      orderBy: { salario_mensual: 'asc' },
    });

    if (minWage && salario_minimo < minWage.salario_mensual) {
      return NextResponse.json(
        { error: `El salario mínimo no puede ser menor al salario mínimo legal ($${minWage.salario_mensual})` },
        { status: 400 }
      );
    }

    if (salario_minimo > salario_medio || salario_medio > salario_maximo) {
      return NextResponse.json(
        { error: 'Los valores deben cumplir: mínimo ≤ medio ≤ máximo' },
        { status: 400 }
      );
    }

    const updated = await db.bandaSalarial.update({
      where: { id },
      data: { salario_minimo, salario_medio, salario_maximo },
    });

    // Audit log
    await db.bitacoraAuditoria.create({
      data: {
        usuario_id: roleCheck.user.userId,
        usuario_email: roleCheck.user.email,
        accion: 'ACTUALIZAR',
        tabla_afectada: 'bandas_salariales',
        registro_id: id,
        valor_anterior: JSON.stringify(existing),
        valor_nuevo: JSON.stringify(updated),
        nivel_criticidad: 'ALTO',
        detalle_adicional: `Banda salarial actualizada: Grado ${existing.grado} - ${existing.nombre}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating banda:', error);
    return NextResponse.json({ error: 'Error al actualizar banda salarial' }, { status: 500 });
  }
}
