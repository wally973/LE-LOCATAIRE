import type { CompanionLanguage } from '../conversation/lia-companion.types';
import { resolveSignalementBody } from './lia-tenant-signalement-facts';

type L = CompanionLanguage;

/** Sens métier de la relance post-dossier — déduit du signalement, pas du seul domaine simulation. */
export type PostIntakeFollowUpKind =
  | 'locksmith'
  | 'plumbing'
  | 'cleaning_commons'
  | 'heating'
  | 'pests'
  | 'elevator'
  | 'common_works'
  | 'generic';

function pick(lang: L, table: Record<L, string>): string {
  return table[lang] ?? table.fr;
}

export function jarvisOpeningHeard(name: string, lang: L): string {
  return pick(lang, {
    fr: `${name}, je vous entends.`,
    gcf: `${name}, mwen tande ou.`,
    en: `${name}, I hear you.`,
    pt: `${name}, estou a ouvir.`,
    es: `${name}, le escucho.`,
    hat: `${name}, mwen tande ou.`,
  });
}

export function jarvisOpeningDoor(name: string, lieu: string, lang: L): string {
  const place = lieu ? ` (${lieu.trim()})` : '';
  return (
    jarvisOpeningHeard(name, lang) +
    ' ' +
    pick(lang, {
      fr: `Vous signalez une porte qui ne ferme plus correctement${place}.`,
      gcf: `Ou di m pòt-la pa fèmen kòrèkteman${place}.`,
      en: `You report a door that no longer closes properly${place}.`,
      pt: `Você relata uma porta que não fecha corretamente${place}.`,
      es: `Usted indica que una puerta ya no cierra bien${place}.`,
      hat: `Ou di m pòt-la pa fèmen byen${place}.`,
    })
  );
}

/** Lecture signalement porte — bloquée, enfant dedans, ou fermeture défectueuse. */
export function jarvisReadDoorSignalement(
  name: string,
  lang: L,
  title: string,
  description: string,
  room: string | null,
): string | null {
  const ctx = normMsg(`${title} ${description}`);
  const place = room ? ` (${room})` : '';
  const personInside =
    /enfant|fils|fille|bebe|dedans|enferm|dans la chambre|dans la piece|dans la pièce|personne/.test(
      ctx,
    );
  const blocked =
    /porte.*bloqu|bloqu.*porte|porte.*coinc|coinc.*porte|ne s.?ouvre plus|ne s ouvre plus/.test(
      ctx,
    );
  const noClose = /ne ferme plus|ferme pas|ne ferme pas|pa fèmen/.test(ctx);

  if (blocked && personInside) {
    return pick(lang, {
      fr: `${name}, j’ai lu votre signalement — porte de chambre bloquée${place}, votre enfant est encore dans la pièce.`,
      gcf: `${name}, mwen li siyalman ou — pòt chanm bloke${place}, pitit ou toujou andan.`,
      en: `${name}, I’ve read your report — bedroom door blocked${place}, your child is still inside the room.`,
      pt: `${name}, li o seu pedido — porta do quarto bloqueada${place}, a criança ainda está dentro.`,
      es: `${name}, he leído su aviso — puerta de dormitorio bloqueada${place}, su hijo sigue dentro.`,
      hat: `${name}, mwen li siyalman ou — pòt chanm bloke${place}, pitit ou toujou andedan.`,
    });
  }
  if (blocked) {
    return pick(lang, {
      fr: `${name}, j’ai lu votre signalement — porte bloquée${place}, elle ne s’ouvre plus.`,
      gcf: `${name}, mwen li siyalman ou — pòt bloke${place}, li pa ouvri.`,
      en: `${name}, I’ve read your report — door blocked${place}, it will not open.`,
      pt: `${name}, li o seu pedido — porta bloqueada${place}, não abre.`,
      es: `${name}, he leído su aviso — puerta bloqueada${place}, no abre.`,
      hat: `${name}, mwen li siyalman ou — pòt bloke${place}, li pa ouvri.`,
    });
  }
  if (noClose) {
    return pick(lang, {
      fr: `${name}, j’ai lu votre signalement — porte qui ne ferme plus correctement${place}.`,
      gcf: `${name}, mwen li siyalman ou — pòt ki pa fèmen kòrèkteman${place}.`,
      en: `${name}, I’ve read your report — door that no longer closes properly${place}.`,
      pt: `${name}, li o seu pedido — porta que já não fecha corretamente${place}.`,
      es: `${name}, he leído su aviso — puerta que ya no cierra bien${place}.`,
      hat: `${name}, mwen li siyalman ou — pòt ki pa fèmen byen${place}.`,
    });
  }
  return null;
}

export function signalementSuggestsPersonTrapped(ctx: string): boolean {
  const t = normMsg(ctx);
  return (
    /bloqu|coinc|ne s.?ouvre plus|ne s ouvre plus/.test(t) &&
    /enfant|fils|fille|bebe|dedans|enferm|dans la chambre|dans la piece|dans la pièce/.test(t)
  );
}

export function jarvisDoorTrappedUrgencyPriority(lang: L): string {
  return pick(lang, {
    fr: 'C’est urgent pour votre enfant : je transmets tout de suite en priorité au bailleur pour qu’un serrurier intervienne. Restez joignable.',
    gcf: 'Sa ijan pou pitit ou : mwen voye tout swit an priyorite bay bailleur pou yon serurier vini. Rete disponib.',
    en: 'This is urgent for your child: I’m forwarding this immediately as a priority to your landlord for a locksmith. Please stay reachable.',
    pt: 'É urgente para a criança: transmito já em prioridade ao senhorio para um serralheiro intervir. Fique disponível.',
    es: 'Es urgente para su hijo: transmito de inmediato en prioridad al arrendador para que intervenga un cerrajero. Permanezca localizable.',
    hat: 'Sa ijan pou pitit ou : mwen voye tout swit an priyorite bay bailleur pou yon serurier vini. Rete disponib.',
  });
}

export function jarvisQuestionDoorTrapped(lang: L): string {
  return pick(lang, {
    fr: 'Pour orienter le serrurier sans perdre de temps : de l’intérieur, la poignée bouge-t-elle encore — ou plus rien ne répond ?',
    gcf: 'Depi andan, lè ou tounen poignée-a, li bouje toujou — ou pa gen anyen ki reponn ?',
    en: 'From inside, when you try the handle, does it still move — or nothing responds at all?',
    pt: 'Do interior, quando mexem na maçaneta, ela ainda mexe — ou já não responde nada?',
    es: 'Desde dentro, al accionar la manilla, ¿aún se mueve — o ya no responde nada?',
    hat: 'Depi andedan, lè ou tounen poignée a, li bouje toujou — ou pa gen anyen ki reponn?',
  });
}

export function jarvisOpeningPlumbing(
  name: string,
  anchor: string,
  lang: L,
): string {
  return (
    jarvisOpeningHeard(name, lang) +
    ' ' +
    pick(lang, {
      fr: `Vous signalez une fuite d’eau ${anchor}.`,
      gcf: `Ou gen yon fuite dlo ${anchor}.`,
      en: `You report a water leak ${anchor}.`,
      pt: `Você relata uma fuga de água ${anchor}.`,
      es: `Usted indica una fuga de agua ${anchor}.`,
      hat: `Ou gen yon koule dlo ${anchor}.`,
    })
  );
}

