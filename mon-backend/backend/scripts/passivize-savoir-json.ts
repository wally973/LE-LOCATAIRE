/**
 * Transforme panne-diagnostic-logique.json et master-diagnostic-rules.json
 * en fiches de connaissance passives (sans séquence de questions).
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function passivizePanneDiagnostic() {
  const filePath = path.join(repoRoot, 'data', 'panne-diagnostic-logique.json');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    panes: Array<{
      id: string;
      label: string;
      category: string;
      scope?: string;
      keywords: string[];
      causes: Array<{
        id: string;
        label: string;
        probabilityGuyane?: number;
        discriminantQuestion?: {
          text?: string;
          eliminatesIfMeaning?: string;
        };
        danger: { level: string; description: string };
        responsibilityHint: string;
      }>;
    }>;
  };

  const fiches = raw.panes.map((pane) => ({
    id: pane.id,
    lot: pane.category,
    label: pane.label,
    scope: pane.scope ?? 'LOGEMENT',
    keywords: pane.keywords,
    contexteGuyane:
      'Probabilités terrain Guyane (humidité, pluies, réseau fragile) — indicatif, pas script de dialogue.',
    causesConnues: pane.causes.map((c) => ({
      id: c.id,
      label: c.label,
      probabiliteTerrain: c.probabilityGuyane ?? null,
      signesDiscriminants: [
        c.discriminantQuestion?.text,
        c.discriminantQuestion?.eliminatesIfMeaning,
      ]
        .filter(Boolean)
        .join(' — '),
      danger: c.danger,
      chargeHint: c.responsibilityHint,
    })),
  }));

  const out = {
    schema: 'PASSIVE_KNOWLEDGE_SHEET',
    schemaVersion: 2,
    region: 'GUYANE',
    updatedAt: new Date().toISOString().slice(0, 10),
    description:
      'Fiches de connaissance passive — enrichissent la délibération, ne dictent jamais le dialogue locataire.',
    prioriteTerritoriale: {
      dominant: 'GUYANE',
      regle:
        'En cas de contradiction avec une règle métropolitaine, RTAA-DOM et savoir climat tropical priment.',
    },
    fiches,
  };

  fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`passivize panne-diagnostic: ${fiches.length} fiches`);
}

function passivizeMasterDiagnostic() {
  const filePath = path.join(repoRoot, 'knowledge', 'master-diagnostic-rules.json');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    domains: Array<{
      id: string;
      label: string;
      category: string;
      keywords: string[];
      criticalSensors?: Array<{ label: string }>;
      hypotheses?: Array<{
        label: string;
        responsibilityHint: string;
      }>;
      eliminationRules?: Array<{ eliminationReason: string }>;
      urgentDangerPatterns?: string[];
      urgentSafetyMessage?: string;
    }>;
  };

  const fiches = raw.domains.map((d) => ({
    id: d.id,
    lot: d.category,
    label: d.label,
    keywords: d.keywords,
    signesUtiles: (d.criticalSensors ?? []).map((s) => s.label),
    pistesConnues: (d.hypotheses ?? []).map((h) => ({
      label: h.label,
      chargeHint: h.responsibilityHint,
    })),
    notesTerrain: (d.eliminationRules ?? []).map((r) => r.eliminationReason),
    signesUrgence: d.urgentDangerPatterns ?? [],
    messageSecurite: d.urgentSafetyMessage ?? null,
  }));

  const out = {
    schema: 'PASSIVE_KNOWLEDGE_SHEET',
    version: 2,
    updatedAt: new Date().toISOString().slice(0, 10),
    method: 'Savoir-Voir-passif',
    description:
      'Fiches multi-corps d’état — observation et sécurité, sans arbre de questions ni élimination scriptée.',
    prioriteTerritoriale: {
      dominant: 'GUYANE',
      regle:
        'RTAA-DOM / climat tropical prime sur toute règle nationale contradictoire.',
    },
    fiches,
  };

  fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`passivize master-diagnostic: ${fiches.length} fiches`);
}

passivizePanneDiagnostic();
passivizeMasterDiagnostic();
