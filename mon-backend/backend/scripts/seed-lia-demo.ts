/**
 * Comptes de démo pour tester Lia (bailleur + locataire + logement).
 * Idempotent — relançable sans doublon.
 *
 * Locataire : demo.locataire@lelocataire.test / DemoLocataire1!
 * Bailleur  : demo.bailleur@lelocataire.test / DemoBailleur1!
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TENANT_EMAIL = 'demo.locataire@lelocataire.test';
const TENANT_PASSWORD = 'DemoLocataire1!';
const LANDLORD_EMAIL = 'demo.bailleur@lelocataire.test';
const LANDLORD_PASSWORD = 'DemoBailleur1!';

async function upsertUser(params: {
  email: string;
  phone: string;
  password: string;
  role: 'BAILLEUR' | 'LOCATAIRE';
}) {
  const hash = await bcrypt.hash(params.password, 10);
  const existing = await prisma.user.findFirst({
    where: { email: params.email },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hash,
        role: params.role,
        isAvailable: true,
        email: params.email,
      },
    });
  }
  return prisma.user.create({
    data: {
      email: params.email,
      phone: params.phone,
      password: hash,
      role: params.role,
      isAvailable: true,
    },
  });
}

async function main() {
  const bailleurUser = await upsertUser({
    email: LANDLORD_EMAIL,
    phone: '+594691000001',
    password: LANDLORD_PASSWORD,
    role: 'BAILLEUR',
  });

  let landlord = await prisma.landlordProfile.findUnique({
    where: { userId: bailleurUser.id },
  });
  if (!landlord) {
    landlord = await prisma.landlordProfile.create({
      data: {
        name: '2terHabitat Démo',
        userId: bailleurUser.id,
        featureFlags: { create: {} },
      },
    });
  }

  let housing = await prisma.housing.findFirst({
    where: { landlordId: landlord.id },
  });
  if (!housing) {
    housing = await prisma.housing.create({
      data: {
        address: '12 rue de la Démo',
        city: 'CAYENNE',
        postalCode: '97300',
        landlordId: landlord.id,
        isValidated: true,
      },
    });
  }

  const locataireUser = await upsertUser({
    email: TENANT_EMAIL,
    phone: '+594691000002',
    password: TENANT_PASSWORD,
    role: 'LOCATAIRE',
  });

  await prisma.tenantProfile.upsert({
    where: { userId: locataireUser.id },
    create: {
      userId: locataireUser.id,
      firstName: 'Marie',
      lastName: 'Démo',
      housingId: housing.id,
      isOfficialTenant: true,
    },
    update: {
      housingId: housing.id,
      firstName: 'Marie',
      lastName: 'Démo',
    },
  });

  console.log('[seed-lia-demo] Prêt pour les tests.');
  console.log('[seed-lia-demo] Locataire :', TENANT_EMAIL, '/', TENANT_PASSWORD);
  console.log('[seed-lia-demo] Bailleur  :', LANDLORD_EMAIL, '/', LANDLORD_PASSWORD);
  console.log('[seed-lia-demo] Logement id :', housing.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