/** Lecture signalement plomberie — urgence, inondation, eau sale. */
export function jarvisReadPlumbingSignalement(
  name: string,
  lang: L,
  title: string,
  description: string,
  room: string | null,
): string | null {
  const body = resolveSignalementBody(title, description);
  const ctx = normMsg(`${title} ${body}`);
  const place = room === 'cuisine' ? ' de cuisine' : room ? ` (${room})` : '';
  const urgent = /urgent|press|i\s*jan/i.test(ctx);
  const flooded = /inond|noy|nappe|flaque|debord|débord|inonder/.test(ctx);
  const dirtyWater = /eau sale|eaux sales|eau crasse|evier.*sale|évier.*sale/.test(ctx);
  const sinkFull =
    /evier.*rempli|rempli.*evier|évier.*rempli|rempli.*évier|evier.*plein|évier.*plein|plein.*eau/.test(
      ctx,
    );

  if (urgent && (flooded || sinkFull) && dirtyWater) {
    return pick(lang, {
      fr: `${name}, c’est urgent : votre évier${place || ' de cuisine'} est plein d’eau sale et votre cuisine est inondée.`,
      gcf: `${name}, mwen li siyalman ou — sa ijan : evye${place} plen dlo sale é kwizin inonde.`,
      en: `${name}, I’ve read your report — it’s urgent: sink${place} full of dirty water and the kitchen is flooded.`,
      pt: `${name}, li o seu pedido — é urgente: lava-loiça${place} cheia de água suja e cozinha inundada.`,
      es: `${name}, he leído su aviso — es urgente: fregadero${place} lleno de agua sucia y cocina inundada.`,
      hat: `${name}, mwen li siyalman ou — sa ijan : evye${place} plen dlo sale e kwizin inonde.`,
    });
  }
  if (urgent && flooded) {
    return pick(lang, {
      fr: `${name}, c’est urgent : votre cuisine est inondée, avec un souci au niveau de l’évier${place}.`,
      gcf: `${name}, mwen li siyalman ou — sa ijan : kwizin inonde, pwoblèm sou evye${place}.`,
      en: `${name}, I’ve read your report — urgent: kitchen flooded, issue at the sink${place}.`,
      pt: `${name}, li o seu pedido — urgente: cozinha inundada, problema no lava-loiça${place}.`,
      es: `${name}, he leído su aviso — urgente: cocina inundada, problema en el fregadero${place}.`,
      hat: `${name}, mwen li siyalman ou — ijan : kwizin inonde, pwoblèm sou evye${place}.`,
    });
  }
  if (sinkFull && dirtyWater) {
    return pick(lang, {
      fr: `${name}, j’ai lu votre signalement — évier${place} rempli d’eau sale.`,
      gcf: `${name}, mwen li siyalman ou — evye${place} plen dlo sale.`,
      en: `${name}, I’ve read your report — sink${place} full of dirty water.`,
      pt: `${name}, li o seu pedido — lava-loiça${place} cheia de água suja.`,
      es: `${name}, he leído su aviso — fregadero${place} lleno de agua sucia.`,
      hat: `${name}, mwen li siyalman ou — evye${place} plen dlo sale.`,
    });
  }
  if (flooded) {
    return pick(lang, {
      fr: `${name}, j’ai lu votre signalement — cuisine inondée${place}.`,
      gcf: `${name}, mwen li siyalman ou — kwizin inonde${place}.`,
      en: `${name}, I’ve read your report — flooded kitchen${place}.`,
      pt: `${name}, li o seu pedido — cozinha inundada${place}.`,
      es: `${name}, he leído su aviso — cocina inundada${place}.`,
      hat: `${name}, mwen li siyalman ou — kwizin inonde${place}.`,
    });
  }
  return null;
}

export function jarvisPlumbingBackupHandoff(lang: L): string {
  return pick(lang, {
    fr: 'Je transmets tout de suite en priorité au bailleur pour qu’un plombier débouche l’évacuation locale. Restez joignable ; n’utilisez plus l’évier en attendant.',
    gcf: 'Mwen voye tout swit an priyorite bay Bailleur-la pou yon plombier debouche vidaj-la. Rete disponib ; pa itilize evye-a ankò.',
    en: 'I’m forwarding this immediately as a priority to your landlord for a plumber to clear the local drain. Stay reachable; do not use the sink meanwhile.',
    pt: 'Transmito já em prioridade ao senhorio para um canalizador desentupir a evacuação local. Fique disponível; não use a pia entretanto.',
    es: 'Transmito de inmediato en prioridad al arrendador para que un fontanero desatasque el desagüe local. Permanezca localizable; no use el fregadero mientras tanto.',
    hat: 'Mwen voye tout swit an priyorite bay pwopriyetè a pou yon plombier debouche vidaj la. Rete disponib ; pa sèvi ak evye a ankò.',
  });
}

/** Handoff refoulement EU colonne — exutoire aval (3 verres), pas simple fuite amont. */
export function jarvisPlumbingEuRefoulementHandoff(lang: L): string {
  return pick(lang, {
    fr: 'Je transmets tout de suite en priorité au bailleur : refoulement probable sur la colonne d’eaux usées — intervention type hydrocureur sur la descente de l’immeuble, pas une simple fuite sous l’évier. Restez joignable ; n’utilisez plus l’évier ni les eaux dans la cuisine.',
    gcf: 'Mwen voye tout swit an priyorite bay Bailleur-la : refoulement sou kolonn dlo sale — bezwen hydrocureur sou desann kay-la, pa yon ti fuite anba evye. Rete disponib ; pa itilize evye-a ni dlo nan kwizin.',
    en: 'I’m forwarding this immediately as a priority to your landlord: likely backflow in the wastewater stack — hydrocureur-type clearance on the building drain, not a simple under-sink leak. Stay reachable; do not use the sink or water in the kitchen.',
    pt: 'Transmito já em prioridade ao senhorio: provável refluxo na coluna de águas residuais — intervenção tipo hydrocureur na descida do edifício, não uma simples fuga sob a pia. Fique disponível; não use a pia nem água na cozinha.',
    es: 'Transmito de inmediato en prioridad al arrendador: probable reflujo en la columna de aguas residuales — intervención tipo hydrocureur en la bajante del edificio, no una simple fuga bajo el fregadero. Permanezca localizable; no use el fregadero ni el agua en la cocina.',
    hat: 'Mwen voye tout swit an priyorite bay pwopriyetè a : refoulement sou kolonn dlo sale — bezwen hydrocureur sou desann bilding la. Rete disponib ; pa sèvi ak evye a.',
  });
}

export function jarvisPlumbingBackupHandoffForFacts(
  facts: { plumbingEuRefoulementLead?: boolean } | null | undefined,
  lang: L,
): string {
  if (facts?.plumbingEuRefoulementLead) {
    return jarvisPlumbingEuRefoulementHandoff(lang);
  }
  return jarvisPlumbingBackupHandoff(lang);
}

export function jarvisPlumbingUrgencyPriority(lang: L): string {
  return pick(lang, {
    fr: 'Je transmets en priorité au bailleur pour qu’un plombier intervienne. Restez joignable ; si vous le pouvez, coupez l’eau sous l’évier en attendant.',
    gcf: 'Mwen voye an priyorite bay Bailleur-la pou yon plombier vini. Rete disponib ; si ou ka, fèmen dlo anba evye-a.',
    en: 'I’m forwarding this as a priority to your landlord for a plumber. Stay reachable; if you can, shut off the water under the sink meanwhile.',
    pt: 'Transmito em prioridade ao senhorio para um canalizador. Fique disponível; se puder, feche a água debaixo da pia.',
    es: 'Transmito en prioridad al arrendador para un fontanero. Permanezca localizable; si puede, cierre el agua bajo el fregadero.',
    hat: 'Mwen voye an priyorite bay pwopriyetè a pou yon plombier vini. Rete disponib ; si ou ka, fèmen dlo anba evye a.',
  });
}

