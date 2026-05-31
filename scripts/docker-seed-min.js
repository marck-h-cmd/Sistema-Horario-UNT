const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertUsuario(email, data) {
  const passwordHash = await bcrypt.hash('unt123456', 12);
  return prisma.usuario.upsert({
    where: { email },
    update: { password: passwordHash, activo: true, ...data },
    create: {
      email,
      password: passwordHash,
      verificado: true,
      activo: true,
      ...data,
    },
  });
}

async function main() {
  await upsertUsuario('admin@unitru.edu.pe', {
    nombre: 'Administrador',
    apellidos: 'Sistema',
    rol: 'ADMINISTRADOR',
  });

  await upsertUsuario('operador@unitru.edu.pe', {
    nombre: 'Operador',
    apellidos: 'Sistema',
    rol: 'OPERADOR',
  });

  await upsertUsuario('superadmin@unitru.edu.pe', {
    nombre: 'Super',
    apellidos: 'Admin',
    rol: 'SUPER_ADMIN',
  });

  await upsertUsuario('monitor@unitru.edu.pe', {
    nombre: 'Monitor',
    apellidos: 'Sistema',
    rol: 'MONITOR',
  });

  const docenteUser = await upsertUsuario('juan.perez@unitru.edu.pe', {
    nombre: 'Juan',
    apellidos: 'Pérez García',
    rol: 'DOCENTE',
  });

  const docenteExistente = await prisma.docente.findUnique({
    where: { usuarioId: docenteUser.id },
  });
  if (!docenteExistente) {
    await prisma.docente.create({
      data: {
        usuarioId: docenteUser.id,
        codigo: 'DOC001',
        categoria: 'PRINCIPAL',
        dedicacion: 'TIEMPO_COMPLETO_40H',
        departamento: 'Dpto. de Ing. Sistemas',
        telefono: '999123456',
        preferenciasNotificacion: {
          create: {
            correoActivo: true,
            whatsappActivo: false,
            telegramActivo: false,
          },
        },
      },
    });
  }

  let periodo = await prisma.periodoAcademico.findFirst({ where: { nombre: '2026-I' } });
  if (!periodo) {
    periodo = await prisma.periodoAcademico.create({
      data: {
        nombre: '2026-I',
        fechaInicio: new Date('2026-03-01'),
        fechaFin: new Date('2026-07-15'),
        estado: 'ACTIVO',
        activo: true,
      },
    });
  } else {
    periodo = await prisma.periodoAcademico.update({
      where: { id: periodo.id },
      data: { activo: true, estado: 'ACTIVO' },
    });
  }

  const ordenCategorias = ['PRINCIPAL', 'ASOCIADO', 'AUXILIAR', 'CONTRATADO', 'INVITADO'];
  const configExistente = await prisma.configuracionPeriodo.findUnique({
    where: { periodoId: periodo.id },
  });
  if (!configExistente) {
    await prisma.configuracionPeriodo.create({
      data: { periodoId: periodo.id, ordenCategorias },
    });
  }

  console.log(
    'Seed mínimo: superadmin, admin, operador, monitor, docente (juan.perez), período 2026-I'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
