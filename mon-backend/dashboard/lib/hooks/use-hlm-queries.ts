"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hlmApi } from "@/lib/api/hlm-client";
import {
  mapLogementEntretienPlan,
  mapResidenceDto,
  mapTicketDto,
} from "@/lib/hlm/mappers";
import { hlmKeys } from "@/lib/hooks/hlm-keys";
import type {
  CreateHlmTicketPayload,
  SubmitProofPayload,
} from "@/lib/api/hlm-types";

export function useHlmResidences() {
  return useQuery({
    queryKey: hlmKeys.residences(),
    queryFn: async () => {
      const rows = await hlmApi.listResidences();
      return rows.map(mapResidenceDto);
    },
  });
}

export function useHlmResidence(id: string | undefined) {
  return useQuery({
    queryKey: hlmKeys.residence(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("residence id manquant");
      const r = await hlmApi.getResidence(id);
      return mapResidenceDto(r);
    },
    enabled: Boolean(id),
  });
}

export function useHlmLogements() {
  return useQuery({
    queryKey: hlmKeys.logements(),
    queryFn: () => hlmApi.listLogements(),
  });
}

export function useHlmLogement(id: string | undefined) {
  return useQuery({
    queryKey: hlmKeys.logement(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("logement id manquant");
      return hlmApi.getLogement(id);
    },
    enabled: Boolean(id),
  });
}

export function useHlmLogementEntretien(logementId: string | undefined) {
  return useQuery({
    queryKey: hlmKeys.entretienLogement(logementId ?? ""),
    queryFn: async () => {
      if (!logementId) throw new Error("logement id manquant");
      const rows = await hlmApi.listLogementEntretien(logementId);
      return rows.map(mapLogementEntretienPlan);
    },
    enabled: Boolean(logementId),
  });
}

export function useHlmProofsForLogement(logementId: string | undefined) {
  return useQuery({
    queryKey: hlmKeys.preuvesLogement(logementId ?? ""),
    queryFn: async () => {
      if (!logementId) throw new Error("logement id manquant");
      return hlmApi.listProofsForLogement(logementId);
    },
    enabled: Boolean(logementId),
  });
}

export function useHlmTickets() {
  return useQuery({
    queryKey: hlmKeys.tickets(),
    queryFn: async () => {
      const rows = await hlmApi.listTickets();
      return rows.map(mapTicketDto);
    },
  });
}

export function useHlmSubmitProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      logementEntretienId,
      payload,
    }: {
      logementEntretienId: string;
      payload: SubmitProofPayload;
    }) => hlmApi.submitProof(logementEntretienId, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: hlmKeys.all });
    },
  });
}

export function useHlmCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateHlmTicketPayload) =>
      hlmApi.createTicket(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: hlmKeys.tickets() });
    },
  });
}

/** Identifiant logement locataire (UUID) — `.env.local` : NEXT_PUBLIC_HLM_LOGEMENT_ID */
export function getTenantLogementId(): string | undefined {
  return process.env.NEXT_PUBLIC_HLM_LOGEMENT_ID;
}