export function jarvisOpeningGeneric(name: string, lang: L): string {
  return (
    jarvisOpeningHeard(name, lang) +
    ' ' +
    pick(lang, {
      fr: 'Dites-moi ce qui se passe chez vous, je vais vous poser quelques questions.',
      gcf: 'Di m sa k ap pase lakay ou, m ap poze ou kèk kesyon.',
      en: 'Tell me what is going on at home — I will ask a few questions.',
      pt: 'Diga-me o que se passa em casa — vou fazer algumas perguntas.',
      es: 'Cuénteme qué ocurre en la vivienda — le haré unas preguntas.',
      hat: 'Di m sa k ap pase lakay ou, m ap poze ou kèk kesyon.',
    })
  );
}

/** Ouverture réception TV / signal — ton technicien, pas de jargon interne. */
export function jarvisOpeningSignal(name: string, lang: L): string {
  return (
    jarvisOpeningHeard(name, lang) +
    ' ' +
    pick(lang, {
      fr: 'Vous n’avez plus de réception télé — je vais vous poser deux ou trois questions pour localiser la panne.',
      gcf: 'Ou pa gen resepsyon televizyon — m ap poze ou de-twa kesyon pou nou lokalize pan-an.',
      en: 'You have no TV reception — I will ask a few questions to locate the fault.',
      pt: 'Sem recepção de TV — vou fazer algumas perguntas para localizar a avaria.',
      es: 'Sin recepción de TV — le haré unas preguntas para localizar la avería.',
      hat: 'Ou pa gen resepsyon televizyon — m ap poze ou kèk kesyon pou nou jwenn kote pan an ye.',
    })
  );
}

export function jarvisThanks(name: string, lang: L): string {
  return pick(lang, {
    fr: `${name}, merci pour cette précision.`,
    gcf: `${name}, mèsi pou presizyon-an.`,
    en: `${name}, thank you for clarifying.`,
    pt: `${name}, obrigado pela informação.`,
    es: `${name}, gracias por el detalle.`,
    hat: `${name}, mèsi pou presizyon-an.`,
  });
}

export function jarvisClosingDoorLock(name: string, lang: L): string {
  return pick(lang, {
    fr: `${name}, merci — j’ai ce qu’il me faut. Je transmets au bailleur pour qu’un serrurier vérifie la gâche et le pêne.`,
    gcf: `${name}, mèsi — mwen gen ase enfòmasyon. Mwen ka alèt Bailleur-la pou yon serrurier verifye gâche-a.`,
    en: `${name}, thank you — I have enough detail. I will alert the landlord so a locksmith can check the lock and bolt.`,
    pt: `${name}, obrigado — tenho informação suficiente. Vou avisar o senhorio para um serralheiro verificar a fechadura.`,
    es: `${name}, gracias — tengo lo necesario. Avisaré al arrendador para que un cerrajero revise la cerradura.`,
    hat: `${name}, mèsi — m gen ase enfòmasyon. M ap alèt pwopriyetè a pou yon serur verifye kadna-a.`,
  });
}

export function jarvisClosingPlumbing(name: string, lang: L): string {
  return pick(lang, {
    fr: `${name}, merci — j’ai assez d’éléments pour transmettre votre dossier plomberie au bailleur.`,
    gcf: `${name}, mèsi — mwen gen ase enfòmasyon pou transmèt dosye plonbye-a bay Bailleur-la.`,
    en: `${name}, thank you — I have enough to forward your plumbing case to the landlord.`,
    pt: `${name}, obrigado — posso encaminhar o caso de canalização ao senhorio.`,
    es: `${name}, gracias — puedo transmitir su caso de fontanería al arrendador.`,
    hat: `${name}, mèsi — m gen ase pou voye dosye plonriye a bay pwopriyetè a.`,
  });
}

export function jarvisClosingGeneric(name: string, lang: L): string {
  return pick(lang, {
    fr: `${name}, merci — j’ai assez d’éléments pour suivre votre dossier.`,
    gcf: `${name}, mèsi — mwen gen ase enfòmasyon pou swiv dosye-a.`,
    en: `${name}, thank you — I have enough to follow up on your case.`,
    pt: `${name}, obrigado — tenho o necessário para acompanhar o seu caso.`,
    es: `${name}, gracias — tengo lo necesario para seguir su caso.`,
    hat: `${name}, mèsi — m gen ase pou swiv dosye ou.`,
  });
}

/** Fin d’intake — ticket transmis, technicien secteur recontacte la locataire. */
export function jarvisIntakeTransmissionTail(lang: L): string {
  return pick(lang, {
    fr: 'Votre signalement est transmis au bailleur. Un technicien de votre secteur va vous recontacter pour organiser l’intervention — restez joignable sur votre téléphone.',
    gcf: 'Siyalman ou voye bay Bailleur-la. Yon teknisyen sektè ou ap kontakte ou pou òganize entèvansyon-an — rete disponib sou telefòn ou.',
    en: 'Your report has been sent to the landlord. A sector technician will contact you to arrange the visit — please keep your phone reachable.',
    pt: 'O seu pedido foi enviado ao senhorio. Um técnico do seu setor entrará em contacto consigo — mantenha o telefone disponível.',
    es: 'Su aviso ha sido transmitido al arrendador. Un técnico de su sector le contactará — mantenga el teléfono accesible.',
    hat: 'Siyalman ou voye bay pwopriyetè a. Yon teknisyen sektè ou ap kontakte ou — rete disponib sou telefòn ou.',
  });
}

/** Ajoute la clôture transmission si le message ne l’annonce pas déjà. */
export function appendJarvisIntakeTransmission(
  acknowledgment: string,
  lang: L,
): string {
  const ack = acknowledgment.trim();
  if (!ack) return jarvisIntakeTransmissionTail(lang);
  if (
    /technicien.*recontacter|technicien.*contact|teknisyen.*kontakte|technician will contact/i.test(
      ack,
    )
  ) {
    return ack;
  }
  return `${ack} ${jarvisIntakeTransmissionTail(lang)}`;
}

export function jarvisClosingCleaningCommons(name: string, lang: L): string {
  return pick(lang, {
    fr: `${name}, merci — j’ai ce qu’il me faut. ${jarvisTailCleaningCommons(lang)}`,
    gcf: `${name}, mèsi — mwen gen ase enfòmasyon. ${jarvisTailCleaningCommons(lang)}`,
    en: `${name}, thank you — I have enough detail. ${jarvisTailCleaningCommons(lang)}`,
    pt: `${name}, obrigado — tenho informação suficiente. ${jarvisTailCleaningCommons(lang)}`,
    es: `${name}, gracias — tengo lo necesario. ${jarvisTailCleaningCommons(lang)}`,
    hat: `${name}, mèsi — m gen ase enfòmasyon. ${jarvisTailCleaningCommons(lang)}`,
  });
}

/** Suite transmission — après lecture explicite du signalement. */
export function jarvisTailCleaningCommons(lang: L): string {
  return pick(lang, {
    fr: 'Je transmets au bailleur la salubrité signalée, avec consigne de relancer le prestataire du ménage des parties communes.',
    gcf: 'Mwen voye bay Bailleur-la salubrite siyalé-a, é pou relanse prestataire netwayaj pati komen.',
    en: 'I’m sending the landlord the reported cleanliness issue, with instruction to follow up with the common-area cleaning contractor.',
    pt: 'Envio ao senhorio a salubridade reportada, com indicação para reactivar o prestador de limpeza das partes comuns.',
    es: 'Transmito al arrendador la salubridad reportada, con indicación de relanzar al prestador de limpieza de zonas comunes.',
    hat: 'M ap voye bay pwopriyetè a pwoprete siyalman-an, ak konsiy pou relanse founisè netwayaj pati komen yo.',
  });
}

