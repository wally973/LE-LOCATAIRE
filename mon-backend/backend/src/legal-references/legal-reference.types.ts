/** Entrée du catalogue juridique (JSON source + API + mobile offline). */
export interface LegalReferenceSourceDto {
  label: string;
  url: string;
  article: string | null;
}

export interface LegalReferenceEntryDto {
  slug: string;
  kind: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  responsibilityHint: string | null;
  keywords: string[];
  sources: LegalReferenceSourceDto[];
  exceptions: string[];
  sortOrder: number;
}

export interface LegalReferencesCatalogDto {
  version: number;
  updatedAt: string;
  description?: string;
  entries: LegalReferenceEntryDto[];
}

export interface LegalReferenceSearchHitDto extends LegalReferenceEntryDto {
  score: number;
}
