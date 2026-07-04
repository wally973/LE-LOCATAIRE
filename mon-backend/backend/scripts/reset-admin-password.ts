/**
 * Met à jour le mot de passe du premier compte ADMIN avec SEED_ADMIN_PASSWORD (.env).
 * Usage : npx ts-node scripts/reset-admin-password.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const plain = process.env.SEED_ADMIN_PASSWORD;
  if (!plain?.trim()) {
    console.error('Définissez SEED_ADMIN_PASSWORD dans mon-backend/backend/.env');
    process.exitCode = 1;
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { id: 'asc' },
  });
  if (!admin) {
    console.error('Aucun compte ADMIN en base. Lancez : npx prisma db seed');
    process.exitCode = 1;
    return;
  }

  const password = await bcrypt.hash(plain, 10);
  await prisma.user.update({
    where: { id: admin.id },
    data: { password },
  });

  console.log('[reset] Mot de passe mis à jour pour :', admin.email ?? admin.phone);
  console.log('[reset] Connectez-vous avec cet email et SEED_ADMIN_PASSWORD du .env');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
