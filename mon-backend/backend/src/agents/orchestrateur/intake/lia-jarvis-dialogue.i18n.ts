import type { CompanionLanguage } from '../conversation/lia-companion.types';

type L = CompanionLanguage;

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

export function isPostIntakeTimingQuestion(message: string): boolean {
  const t = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return /quand|delai|délai|combien de temps|viennent|venir|passage|passer|serrurier|technicien|intervenir|rdv|rendez|attendre|attente/.test(
    t,
  );
}

export function jarvisPostIntakeTiming(name: string, lang: L): string {
  return pick(lang, {
    fr: `${name}, le bailleur organise l’intervention — un serrurier vous recontactera pour convenir d’un passage. Je ne peux pas donner d’heure précise ici, mais votre dossier est bien enregistré.`,
    gcf: `${name}, Bailleur-la ap òganize entèvansyon-an — yon serrurier ap kontakte ou pou fikse yon randevou. Mwen pa ka di èr egzak isi, men dosye ou anrejistre.`,
    en: `${name}, the landlord is arranging the visit — a locksmith will contact you to schedule a time. I cannot give an exact hour here, but your case is registered.`,
    pt: `${name}, o senhorio está a organizar a intervenção — um serralheiro contactará para marcar uma visita. Não tenho hora exacta aqui, mas o seu caso está registado.`,
    es: `${name}, el arrendador organiza la intervención — un cerrajero le contactará para una cita. No tengo hora exacta aquí, pero su expediente está registrado.`,
    hat: `${name}, pwopriyetè a ap òganize entèvansyon an — yon serur ap kontakte ou. M pa ka bay lè egzak isit, men dosye ou anrejistre.`,
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
  lastAck?: string;
}): string {
  const trimmed = params.message.trim();
  const name = params.name.trim() || 'Bonjour';
  if (!trimmed) {
    return jarvisPostIntakeNoteAdded(name, params.lang);
  }

  let reply: string;
  if (isPostIntakeTimingQuestion(trimmed)) {
    reply = jarvisPostIntakeTiming(name, params.lang);
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
  return (
    /pe[cç]ne|gache|gâche|serrure|verrouill|targette|cl[eé]s?\b|clef/.test(t) &&
    /rentre pas|accroch|tourner|verrouill|bloqu.*cl|clé.*coinc|ne ferme plus/.test(t)
  );
}