export function jarvisAdministrativeRedirectTail(lang: L): string {
  return pick(lang, {
    fr: 'Ce fil sert aux pannes et à l’entretien du logement ; pour l’accueil et les documents, veuillez vous rapprocher auprès de la gérance ou de l’agence de votre secteur.',
    gcf: 'Fil-la sé pou pan ak antretyen kay ; pou accueil ak dokiman, ale w rankontre jesyon an ou ajans sektè ou.',
    en: 'This channel is for faults and home maintenance; for reception and documents, please go to your local management office or sector agency.',
    pt: 'Este canal é para avarias e manutenção da habitação; para receção e documentos, dirija-se à gerência ou à agência do seu setor.',
    es: 'Este canal es para averías y mantenimiento; para recepción y documentos, acuda a la gerencia o a la agencia de su sector.',
    hat: 'Fil sa a se pou pan ak antretyen kay ; pou akèy ak dokiman, ale w jwenn jesyon an oswa ajans sektè ou.',
  });
}

export function jarvisOpeningAfterSignalementRead(lang: L): string {
  return pick(lang, {
    fr: 'Pour préciser votre dossier, une question :',
    gcf: 'Pou presize dosye-a, yon kesyon :',
    en: 'To refine your case, one question:',
    pt: 'Para precisar o seu caso, uma pergunta:',
    es: 'Para precisar su caso, una pregunta:',
    hat: 'Pou presize dosye ou, yon kesyon :',
  });
}

/** Clôture locataire — lecture du signalement puis action de transmission. */
export function jarvisClosingWithSignalementRead(params: {
  name: string;
  lang: L;
  kind: PostIntakeFollowUpKind;
  domain: string;
  read: string;
}): string {
  const { read, lang, kind, domain } = params;
  if (kind === 'cleaning_commons') {
    return `${read} ${jarvisTailCleaningCommons(lang)}`;
  }
  const full = jarvisClosingByFollowUpKind(params.name, lang, kind, domain);
  const tail = full.replace(/^[^,]+,\s*(merci|mèsi|thank you|obrigado|gracias)[^.]+\.\s*/i, '');
  return tail.trim() ? `${read} ${tail}` : full;
}

/** Clôture locataire adaptée au signalement (pas seulement au domaine simulation). */
export function jarvisClosingByFollowUpKind(
  name: string,
  lang: L,
  kind: PostIntakeFollowUpKind,
  domain: string,
): string {
  if (domain === 'carpentry_door' || kind === 'locksmith') {
    return jarvisClosingDoorLock(name, lang);
  }
  if (domain === 'plumbing_sink' || kind === 'plumbing') {
    return jarvisClosingPlumbing(name, lang);
  }
  if (kind === 'cleaning_commons') {
    return jarvisClosingCleaningCommons(name, lang);
  }
  if (kind === 'pests') {
    return pick(lang, {
      fr: `${name}, merci — j’ai ce qu’il me faut. Je transmets au bailleur pour qu’un traitement des nuisibles soit organisé.`,
      gcf: `${name}, mèsi — mwen voye bay Bailleur-la pou òganize tretman nuisible.`,
      en: `${name}, thank you — I have enough detail. I’m sending this to the landlord to arrange pest treatment.`,
      pt: `${name}, obrigado — envio ao senhorio para organizar tratamento de pragas.`,
      es: `${name}, gracias — transmito al arrendador para organizar tratamiento de plagas.`,
      hat: `${name}, mèsi — m ap voye bay pwopriyetè a pou òganize tretman nuisib.`,
    });
  }
  if (kind === 'heating') {
    return pick(lang, {
      fr: `${name}, merci — j’ai ce qu’il me faut. Je transmets au bailleur pour qu’il fasse intervenir le chauffage.`,
      gcf: `${name}, mèsi — mwen voye bay Bailleur-la pou chofaj.`,
      en: `${name}, thank you — I’m sending this to the landlord for heating intervention.`,
      pt: `${name}, obrigado — envio ao senhorio para intervenção no aquecimento.`,
      es: `${name}, gracias — transmito al arrendador para la calefacción.`,
      hat: `${name}, mèsi — m ap voye bay pwopriyetè a pou chofaj.`,
    });
  }
  if (kind === 'elevator') {
    return pick(lang, {
      fr: `${name}, merci — j’ai ce qu’il me faut. Je transmets au bailleur pour la remise en service de l’ascenseur.`,
      gcf: `${name}, mèsi — mwen voye bay Bailleur-la pou ascenseur.`,
      en: `${name}, thank you — I’m sending this to the landlord for lift repair.`,
      pt: `${name}, obrigado — envio ao senhorio para reparar o elevador.`,
      es: `${name}, gracias — transmito al arrendador para el ascensor.`,
      hat: `${name}, mèsi — m ap voye bay pwopriyetè a pou ascenseur.`,
    });
  }
  if (kind === 'common_works') {
    return pick(lang, {
      fr: `${name}, merci — j’ai ce qu’il me faut. Je transmets au bailleur pour intervention sur les parties communes.`,
      gcf: `${name}, mèsi — mwen voye bay Bailleur-la pou pati komen.`,
      en: `${name}, thank you — I’m sending this to the landlord for common-area works.`,
      pt: `${name}, obrigado — envio ao senhorio para as partes comuns.`,
      es: `${name}, gracias — transmito al arrendador para zonas comunes.`,
      hat: `${name}, mèsi — m ap voye bay pwopriyetè a pou pati komen.`,
    });
  }
  return jarvisClosingGeneric(name, lang);
}

export function jarvisPlumbingPivot(lang: L): string {
  return pick(lang, {
    fr: ' Restons sur l’usage du point d’eau — mitigeur ou évacuation.',
    gcf: ' Ann nou wè si sé mitigè ou vidaj.',
    en: ' Let us focus on how you use the tap — supply or drain.',
    pt: ' Vamos focar no uso da torneira — entrada ou escoamento.',
    es: ' Centrémonos en el uso del grifo — entrada o desagüe.',
    hat: ' Ann nou konsantre sou itilizasyon tiyo a.',
  });
}

export function jarvisQuestionDoorHinge(lang: L): string {
  return pick(lang, {
    fr: 'Quand vous poussez la porte, frotte-t-elle en bas contre le sol, ou bloque-t-elle plutôt en haut du cadre ?',
    gcf: 'Lè ou pouse pòt-la, li frotté anba sou sol-la, ou li bloke anlè nan kad-la ?',
    en: 'When you push the door, does it rub at the bottom on the floor, or catch at the top of the frame?',
    pt: 'Quando empurra a porta, ela roça no chão em baixo ou prende no topo da moldura?',
    es: 'Al empujar la puerta, ¿roza abajo en el suelo o se atasca arriba en el marco?',
    hat: 'Lè ou pouse pòt la, èske li fwote anba sou tè a, ou bloke anlè nan kad la?',
  });
}

export function jarvisQuestionDoorLockClarify(lang: L): string {
  return pick(lang, {
    fr: 'La porte se ferme, mais la clé ne tourne pas — ou la porte elle-même ne ferme plus ?',
    gcf: 'Pòt-la fèmen, men kle-a pa vire — ou sé pòt-la menm ki pa fèmen ?',
    en: 'Does the door close but the key will not turn — or does the door itself no longer close?',
    pt: 'A porta fecha, mas a chave não gira — ou a porta já não fecha?',
    es: '¿La puerta cierra pero la llave no gira — o la puerta ya no cierra?',
    hat: 'Pòt la fèmen, men kle a pa vire — ou se pòt la menm ki pa fèmen?',
  });
}

