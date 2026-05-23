/**
 * Comptes de démo pour tester Lia (bailleur + locataire + logement).
 * Idempotent — relançable sans doublon.
 *
 * Locataire : demo.locataire@lelocataire.test / DemoLocataire1!
 * Bailleur  : demo.bailleur@lelocataire.test / DemoBailleur1!
 * Référent  : demo.referent@lelocataire.test / DemoReferent1!
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TENANT_EMAIL = 'demo.locataire@lelocataire.test';
const TENANT_PASSWORD = 'DemoLocataire1!';
const LANDLORD_EMAIL = 'demo.bailleur@lelocataire.test';
const LANDLORD_PASSWORD = 'DemoBailleur1!';
const AGENT_EMAIL = 'demo.referent@lelocataire.test';
const AGENT_PASSWORD = 'DemoReferent1!';

async function upsertUser(params: {
  email: string;
  phone: string;
  password: string;
  role: 'BAILLEUR' | 'LOCATAIRE' | 'AGENT';
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

  let agence = await prisma.agence.findFirst({
    where: { landlordProfileId: landlord.id, name: 'Secteur Cayenne Démo' },
  });
  if (!agence) {
    agence = await prisma.agence.create({
      data: {
        name: 'Secteur Cayenne Démo',
        landlordProfileId: landlord.id,
        address: 'Zone test référent',
        postalCode: '97300',
        city: 'CAYENNE',
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
        agenceId: agence.id,
        isValidated: true,
      },
    });
  } else if (housing.agenceId !== agence.id) {
    housing = await prisma.housing.update({
      where: { id: housing.id },
      data: { agenceId: agence.id },
    });
  }

  const locataireUser = await upsertUser({
    email: TENANT_EMAIL,
    phone: '+594691000002',
    password: TENANT_PASSWORD,
    role: 'LOCATAIRE',
  });

  const tenant = await prisma.tenantProfile.upsert({
    where: { userId: locataireUser.id },
    create: {
      userId: locataireUser.id,
      firstName: 'Marie',
      lastName: 'Démo',
      housingId: housing.id,
      isOfficialTenant: true,
      dossierNumber: 'DOS-000001',
    },
    update: {
      housingId: housing.id,
      firstName: 'Marie',
      lastName: 'Démo',
      dossierNumber: 'DOS-000001',
    },
  });

  const referentUser = await upsertUser({
    email: AGENT_EMAIL,
    phone: '+594691000003',
    password: AGENT_PASSWORD,
    role: 'AGENT',
  });

  await prisma.agentProfile.upsert({
    where: { userId: referentUser.id },
    create: {
      userId: referentUser.id,
      landlordProfileId: landlord.id,
      agenceId: agence.id,
    },
    update: {
      landlordProfileId: landlord.id,
      agenceId: agence.id,
    },
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const demoTickets = [
    {
      title: 'Fuite sous évier cuisine',
      description: 'Eau au sol sous l’évier.',
      aiCategory: 'PLUMBING',
      daysAgo: 5,
    },
    {
      title: 'Prise électrique qui chauffe',
      description: 'Odeur de brûlé dans le salon.',
      aiCategory: 'ELECTRICITY',
      daysAgo: 2,
    },
    {
      title: 'Porte intérieure difficile à fermer',
      description: 'Porte chambre frotte le sol.',
      aiCategory: 'CARPENTRY',
      daysAgo: 0,
    },
  ];

  for (const spec of demoTickets) {
    const existing = await prisma.ticket.findFirst({
      where: { tenantId: tenant.id, title: spec.title },
    });
    if (existing) continue;

    const createdAt = new Date(now - spec.daysAgo * day);
    const updatedAt = new Date(now - spec.daysAgo * day);

    const ticket = await prisma.ticket.create({
      data: {
        title: spec.title,
        description: spec.description,
        status: 'OPEN',
        tenantId: tenant.id,
        housingId: housing.id,
        landlordProfileId: landlord.id,
        responsibility: spec.aiCategory === 'PLUMBING' ? 'LOCATAIRE' : 'BAILLEUR',
        aiCategory: spec.aiCategory,
        aiSeverity: 'MEDIUM',
        aiConfidence: 0.85,
        createdAt,
        updatedAt,
      },
    });

    const year = createdAt.getFullYear();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        caseNumber: `AFF-${year}-${String(ticket.id).padStart(6, '0')}`,
      },
    });
  }

  console.log('[seed-lia-demo] Prêt pour les tests multi-appareils.');
  console.log('[seed-lia-demo] Locataire :', TENANT_EMAIL, '/', TENANT_PASSWORD);
  console.log('[seed-lia-demo] Bailleur  :', LANDLORD_EMAIL, '/', LANDLORD_PASSWORD);
  console.log('[seed-lia-demo] Référent  :', AGENT_EMAIL, '/', AGENT_PASSWORD);
  console.log('[seed-lia-demo] Agence    :', agence.name, '(id', agence.id + ')');
  console.log('[seed-lia-demo] Logement  :', housing.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
