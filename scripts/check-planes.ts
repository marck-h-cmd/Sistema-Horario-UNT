import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const planes = await prisma.planEstudio.findMany();
  console.log('PLANES:', planes);
}
main().catch(console.error).finally(() => prisma.$disconnect());