export function jarvisQuestionPlumbingTiming(lang: L): string {
  return pick(lang, {
    fr: 'À quel moment l’eau apparaît-elle sous l’évier : en permanence, quand vous ouvrez l’eau, ou surtout quand l’évier se vide ?',
    gcf: 'A ki moman dlo parèt anba évier-la : tout tan, lè ou ouvè dlo-a, ou lè li vidé ?',
    en: 'When does water appear under the sink: all the time, when you turn the tap on, or mainly when the sink drains?',
    pt: 'Quando aparece água debaixo da pia: sempre, ao abrir a torneira ou ao escoar?',
    es: '¿Cuándo aparece el agua bajo el fregadero: siempre, al abrir el grifo o al vaciar?',
    hat: 'Ki lè dlo parèt anba evye a: tout tan, lè ou ouvri dlo a, ou lè li ap vidange?',
  });
}

export function jarvisQuestionPlumbingSupplyDrain(lang: L): string {
  return pick(lang, {
    fr: 'L’eau sort-elle surtout quand vous ouvrez le mitigeur, ou quand l’évier se vide (évacuation) ?',
    gcf: 'Lè ou ouvè mitigè-a évier-la vidé toujou, ou sé lè dlo ap koule épi li vidé ?',
    en: 'Does water appear mainly when you open the tap, or when the sink is draining?',
    pt: 'A água aparece sobretudo ao abrir a torneira ou quando a pia escoa?',
    es: '¿Sale agua sobre todo al abrir el grifo o al vaciar el fregadero?',
    hat: 'Èske dlo soti plis lè ou ouvri tiyo a, ou lè evye a ap vidange?',
  });
}

export function jarvisQuestionPlumbingPlug(lang: L): string {
  return pick(lang, {
    fr: 'Pouvez-vous mettre un bouchon dans l’évier, rouvrir l’eau, et me dire si ça fuit encore dessous ?',
    gcf: 'Ou ka mete yon bouchon nan évier-la, ouvè dlo-a, épi di m si li toujou koule anba ?',
    en: 'Can you plug the sink, run the tap, and tell me if it still leaks underneath?',
    pt: 'Pode tampar a pia, abrir a água e dizer se ainda há fuga por baixo?',
    es: '¿Puede tapar el fregadero, abrir el agua y decir si sigue goteando abajo?',
    hat: 'Èske ou ka bouch evye a, ouvri dlo a, epi di m si li toujou koule anba?',
  });
}

export function jarvisQuestionGeneric(lang: L): string {
  return pick(lang, {
    fr: 'Pouvez-vous préciser ce que vous observez, sans tout répéter ?',
    gcf: 'Ka ou di m plis sou sa ou wè, san repété tout ?',
    en: 'Can you tell me what you see, without repeating everything?',
    pt: 'Pode dizer o que observa, sem repetir tudo?',
    es: '¿Puede precisar lo que observa, sin repetir todo?',
    hat: 'Èske ou ka di m sa ou wè, san repete tout?',
  });
}

export function jarvisChainCompareQuestion(
  _labelA: string,
  _labelB: string,
  lang: L,
): string {
  return jarvisSignalUpstreamVsLocalQuestion(lang);
}

/** Amont vs local — formulation technicien (sans « visualiser » ni étiquettes internes). */
export function jarvisSignalUpstreamVsLocalQuestion(lang: L): string {
  return pick(lang, {
    fr: 'Pour cibler la panne : plutôt avant le logement (antenne, box, réseau), ou plutôt chez vous (câble, prise, décodeur) ?',
    gcf: 'Pou lokalize pan-an : plito anvan kay-la (antèn, box, rezo), ou plito lakay ou (fil, priz, décodeur) ?',
    en: 'To locate the fault: rather before your home (aerial, box, network), or at your place (cable, socket, decoder)?',
    pt: 'Para localizar: antes da fração (antena, box, rede) ou aí em casa (cabo, tomada, descodificador)?',
    es: 'Para localizar: ¿antes de la vivienda (antena, box, red) o en su casa (cable, toma, decodificador)?',
    hat: 'Pou jwenn kote pan an ye: anvan kay la (antèn, box, rezo) oswa lakay ou (fil, priz, dekòdè)?',
  });
}

export function jarvisChainScopeQuestion(lang: L): string {
  return pick(lang, {
    fr: 'Le problème touche tout le logement (ou toutes les prises / TV), ou seulement un seul endroit ?',
    gcf: 'Pwoblèm-lan afekte tout kay-la (ou tout priz / TV), ou sé yon sèl kote ?',
    en: 'Does the issue affect the whole home (or all outlets/TVs), or only one spot?',
    pt: 'O problema afeta toda a casa (ou todas as tomadas/TVs) ou só um ponto?',
    es: '¿El problema afecta toda la vivienda (o todas las tomas/TVs) o solo un punto?',
    hat: 'Èske pwoblèm nan afekte tout kay la, oswa yon sèl kote sèlman?',
  });
}

export function jarvisChainPivot(lang: L): string {
  return pick(lang, {
    fr: ' Je note votre réponse.',
    gcf: ' Mwen note sa ou di.',
    en: ' I note your answer.',
    pt: ' Anoto a sua resposta.',
    es: ' Tomo nota de su respuesta.',
    hat: ' Mwen note sa ou di.',
  });
}

export function jarvisSavoirCollectiveSignalQuestion(lang: L): string {
  return pick(lang, {
    fr: 'Chez vos voisins ou sur les autres logements du bâtiment, la TV fonctionne-t-elle ? Et l’éclairage des parties communes s’allume-t-il ?',
    gcf: 'Lakay vwazen ou ou lòt kay nan bâtiment-la, TV-la mache ? É éclairage kote komen yo mache ?',
    en: 'Do your neighbours or other homes in the building have TV? Does common-area lighting work?',
    pt: 'Os vizinhos ou outras frações têm TV? A iluminação das partes comuns funciona?',
    es: '¿Los vecinos u otras viviendas tienen TV? ¿Funciona la luz de zonas comunes?',
    hat: 'Vwazen ou ou lòt kay nan bilding la gen TV? Limyè kote komen yo mache?',
  });
}

export function jarvisSavoirStandaloneSignalQuestion(lang: L): string {
  return pick(lang, {
    fr: 'Avez-vous une autre TV ou une autre prise TV dans le logement — est-ce pareil ou seulement celle-ci ?',
    gcf: 'Ou gen yon lòt TV ou yon lòt priz TV an kay-la — sé menm bagay ou sé sèlman sa-a ?',
    en: 'Do you have another TV or TV outlet at home — same issue or only this one?',
    pt: 'Tem outra TV ou tomada de TV em casa — igual ou só esta?',
    es: '¿Tiene otra TV u otra toma en la vivienda — igual o solo esta?',
    hat: 'Ou gen yon lòt televizyon oswa priz TV lakay la — menm pwoblèm ou sèlman sa a?',
  });
}

export function jarvisSavoirFloorOrAboveQuestion(lang: L): string {
  return pick(lang, {
    fr: 'Pour situer le logement : vous êtes à quel étage, ou y a-t-il un locataire au-dessus de vous ?',
    gcf: 'Pou sitiye kay-la : ou sou ki etaj, ou gen yon locataire anlè ou ?',
    en: 'To place your home: which floor are you on, or is there a tenant above you?',
    pt: 'Para situar: em que andar está, ou há alguém acima?',
    es: 'Para situar: ¿en qué planta está, o hay alguien encima?',
    hat: 'Pou sitiye kay la: ou sou ki etaj, oswa gen yon moun anlè ou?',
  });
}

