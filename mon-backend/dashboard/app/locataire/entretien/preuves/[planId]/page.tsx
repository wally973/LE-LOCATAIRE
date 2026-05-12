"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ProofPhotoUpload } from "@/components/maintenance/proof-photo-upload";
import { DynamicChecklist } from "@/components/maintenance/dynamic-checklist";
import { MaintenanceLegalNotice } from "@/components/maintenance/maintenance-legal-notice";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  checklistComplete,
  validateProofPhotos,
} from "@/lib/validations/maintenance-proof";
import {
  getTenantLogementId,
  useHlmLogementEntretien,
  useHlmSubmitProof,
} from "@/lib/hooks/use-hlm-queries";

const DEFAULT_ITEMS = [
  { id: "clean", label: "Nettoyage conforme au mode d’emploi" },
  { id: "access", label: "Accès sécurisé (extincteur, garde-corps…)" },
  { id: "water", label: "Vérification étanchéité / écoulement" },
];

export default function ProofSubmissionPage() {
  const params = useParams<{ planId: string }>();
  const planId = params?.planId ?? "";
  const logementId = getTenantLogementId();

  const { data: plans = [] } = useHlmLogementEntretien(logementId);
  const plan = useMemo(
    () => plans.find((p) => p.id === planId),
    [plans, planId],
  );

  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<{ cleaning: string; final: string }>({
    cleaning: "",
    final: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useHlmSubmitProof();

  const requiredKeys = useMemo(() => DEFAULT_ITEMS.map((i) => i.id), []);

  const submit = async () => {
    const proofs = validateProofPhotos(photos.cleaning, photos.final);
    const okList = checklistComplete(requiredKeys, checks);
    if (!proofs.success || !okList) {
      setMessage(
        "Validation impossible : cochez tous les points obligatoires et fournissez les deux URL de photos.",
      );
      return;
    }

    setMessage(null);
    try {
      await mutation.mutateAsync({
        logementEntretienId: planId,
        payload: {
          checklist: checks as Record<string, unknown>,
          photo1Url: photos.cleaning,
          photo2Url: photos.final,
        },
      });
      setMessage("Preuve envoyée avec succès (POST /hlm/preuves/:logementEntretienId).");
    } catch (e: unknown) {
      setMessage(
        e instanceof Error ? e.message : "Erreur lors de l’envoi — vérifiez le JWT et le backend.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Transmission des preuves</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ligne de plan{" "}
          <code className="rounded bg-muted px-1">{planId}</code>
          {plan ? (
            <>
              {" "}
              — type <strong>{plan.entretienTypeCode}</strong>
            </>
          ) : null}
        </p>
      </div>

      {!logementId ? (
        <Alert>
          <AlertTitle>Configuration</AlertTitle>
          <AlertDescription>
            Définissez <code className="rounded bg-muted px-1">NEXT_PUBLIC_HLM_LOGEMENT_ID</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      <MaintenanceLegalNotice />
      <Card>
        <CardHeader>
          <CardTitle>Check-list interactive</CardTitle>
          <CardDescription>
            Module 2 — le locataire atteste chaque opération pour limiter les
            reclassements de charge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DynamicChecklist
            items={DEFAULT_ITEMS}
            values={checks}
            onChange={(id, v) => setChecks((p) => ({ ...p, [id]: v }))}
          />
        </CardContent>
      </Card>
      <ProofPhotoUpload onUrlsChange={setPhotos} />
      <Button size="lg" onClick={submit} disabled={mutation.isPending}>
        {mutation.isPending ? "Envoi…" : "Envoyer au service conformité"}
      </Button>
      {message ? (
        <Alert variant={message.startsWith("Preuve envoyée") ? "default" : "destructive"}>
          <AlertTitle>Résultat</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
