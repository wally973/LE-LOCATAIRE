import { z } from "zod";

export const proofPhotoSchema = z.object({
  photoCleaningUrl: z.string().url().min(1),
  photoFinalStateUrl: z.string().url().min(1),
});

export type ProofPayload = z.infer<typeof proofPhotoSchema>;

export function validateProofPhotos(
  cleaning: string | undefined,
  finalState: string | undefined,
) {
  return proofPhotoSchema.safeParse({
    photoCleaningUrl: cleaning,
    photoFinalStateUrl: finalState,
  });
}

/** Check-list dynamique : toutes les clés attendues à true pour soumettre */
export function checklistComplete(
  requiredKeys: string[],
  values: Record<string, boolean>,
) {
  return requiredKeys.every((k) => values[k] === true);
}