export function jarvisComprehensionEcho(fragments: string[], lang: L): string {
  if (!fragments.length) return '';
  const list = fragments.slice(0, 2).join(' ; ');
  return pick(lang, {
    fr: ` Je retiens : ${list}.`,
    gcf: ` Mwen kenbe : ${list}.`,
    en: ` I note: ${list}.`,
    pt: ` Registo: ${list}.`,
    es: ` Anoto: ${list}.`,
    hat: ` Mwen kenbe : ${list}.`,
  });
}

/** Relance locataire après dossier complet (délai, urgence, correction métier…). */
export function isPostIntakeFollowUpMessage(message: string, lastAck?: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return (
    isPostIntakeTimingQuestion(trimmed) ||
    isPostIntakeUrgent(trimmed) ||
    isPostIntakeSecurityOrOpen(trimmed) ||
    isPostIntakeWrongTradeRejection(trimmed, lastAck) ||
    /merci|ok|d.accord|entendu|bien recu/.test(normMsg(trimmed))
  );
}

export function isPostIntakeTimingQuestion(message: string): boolean {
  const t = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return /quand|delai|délai|combien de temps|viennent|venir|passage|passer|reagir|réagir|reagissent|réagissent|comptent|suivre|relance|attendre|attente/.test(
    t,
  ) && !/serrurier|cerrajero|serur/.test(t);
}

export function inferPostIntakeFollowUpKind(
  domain: string,
  title: string,
  description: string,
): PostIntakeFollowUpKind {
  if (domain === 'carpentry_door') return 'locksmith';
  if (domain === 'plumbing_sink') return 'plumbing';
  const ctx = normMsg(`${title} ${description}`);
  if (
    /perdu.*cl|cl[eé]s?.*perdu|perdus.*cl|perdu.*clef|clef.*perdu|lost.*key|key.*lost|ouvrir.*porte.*sans|sans.*cl[eé]/.test(
      ctx,
    )
  ) {
    return 'locksmith';
  }
  if (/ascenseur|cabine|monte.charge/.test(ctx)) return 'elevator';
  if (/cafard|punaise|rat|nuisible|parasite/.test(ctx)) return 'pests';
  if (/chauffage|radiateur/.test(ctx)) return 'heating';
  if (
    /\bhall sale\b|\bsale\b|\bsales\b|insalubre|odeur|poubelle|salete|salet|proprete|propreté|menage|ménage|nettoyage|salubrit/.test(
      ctx,
    ) &&
    /hall|couloir|escalier|partie commune|parties communes|cage/.test(ctx)
  ) {
    return 'cleaning_commons';
  }
  if (/escalier|marche|hall|couloir|partie commune|parties communes/.test(ctx)) {
    return 'common_works';
  }
  return 'generic';
}

/** Locataire corrige un mauvais métier évoqué par Jarvis (ex. serrurier sur un hall sale). */
export function isPostIntakeWrongTradeRejection(message: string, lastAck?: string): boolean {
  const t = normMsg(message);
  const rejectsTrade =
    /pas besoin|inutile|pas un serrurier|pas de serrurier|faux|erreur|pas ca|pas ça|mal compris|mauvais/.test(
      t,
    );
  if (!rejectsTrade) return false;
  if (/serrurier|cerrajero|serur|serralheiro/.test(t)) return true;
  return Boolean(lastAck && /serrurier|cerrajero|serur/.test(normMsg(lastAck)));
}

export function jarvisPostIntakeWrongTradeCorrection(
  name: string,
  lang: L,
  kind: PostIntakeFollowUpKind,
): string {
  if (kind === 'cleaning_commons') {
    return pick(lang, {
      fr: `${name}, vous avez raison — ici il s’agit de salubrité dans le hall et l’escalier, pas de serrurerie. Je corrige la note pour le bailleur : relancer le prestataire du ménage des parties communes, pas un serrurier.`,
      gcf: `${name}, ou gen rezon — isi sé salubrite nan hal ak escalier, pa serrurier. Mwen korije nòt-la pou Bailleur-la : relance prestataire netwayaj pati komen.`,
      en: `${name}, you’re right — this is about cleanliness in the hall and stairs, not a locksmith. I’m correcting the note for the landlord: follow-up with the common-area cleaning contractor.`,
      pt: `${name}, tem razão — trata-se da limpeza do hall e escadas, não de serralharia. Corrijo a nota ao senhorio: reactivar o prestador de limpeza das partes comuns.`,
      es: `${name}, tiene razón — se trata de la limpieza del hall y escaleras, no de cerrajería. Corrijo la nota al arrendador: relanzar al prestador de limpieza de zonas comunes.`,
      hat: `${name}, ou gen rezon — sa konsènan pwoprete nan hal ak eskalye, pa serur. M ap korije nòt la pou pwopriyetè a : relanse founisè netwayaj pati komen yo.`,
    });
  }
  return pick(lang, {
    fr: `${name}, merci de la précision — je corrige la note transmise au bailleur pour qu’elle corresponde bien à votre signalement.`,
    gcf: `${name}, mèsi pou presizyon-an — mwen korije nòt-la voye bay Bailleur-la.`,
    en: `${name}, thank you for clarifying — I’m correcting the note sent to the landlord to match your report.`,
    pt: `${name}, obrigado pelo esclarecimento — corrijo a nota enviada ao senhorio.`,
    es: `${name}, gracias por la precisión — corrijo la nota enviada al arrendador.`,
    hat: `${name}, mèsi pou presizyon an — m ap korije nòt la voye bay pwopriyetè a.`,
  });
}

