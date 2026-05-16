import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const locataires = await prisma.user.findMany({
    where: { role: 'LOCATAIRE' },
    select: {
      id: true,
      email: true,
      isAvailable: true,
      tenant: { select: { housingId: true, firstName: true } },
    },
    take: 10,
  });
  const bailleurs = await prisma.landlordProfile.findMany({
    select: { id: true, user: { select: { email: true } } },
    take: 5,
  });
  console.log('LOCATAIRES:', JSON.stringify(locataires, null, 2));
  console.log('BAILLEURS:', JSON.stringify(bailleurs, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
