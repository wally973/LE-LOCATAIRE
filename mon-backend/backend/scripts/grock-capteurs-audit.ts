/**
 * Audit offline — les capteurs Grock fonctionnent-ils sur chaque affaire ?
 * Mesure : perception, note_interne, états d'enquête vs conclusion, questions visibles.
 *
 * Usage : npx ts-node --transpile-only scripts/grock-capteurs-audit.ts [limite]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const CONCLUSIVE = new Set([
  'bailleur_responsable',
  'locataire_responsable',
  'sinistre',
  'READY_TICKET',
]);
const ENQUETE = new Set([
  'ASK_ONE_QUESTION',
  'NEED_PHOTO',
  'WAITING_TENANT',
  'ACTION_LOCATAIRE',
  'SAFETY',
]);

async function main() {
  const limit = Number(process.argv[2] ?? 100);
  const prisma = new PrismaClient();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      state: string | null;
      acknowledgment: string | null;
      noteInterne: string | null;
      perception: string | null;
      photoHash: string | null;
      tenantMessage: string | null;
      title: string | null;
    }>
  >`
    SELECT id, state, acknowledgment, "noteInterne", perception, "photoHash", "tenantMessage", title
    FROM grock_decision_journal
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;

  if (!rows.length) {
    console.log('Journal vide.');
    await prisma.$disconnect();
    return;
  }

  const stats = {
    total: rows.length,
    capteur_perception_ok: 0,
    capteur_photo_ok: 0,
    capteur_note_interne_ok: 0,
    capteur_parole_non_vide: 0,
    enquete_etat: 0,
    enquete_question_dans_parole: 0,
    conclusion_prematuree_suspecte: 0,
    conclusion_sans_preuve_visuelle: 0,
    technicien_sans_enquete_prealable: 0,
  };
  const states: Record<string, number> = {};

  for (const r of rows) {
    const st = r.state ?? '(null)';
    states[st] = (states[st] ?? 0) + 1;
    const ack = (r.acknowledgment ?? '').trim();
    const note = (r.noteInterne ?? '').trim();

    if (r.perception?.trim()) stats.capteur_perception_ok++;
    if (r.photoHash) stats.capteur_photo_ok++;
    if (note) stats.capteur_note_interne_ok++;
    if (ack.length >= 20) stats.capteur_parole_non_vide++;

    if (ENQUETE.has(st)) stats.enquete_etat++;
    if (ack.includes('?')) stats.enquete_question_dans_parole++;

    if (CONCLUSIVE.has(st)) {
      if (!r.photoHash && !r.perception?.trim()) {
        stats.conclusion_sans_preuve_visuelle++;
      }
      const origineFloue =
        /chauffe|solaire|fuite|infiltr|humid|toit|plafond|origine|voisin/i.test(
          `${r.title ?? ''} ${r.tenantMessage ?? ''} ${note}`,
        );
      const pasDeQuestion = !ack.includes('?');
      const technicienSeul =
        /technicien|plombier|transm/i.test(ack) &&
        !/ballon|toiture|collecteur|où|depuis|origine|photo/i.test(ack);

      if (pasDeQuestion && origineFloue && technicienSeul) {
        stats.conclusion_prematuree_suspecte++;
      }
      if (technicienSeul) stats.technicien_sans_enquete_prealable++;
    }
  }

  console.log(`=== AUDIT CAPTEURS Grock (${rows.length} tours) ===\n`);
  console.log('--- Capteurs internes (journal) ---');
  console.log(
    `Perception Pixtral remplie     : ${stats.capteur_perception_ok}/${rows.length} (${pct(stats.capteur_perception_ok, rows.length)})`,
  );
  console.log(
    `Photo hash (image reçue)       : ${stats.capteur_photo_ok}/${rows.length} (${pct(stats.capteur_photo_ok, rows.length)})`,
  );
  console.log(
    `note_interne remplie           : ${stats.capteur_note_interne_ok}/${rows.length} (${pct(stats.capteur_note_interne_ok, rows.length)})`,
  );
  console.log(
    `Parole locataire non vide      : ${stats.capteur_parole_non_vide}/${rows.length} (${pct(stats.capteur_parole_non_vide, rows.length)})`,
  );

  console.log('\n--- Instinct enquête (visible locataire) ---');
  console.log(
    `États enquête (ASK/PHOTO/…)    : ${stats.enquete_etat}/${rows.length} (${pct(stats.enquete_etat, rows.length)})`,
  );
  console.log(
    `Parole avec « ? » (question)   : ${stats.enquete_question_dans_parole}/${rows.length} (${pct(stats.enquete_question_dans_parole, rows.length)})`,
  );
  console.log(
    `Conclusion sans preuve visuelle: ${stats.conclusion_sans_preuve_visuelle}/${rows.length} (sonde qualité existante)`,
  );
  console.log(
    `Conclusion suspecte (technicien sans enquête origine): ${stats.conclusion_prematuree_suspecte}/${rows.length}`,
  );
  console.log(
    `Technicien/transmission sans question dans parole (états conclusifs): ${stats.technicien_sans_enquete_prealable}`,
  );

  console.log('\n--- Répartition des états ---');
  for (const [k, v] of Object.entries(states).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log('\n--- Lacunes structurelles (code) ---');
  console.log('  • thinking non journalisé → impossible de vérifier tête 1–3 offline');
  console.log('  • normalizeGrockState : « technicien » dans la parole → READY_TICKET (masque ASK_ONE_QUESTION)');
  console.log('  • runOpening conclut dès le 1er tour si bailleur_responsable/sinistre');
  console.log('  • Capteurs intake (étage, aspect eau…) : chemin Jarvis/Grock, pas toujours relus par Grock');
  console.log('  • Sondes qualité actuelles : pas de sonde « enquête avant conclusion »');

  const suspects = rows
    .filter(
      (r) =>
        CONCLUSIVE.has(r.state ?? '') &&
        /technicien|plombier|transm/i.test(r.acknowledgment ?? '') &&
        !(r.acknowledgment ?? '').includes('?'),
    )
    .slice(0, 6);

  if (suspects.length) {
    console.log('\n--- Exemples : technicien sans question ---');
    for (const s of suspects) {
      console.log(`[${s.id.slice(0, 8)}] ${s.state} · ${(s.title ?? '').slice(0, 40)}`);
      console.log(`  parole: ${(s.acknowledgment ?? '').slice(0, 100)}…`);
    }
  }

  await prisma.$disconnect();
}

function pct(n: number, d: number): string {
  return `${Math.round((n / Math.max(d, 1)) * 100)} %`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