export function jarvisPostIntakeTiming(
  name: string,
  lang: L,
  domain: string,
  title: string,
  description: string,
): string {
  const kind = inferPostIntakeFollowUpKind(domain, title, description);

  if (kind === 'locksmith') {
    return pick(lang, {
      fr: `${name}, je comprends — vous voulez surtout savoir quand le serrurier passera. Le bailleur organise l’intervention ; je ne peux pas fixer d’heure ici, mais votre relance est bien notée dans le dossier.`,
      gcf: `${name}, mwen konprann — ou vle konnen ki lè serrurier ap pase. Bailleur-la ap òganize ; mwen pa ka di èr isi, men relance ou anrejistre.`,
      en: `${name}, I understand — you mainly want to know when the locksmith will come. The landlord is arranging it; I cannot set a time here, but your follow-up is noted.`,
      pt: `${name}, compreendo — quer sobretudo saber quando o serralheiro virá. O senhorio organiza; não fixo hora aqui, mas a sua insistência fica registada.`,
      es: `${name}, entiendo — quiere saber sobre todo cuándo vendrá el cerrajero. El arrendador lo organiza; no fijo hora aquí, pero su insistencia queda anotada.`,
      hat: `${name}, mwen konprann — ou vle konnen ki lè serur ap vini. Pwopriyetè a ap òganize ; m pa ka fikse lè isit, men relans ou anrejistre.`,
    });
  }

  if (kind === 'plumbing') {
    return pick(lang, {
      fr: `${name}, je comprends — vous attendez surtout le passage du plombier. Le bailleur organise l’intervention ; je ne peux pas fixer d’heure ici, mais votre relance est bien transmise.`,
      gcf: `${name}, mwen konprann — ou tann plombier-la. Bailleur-la ap òganize ; mwen pa ka di èr isi, men relance ou voye.`,
      en: `${name}, I understand — you’re mainly waiting for the plumber. The landlord is arranging it; I cannot set a time here, but your follow-up is sent.`,
      pt: `${name}, compreendo — aguarda sobretudo o canalizador. O senhorio organiza; não fixo hora aqui, mas a relance foi enviada.`,
      es: `${name}, entiendo — espera sobre todo al fontanero. El arrendador lo organiza; no fijo hora aquí, pero su insistencia se transmite.`,
      hat: `${name}, mwen konprann — ou tann plombriye a. Pwopriyetè a ap òganize ; m pa ka fikse lè isit, men relans ou voye.`,
    });
  }

  if (kind === 'cleaning_commons') {
    return pick(lang, {
      fr: `${name}, je comprends votre question — « quand est-ce qu’ils comptent réagir », c’est surtout : quand le bailleur va donner suite à votre signalement, et quand le prestataire du ménage des parties communes repassera pour nettoyer le hall et l’escalier. Ce n’est pas une intervention de serrurerie ou de plomberie : c’est la salubrité du bâtiment. Je note pour le bailleur qu’il faut relancer ce prestataire ; je ne peux pas fixer de date ici, mais votre relance est bien transmise.`,
      gcf: `${name}, mwen konprann kesyon ou — « ki lè yo ap reponn », sé surtout : ki lè Bailleur-la ap swiv siyalman ou, é ki lè prestataire netwayaj pati komen ap repase pou netwaye hal ak escalier. Pa serrurier ni plombier : sé salubrite bilding-la. Mwen make pou Bailleur-la relanse prestataire-a ; mwen pa ka di dat isi, men relance ou voye.`,
      en: `${name}, I understand your question — “when will they react” mainly means: when the landlord will follow up on your report, and when the common-area cleaning contractor will return for the hall and stairs. This is not locksmith or plumbing work — it is building cleanliness. I note for the landlord to chase that contractor; I cannot set a date here, but your follow-up is sent.`,
      pt: `${name}, compreendo a sua pergunta — « quando vão reagir » significa sobretudo: quando o senhorio dará seguimento e quando o prestador de limpeza das partes comuns voltará ao hall e escadas. Não é serralharia nem canalização — é salubridade do edifício. Registo para reactivar esse prestador; não fixo data aqui, mas a sua insistência foi enviada.`,
      es: `${name}, entiendo su pregunta — « cuándo van a reaccionar » significa sobre todo: cuándo el arrendador dará seguimiento y cuándo volverá el prestador de limpieza de zonas comunes al hall y escaleras. No es cerrajería ni fontanería — es salubridad del edificio. Anoto relanzar a ese prestador; no fijo fecha aquí, pero su insistencia se transmite.`,
      hat: `${name}, mwen konprann kesyon ou — « ki lè yo ap reponn », se plis : ki lè pwopriyetè a ap swiv siyalman ou, é ki lè founisè netwayaj pati komen ap repase pou netwaye hal ak eskalye. Se pa serur ni plonriye — se pwoprete bilding la. M ap make pou relanse founisè a ; m pa ka fikse dat isit, men relans ou voye.`,
    });
  }

  if (kind === 'heating') {
    return pick(lang, {
      fr: `${name}, je comprends — vous attendez surtout une réaction du bailleur sur le chauffage. Je le relève dans le dossier pour accélérer la prise en charge ; je ne peux pas fixer de date ici.`,
      gcf: `${name}, mwen konprann — ou tann Bailleur-la sou chofaj. Mwen make sa nan dosye-a ; mwen pa ka di dat isi.`,
      en: `${name}, I understand — you’re mainly waiting for the landlord to act on the heating. I flag it in the file; I cannot set a date here.`,
      pt: `${name}, compreendo — aguarda a reacção do senhorio sobre o aquecimento. Registo no processo; não fixo data aqui.`,
      es: `${name}, entiendo — espera la reacción del arrendador sobre la calefacción. Lo anoto en el expediente; no fijo fecha aquí.`,
      hat: `${name}, mwen konprann — ou tann pwopriyetè a sou chofaj. M ap make sa nan dosye a ; m pa ka fikse dat isit.`,
    });
  }

  if (kind === 'pests') {
    return pick(lang, {
      fr: `${name}, je comprends — vous voulez savoir quand le bailleur fera traiter le logement. Je relance la demande dans le dossier ; je ne peux pas fixer de date ici.`,
      gcf: `${name}, mwen konprann — ou vle konnen ki lè Bailleur-la ap fè tretman-an. Mwen relanse nan dosye-a ; mwen pa ka di dat isi.`,
      en: `${name}, I understand — you want to know when the landlord will arrange treatment. I chase it in the file; I cannot set a date here.`,
      pt: `${name}, compreendo — quer saber quando o senhorio tratará o problema. Registo a insistência; não fixo data aqui.`,
      es: `${name}, entiendo — quiere saber cuándo tratará el arrendador el problema. Relanzo en el expediente; no fijo fecha aquí.`,
      hat: `${name}, mwen konprann — ou vle konnen ki lè pwopriyetè a ap fè tretman an. M ap relanse nan dosye a ; m pa ka fikse dat isit.`,
    });
  }

  if (kind === 'elevator') {
    return pick(lang, {
      fr: `${name}, je comprends — vous attendez surtout la remise en service de l’ascenseur. Je relève l’urgence dans le dossier pour le bailleur ; je ne peux pas fixer de date ici.`,
      gcf: `${name}, mwen konprann — ou tann ascenseur-la remete an sèvis. Mwen make sa nan dosye-a ; mwen pa ka di dat isi.`,
      en: `${name}, I understand — you’re mainly waiting for the lift to be fixed. I flag it for the landlord; I cannot set a date here.`,
      pt: `${name}, compreendo — aguarda a reparação do elevador. Registo no processo; não fixo data aqui.`,
      es: `${name}, entiendo — espera la reparación del ascensor. Lo anoto al arrendador; no fijo fecha aquí.`,
      hat: `${name}, mwen konprann — ou tann yo repare ascenseur la. M ap make sa nan dosye a ; m pa ka fikse dat isit.`,
    });
  }

  if (kind === 'common_works') {
    return pick(lang, {
      fr: `${name}, je comprends — vous voulez savoir quand le bailleur interviendra sur les parties communes (escalier, hall). Je note la relance dans le dossier ; je ne peux pas fixer de date ici.`,
      gcf: `${name}, mwen konprann — ou vle konnen ki lè Bailleur-la ap entervni sou pati komen. Mwen make relance nan dosye-a ; mwen pa ka di dat isi.`,
      en: `${name}, I understand — you want to know when the landlord will act on the common areas (stairs, hall). I note the follow-up; I cannot set a date here.`,
      pt: `${name}, compreendo — quer saber quando o senhorio intervirá nas partes comuns. Registo a insistência; não fixo data aqui.`,
      es: `${name}, entiendo — quiere saber cuándo intervendrá el arrendador en las zonas comunes. Anoto la insistencia; no fijo fecha aquí.`,
      hat: `${name}, mwen konprann — ou vle konnen ki lè pwopriyetè a ap aji sou pati komen yo. M ap make relans lan nan dosye a ; m pa ka fikse dat isit.`,
    });
  }

  return pick(lang, {
    fr: `${name}, je comprends — vous attendez surtout une réaction du bailleur et un retour sur la suite. Je le relève dans le dossier déjà transmis ; je ne peux pas fixer de date ici.`,
    gcf: `${name}, mwen konprann — ou tann Bailleur-la reponn. Mwen make sa nan dosye-a deja voye ; mwen pa ka di dat isi.`,
    en: `${name}, I understand — you’re mainly waiting for the landlord to respond. I flag it in the file already sent; I cannot set a date here.`,
    pt: `${name}, compreendo — aguarda a reacção do senhorio. Registo no processo já enviado; não fixo data aqui.`,
    es: `${name}, entiendo — espera la respuesta del arrendador. Lo anoto en el expediente ya enviado; no fijo fecha aquí.`,
    hat: `${name}, mwen konprann — ou tann pwopriyetè a reponn. M ap make sa nan dosye a deja voye ; m pa ka fikse dat isit.`,
  });
}

