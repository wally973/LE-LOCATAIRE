import { detectMultipleClaims } from '../src/lia/lia-multi-claim';

const CASES: { label: string; text: string; expectCount: number }[] = [
  {
    label: 'un sujet plomberie',
    text: 'Fuite sous l’évier depuis hier',
    expectCount: 1,
  },
  {
    label: 'WC + électricité',
    text: 'Fuite au WC et plus d’électricité dans la cuisine',
    expectCount: 2,
  },
  {
    label: 'toiture seule',
    text: 'Infiltration au plafond quand il pleut',
    expectCount: 1,
  },
  {
    label: 'trois sujets',
    text:
      'Fuite au WC. Plus de lumière dans le couloir. Infiltration sur la toiture.',
    expectCount: 3,
  },
  {
    label: 'texte vague',
    text: 'Il y a un souci chez moi',
    expectCount: 0,
  },
  {
    label: 'ascenseur + chauffage',
    text:
      "L'ascenseur est bloqué et je n'ai plus de chauffage dans l'appartement",
    expectCount: 2,
  },
  {
    label: 'VMC + cafards résidence',
    text: 'La VMC ne tourne plus et il y a des cafards dans la cuisine',
    expectCount: 2,
  },
];

let failed = 0;
for (const c of CASES) {
  const claims = detectMultipleClaims(c.text, c.text);
  const ok = claims.length === c.expectCount;
  if (!ok) {
    failed += 1;
    console.error(
      `✗ ${c.label} : attendu ${c.expectCount}, obtenu ${claims.length}`,
    );
    console.error('  →', claims.map((x) => x.label).join(', ') || '(aucun)');
  } else {
    console.log(`✓ ${c.label} (${claims.length} sujet(s))`);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log('\nTous les cas detect-claims sont OK.');
