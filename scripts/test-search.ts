import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nombre = 'Agreda';
  console.log('Testing with nombre:', nombre);

  const cleanName = nombre.replace(/(profesor|docente|ing\.?|ingeniero|dr\.?|doctor|magister|mg\.?)\s+/gi, '').trim();
  const searchTerms = cleanName.split(' ').filter(t => t.length > 2);
  
  console.log('cleanName:', cleanName);
  console.log('searchTerms:', searchTerms);

  const whereCondition = searchTerms.length > 0 ? {
    AND: searchTerms.map(term => ({
      usuario: {
        OR: [
          { nombre: { contains: term, mode: 'insensitive' as const } },
          { apellidos: { contains: term, mode: 'insensitive' as const } }
        ]
      }
    }))
  } : {
    usuario: {
      OR: [
        { nombre: { contains: cleanName, mode: 'insensitive' as const } },
        { apellidos: { contains: cleanName, mode: 'insensitive' as const } }
      ]
    }
  };

  console.log('Where condition:', JSON.stringify(whereCondition, null, 2));

  const docentes = await prisma.docente.findMany({
    where: whereCondition,
    include: {
      usuario: true,
      departamento: true,
    }
  });

  console.log('Result length:', docentes.length);
  if (docentes.length > 0) {
    console.log('First result:', docentes[0].usuario.nombre, docentes[0].usuario.apellidos);
  } else {
    console.log('Check all users to see if they exist...');
    const all = await prisma.docente.findMany({ include: { usuario: true }, take: 5 });
    console.log('Some existing docs:', all.map(d => `${d.usuario.nombre} ${d.usuario.apellidos}`));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