function normMsg(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isPostIntakeUrgent(message: string): boolean {
  const t = normMsg(message);
  return /urgent|urgence|vite|rapid|priorit|assez vite|trop long|tout de suite/.test(t);
}

export function isPostIntakeSecurityOrOpen(message: string): boolean {
  const t = normMsg(message);
  return (
    /ouvert|ouverte|logement reste|reste ouvert|ne ferme pas|pas ferm|securit|enfant|nuit|intrus|dehors|verrouill|acces|accès/.test(
      t,
    ) && !/quand|delai|délai/.test(t)
  );
}

export function jarvisPostIntakeUrgentOpen(
  name: string,
  lang: L,
  domain: string,
): string {
  if (domain === 'carpentry_door') {
    return pick(lang, {
      fr: `${name}, j’entends l’urgence — logement difficile à sécuriser. Je signale en priorité au bailleur pour une intervention serrurerie au plus vite. Restez joignable ; si vous le pouvez, ne laissez pas la porte sans surveillance en attendant.`,
      gcf: `${name}, mwen tande ijan-an — kay-la difisil pou sekirize. Mwen ka alèt Bailleur-la an priyorite pou yon serrurier vit. Rete disponib ; pa kite pòt-la san siveyans si ou kapab.`,
      en: `${name}, I hear the urgency — securing the home is difficult. I am flagging this as priority to the landlord for a locksmith as soon as possible. Stay reachable; if you can, do not leave the door unsupervised.`,
      pt: `${name}, percebo a urgência — difícil proteger a habitação. Sinalizo prioridade ao senhorio para serralheiro o mais rápido possível. Mantenha-se contactável.`,
      es: `${name}, entiendo la urgencia — difícil asegurar la vivienda. Lo marco prioritario al arrendador para cerrajero cuanto antes. Manténgase localizable.`,
      hat: `${name}, mwen tande ijan an — difisil sekirize kay la. M ap make sa priyorite bay pwopriyetè a pou serur vit. Rete disponib.`,
    });
  }
  return pick(lang, {
    fr: `${name}, j’entends l’urgence. Je signale en priorité au bailleur — restez joignable, on revient vers vous rapidement.`,
    gcf: `${name}, mwen tande ijan-an. Mwen ka alèt Bailleur-la an priyorite — rete disponib.`,
    en: `${name}, I hear the urgency. I am flagging priority to the landlord — please stay reachable.`,
    pt: `${name}, percebo a urgência. Sinalizo prioridade ao senhorio — mantenha-se contactável.`,
    es: `${name}, entiendo la urgencia. Lo marco prioritario al arrendador — manténgase localizable.`,
    hat: `${name}, mwen tande ijan an. M ap make priyorite bay pwopriyetè a — rete disponib.`,
  });
}

export function jarvisPostIntakeNoteAdded(name: string, lang: L): string {
  return pick(lang, {
    fr: `${name}, merci — j’ajoute cette précision à votre dossier déjà transmis au bailleur.`,
    gcf: `${name}, mèsi — mwen ajoute presizyon-an nan dosye ou deja voye bay Bailleur-la.`,
    en: `${name}, thank you — I am adding this detail to your case already sent to the landlord.`,
    pt: `${name}, obrigado — acrescento este detalhe ao processo já enviado ao senhorio.`,
    es: `${name}, gracias — añado este detalle a su expediente ya enviado al arrendador.`,
    hat: `${name}, mèsi — m ap ajoute presizyon sa nan dosye ou deja voye.`,
  });
}

export function jarvisPostIntakeEscalation(
  name: string,
  lang: L,
  domain: string,
): string {
  if (domain === 'carpentry_door') {
    return pick(lang, {
      fr: `${name}, votre message est bien remonté en priorité côté bailleur pour la serrurerie. Je ne peux pas fixer l’heure ici, mais le dossier reste actif — tenez votre téléphone à portée de main.`,
      gcf: `${name}, mesaj ou monte an priyorite pou Bailleur-la pou serrurier. Mwen pa ka di èr isi, men dosye-a toujou aktif — kenbe telefòn ou pre.`,
      en: `${name}, your message is escalated as priority to the landlord for locksmith work. I cannot set a time here, but the case stays active — keep your phone handy.`,
      pt: `${name}, a sua mensagem foi escalada em prioridade ao senhorio para serralharia. Não posso fixar hora aqui — mantenha o telefone à mão.`,
      es: `${name}, su mensaje queda en prioridad al arrendador para cerrajería. No puedo fijar hora aquí — tenga el teléfono a mano.`,
      hat: `${name}, mesaj ou monte an priyorite pou pwopriyetè a. M pa ka fikse lè isit — kenbe telefòn ou pre.`,
    });
  }
  return jarvisPostIntakeNoteAdded(name, lang);
}

/** Réponse adaptée après transmission du dossier (pas de copier-coller systématique). */
export function buildPostIntakeReply(params: {
  message: string;
  name: string;
  lang: L;
  domain: string;
  title?: string;
  description?: string;
  lastAck?: string;
}): string {
  const trimmed = params.message.trim();
  const name = params.name.trim() || 'Bonjour';
  const title = params.title ?? '';
  const description = params.description ?? '';
  if (!trimmed) {
    return jarvisPostIntakeNoteAdded(name, params.lang);
  }

  const followUpKind = inferPostIntakeFollowUpKind(params.domain, title, description);

  let reply: string;
  if (isPostIntakeWrongTradeRejection(trimmed, params.lastAck)) {
    reply = jarvisPostIntakeWrongTradeCorrection(name, params.lang, followUpKind);
  } else if (isPostIntakeTimingQuestion(trimmed)) {
    reply = jarvisPostIntakeTiming(name, params.lang, params.domain, title, description);
  } else if (isPostIntakeUrgent(trimmed) || isPostIntakeSecurityOrOpen(trimmed)) {
    reply = jarvisPostIntakeUrgentOpen(name, params.lang, params.domain);
  } else if (/merci|ok|d.accord|entendu|bien recu/.test(normMsg(trimmed))) {
    reply = pick(params.lang, {
      fr: `${name}, avec plaisir. Le bailleur a votre dossier ; on revient vers vous.`,
      gcf: `${name}, avèk plezi. Bailleur-la gen dosye ou ; yo ap kontakte ou.`,
      en: `${name}, you’re welcome. The landlord has your file; they will be in touch.`,
      pt: `${name}, de nada. O senhorio tem o seu processo; entrarão em contacto.`,
      es: `${name}, de nada. El arrendador tiene su expediente; le contactarán.`,
      hat: `${name}, avèk plezi. Pwopriyetè a gen dosye ou.`,
    });
  } else {
    reply = jarvisPostIntakeNoteAdded(name, params.lang);
  }

  if (params.lastAck && reply === params.lastAck) {
    return jarvisPostIntakeEscalation(name, params.lang, params.domain);
  }
  return reply;
}

/** Signalement initial évoque surtout serrure / clé / pêne. */
export function signalementSuggestsDoorLock(ctx: string): boolean {
  const t = ctx.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (/porte.*bloqu|bloqu.*porte|porte.*coinc|coinc.*porte/.test(t)) {
    return true;
  }
  return (
    /pe[cç]ne|gache|gâche|serrure|verrouill|targette|cl[eé]s?\b|clef/.test(t) &&
    /rentre pas|accroch|tourner|verrouill|bloqu.*cl|clé.*coinc|ne ferme plus/.test(t)
  );
}
