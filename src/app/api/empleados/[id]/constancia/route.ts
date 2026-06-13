import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';
import { generateConstanciaEmpleoPdf } from '@/lib/pdf-constancia-empleo';
import type { ConstanciaEmpleoData } from '@/lib/pdf-constancia-empleo';

// ============================================================
// GET /api/empleados/[id]/constancia?tipo=empleo|salario
// Generate a PDF employment certificate for an employee
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify auth
  const user = verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // RBAC: EMPLEADO can access own only
  const allowedRoles = ['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR'];
  if (!allowedRoles.includes(user.rol) && user.rol !== 'EMPLEADO') {
    return NextResponse.json({ error: 'No tiene permisos para realizar esta acción' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'empleo';

    // EMPLEADO can only access own constancia
    if (user.rol === 'EMPLEADO' && user.empleadoId && user.empleadoId !== id) {
      return NextResponse.json(
        { error: 'Solo puede generar su propia constancia' },
        { status: 403 }
      );
    }

    // 2. Fetch employee data
    const empleado = await db.empleado.findUnique({
      where: { id },
      include: {
        area: { select: { nombre: true } },
        perfil_puesto: { select: { nombre_puesto: true } },
        contratos: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
      },
    });

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // 3. Build PDF data
    const constanciaData: ConstanciaEmpleoData = {
      empleado: {
        codigo_empleado: empleado.codigo_empleado,
        primer_nombre: empleado.primer_nombre,
        segundo_nombre: empleado.segundo_nombre,
        primer_apellido: empleado.primer_apellido,
        segundo_apellido: empleado.segundo_apellido,
        dui: empleado.dui,
        fecha_ingreso: empleado.fecha_ingreso,
        salario_base: empleado.salario_base,
        estado: empleado.estado,
        area: empleado.area,
        perfil_puesto: empleado.perfil_puesto,
      },
      contrato: empleado.contratos[0] || null,
      tipo: tipo === 'salario' ? 'salario' : 'empleo',
      incluir_salario: tipo === 'salario',
    };

    // 4. Generate PDF
    const pdfBuffer = await generateConstanciaEmpleoPdf(constanciaData);

    // 5. Return as downloadable PDF
    const tipoLabel = tipo === 'salario' ? 'empleo-salario' : 'empleo';
    const filename = `constancia-${tipoLabel}-${empleado.codigo_empleado}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating employment certificate PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar la constancia de empleo' },
      { status: 500 }
    );
  }
}
