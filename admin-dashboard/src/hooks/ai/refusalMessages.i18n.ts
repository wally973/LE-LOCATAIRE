import { GUARDRAIL_REFUSAL_MESSAGE_FR } from './legalDisclaimer';
import type { SupportedLocale } from './useMultilingualAI';

const MAP: Record<SupportedLocale, string> = {
  fr: GUARDRAIL_REFUSAL_MESSAGE_FR,
  en: 'I can only answer questions about your housing or how to use the app. For other topics, please contact an appropriate service.',
  ht: 'Mwen ka reponn sèlman kesyon ki gen rapò ak lojman ou oswa itilizasyon aplikasyon an. Pou lòt sijè, tanpri kontakte yon sèvis ki apwopriye.',
  'pt-BR':
    'Só posso responder a perguntas sobre o seu imóvel ou sobre o uso do aplicativo. Para outros assuntos, procure um serviço adequado.',
  'es-DO':
    'Solo puedo responder sobre su vivienda o el uso de la aplicación. Para otros temas, consulte un servicio adecuado.',
};

export function refusalMessage(locale: SupportedLocale): string {
  return MAP[locale] ?? GUARDRAIL_REFUSAL_MESSAGE_FR;
}
