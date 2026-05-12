/**
 * Crée un compte administrateur initial si aucun ADMIN n’existe.
 * Utilisé après `prisma migrate` pour permettre POST /auth/register (réservé ADMIN).
 *
 * Variables optionnelles : SEED_ADMIN_EMAIL, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (admins > 0) {
    console.log('[seed] Un administrateur existe déjà — aucune action.');
    return;
  }

  const password = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe_Admin!',
    10,
  );

  await prisma.user.create({
    data: {
      email: process.env.SEED_ADMIN_EMAIL ?? 'ewaldgoodman@gmail.com',
      phone: process.env.SEED_ADMIN_PHONE ?? '0694261186',
      password,
      role: 'ADMIN',
    },
  });

  console.log('[seed] Compte administrateur initial créé.');
  console.log('[seed] Email admin :', process.env.SEED_ADMIN_EMAIL ?? 'superadmin@localhost.com');
  console.log('[seed] Mot de passe admin :', process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe_Admin!');
  console.log('[seed] Téléphone admin :', process.env.SEED_ADMIN_PHONE ?? '+33900000001');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
