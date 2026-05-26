import { Injectable } from '@nestjs/common';
import { LiaHostService } from './lia-host.service';
import type { CompanionLanguage } from './lia-companion.types';
import type { LiaIntakeState } from '../intake/lia-intake.service';
import {
  detectLanguageFromTenantText,
  isTenantLanguageGreeting,
  resolveLanguageFromGreeting,
} from '../../shared/lia-tenant-language';
import {
  extractPlumbingIntakeFromText,
  isPlumbingSinkLeakSaturated,
} from '../intake/lia-intake-plumbing-extract';
import {
  extractCarpentryIntakeFromText,
  buildCarpentryExpertAcknowledgment,
  isCarpentryDoorIssueSaturated,
} from '../intake/lia-intake-carpentry-extract';
import { isJarvisReadyForImmediateVerdict } from '../intake/lia-jarvis-intake.engine';
import {
  landlordHandoffStatus,
  type LiaMessageUiStatus,
} from './lia-message-ui-status';

export interface ExpertPocketReply {
  text: string;
  language: CompanionLanguage;
  uiStatus?: LiaMessageUiStatus;
}

const EXPERT_POCKET_SYSTEM = [
  'Tu es Lia, technicienne logement en Guyane — « Expert de poche ».',
  'Ton : bienveillant, sérieux, rassurant. Tu résous le problème, pas secrétaire.',
  'Règles : ne redemande jamais ce qui est déjà dit ; une seule question si critique ; pas de jargon.',
  'Si le locataire écrit en créole (kréyòl), réponds UNIQUEMENT en créole guadeloupéen (gcf).',
  'Sinon français simple.',
  'Pas de JSON. 2 à 4 phrases maximum.',
].join('\n');

@Injectable()
export class LiaExpertPocketService {
  constructor(private readonly host: LiaHostService) {}

  resolveLanguage(
    message: string,
    title: string,
    description: string,
    state?: LiaIntakeState,
  ): CompanionLanguage {
    if (message.trim()) {
      return detectLanguageFromTenantText(
        message,
        title,
        description,
        state?.intakeTitle,
        state?.intakeDescription,
      );
    }
    if (isTenantLanguageGreeting(message)) {
      return resolveLanguageFromGreeting(message);
    }
    return detectLanguageFromTenantText(
      title,
      description,
      state?.intakeTitle,
      state?.intakeDescription,
    );
  }

  /** Accueil métier après lecture du signalement (remplace le paragraphe générique eau/fuite). */
  buildOpeningAck(params: {
    tenantFirstName?: string;
    title: string;
    description: string;
    state: LiaIntakeState;
  }): ExpertPocketReply | null {
    const lang = this.resolveLanguage(
      '',
      params.title,
      params.description,
      params.state,
    );
    const name = params.tenantFirstName?.trim() || (lang === 'gcf' ? 'Bonjou' : 'Bonjour');
    const full = `${params.title} ${params.description}`;

    if (
      params.state.category === 'PLUMBING' &&
      isPlumbingSinkLeakSaturated(params.state)
    ) {
      const ex = extractPlumbingIntakeFromText(
        params.title,
        params.description,
      );
      if (lang === 'gcf') {
        return {
          language: 'gcf',
          text:
            `${name}, mwen wel sa : dlo anba lavabo, bokit deja la. ` +
            (ex.newTenant
              ? 'Paske ou fèk antre, mwen ka alèt Bailleur-la pou verifye evacuasyon an. '
              : 'Mwen ka alèt Bailleur-la pou yon teknisyen verifye sa. ') +
            'Dlo a toujou koule anpil malgre bokit-la ?',
          uiStatus: landlordHandoffStatus('gcf'),
        };
      }
      return {
        language: 'fr',
        text:
          `${name}, j’ai bien noté pour l’évier et le seau, merci d’avoir limité les dégâts. ` +
          (ex.newTenant
            ? 'Comme vous venez d’emménager, je transmets l’alerte au bailleur pour vérifier l’évacuation. '
            : 'Je transmets l’alerte au bailleur pour qu’un technicien vérifie l’évacuation. ') +
          'Est-ce que l’eau coule encore beaucoup malgré le seau ?',
        uiStatus: landlordHandoffStatus('fr'),
      };
    }

    if (isCarpentryDoorIssueSaturated(params.state)) {
      return {
        language: 'fr',
        text: buildCarpentryExpertAcknowledgment({
          title: params.title,
          description: params.description,
          answers: params.state.answers,
          jarvisFacts: params.state.jarvisFacts,
          tenantFirstName: params.tenantFirstName,
        }),
        uiStatus: landlordHandoffStatus('fr'),
      };
    }

    if (/fuite|eau|coule|lavabo|évier|evier/i.test(full)) {
      if (lang === 'gcf') {
        return {
          language: 'gcf',
          text:
            `${name}, mwen wel yon pwoblèm dlo / fuit. Si dlo a toujou koule, ` +
            'mete yon bokit epi koupe dlo a si ou konnen ki kote. Mwen pran dosye a an men.',
        };
      }
      return {
        language: 'fr',
        text:
          `${name}, j’ai noté un problème d’eau ou de fuite. Si l’eau coule encore, ` +
          'limitez les dégâts (seau, couper l’arrivée d’eau si vous savez le faire). Je prends le dossier en main.',
      };
    }

    return null;
  }

  /** Réponse naturelle à un message locataire (intake / fil). */
  async buildReply(params: {
    tenantFirstName?: string;
    title: string;
    description: string;
    message: string;
    state: LiaIntakeState;
  }): Promise<ExpertPocketReply> {
    const lang = this.resolveLanguage(
      params.message,
      params.title,
      params.description,
      params.state,
    );
    const name = params.tenantFirstName?.trim() || (lang === 'gcf' ? 'Bonjou' : 'Bonjour');

    const templated = this.templateReply(
      { ...params, tenantFirstName: params.tenantFirstName },
      lang,
      name,
    );
    if (templated) return templated;

    const llm = await this.host.chatStructured(
      EXPERT_POCKET_SYSTEM,
      JSON.stringify({
        language: lang,
        tenantFirstName: name,
        category: params.state.category,
        signalement: `${params.title} ${params.description}`,
        message: params.message.slice(0, 800),
        dejaAcquis: {
          answers: params.state.answers,
          jarvisFacts: params.state.jarvisFacts ?? {},
        },
        phase: params.state.phase,
      }),
      280,
    );
    if (llm) {
      return {
        language: lang,
        text: llm.replace(/^["']|["']$/g, '').trim(),
      };
    }

    return {
      language: lang,
      text:
        lang === 'gcf'
          ? `${name}, mèsi — mwen pran sa an kont. Mwen pa bezwen fè ou repete.`
          : `${name}, merci — c’est bien pris en compte, je ne vous fais pas répéter.`,
    };
  }

  private templateReply(
    params: {
      message: string;
      title: string;
      description: string;
      state: LiaIntakeState;
      tenantFirstName?: string;
    },
    lang: CompanionLanguage,
    name: string,
  ): ExpertPocketReply | null {
    const msg = params.message;
    const full = `${params.title} ${params.description} ${msg}`;
    const urgent =
      /vit|urgent|anpil|beaucoup|inond|press/i.test(msg) ||
      /vit|anpil/i.test(full);

    if (
      params.state.category === 'PLUMBING' &&
      urgent &&
      /lavabo|evier|évier|dlo|fuit|eau|bokit/i.test(full)
    ) {
      if (lang === 'gcf') {
        return {
          language: 'gcf',
          text:
            `${name}, mwen konprann i pressé — bokit la deja la, mwen wel sa. ` +
            'Mwen ka alèt Bailleur-la touswit pou yon teknisyen. Dlo a toujou koule anpil ?',
          uiStatus: landlordHandoffStatus('gcf'),
        };
      }
      return {
        language: 'fr',
        text:
          `${name}, je comprends l’urgence — le seau est en place, c’est noté. ` +
          'J’alerte le bailleur tout de suite pour qu’un technicien intervienne. L’eau coule encore fort ?',
        uiStatus: landlordHandoffStatus('fr'),
      };
    }

    if (
      params.state.category === 'PLUMBING' &&
      (isPlumbingSinkLeakSaturated(params.state) ||
        isJarvisReadyForImmediateVerdict(params.state))
    ) {
      const ex = extractPlumbingIntakeFromText(
        params.title,
        params.description,
        msg,
      );
      if (/vit|urgent|anpil|beaucoup|inond/i.test(msg.toLowerCase())) {
        if (lang === 'gcf') {
          return {
            language: 'gcf',
            text:
              `${name}, mwen konprann i pressé — bokit la deja la, mwen wel sa. ` +
              'Mwen ka alèt Bailleur-la touswit pou yon teknisyen. Dlo a toujou koule anpil ?',
            uiStatus: landlordHandoffStatus('gcf'),
          };
        }
        return {
          language: 'fr',
          text:
            `${name}, je comprends l’urgence — le seau est en place, c’est noté. ` +
            'J’alerte le bailleur tout de suite pour qu’un technicien intervienne. L’eau coule encore fort ?',
          uiStatus: landlordHandoffStatus('fr'),
        };
      }
      if (lang === 'gcf' && (ex.underFixtureLeak || ex.newTenant)) {
        return {
          language: 'gcf',
          text:
            `${name}, mwen wel dlo anba lavabo${ex.newTenant ? ' depi ou antre' : ''}. ` +
            'Mwen ka alèt Bailleur-la. Dlo a toujou koule anpil ?',
          uiStatus: landlordHandoffStatus('gcf'),
        };
      }
    }

    if (
      /avez[- ]?vous (bien )?(compris|sa)|de quoi vous|comprenez/i.test(
        msg.toLowerCase(),
      )
    ) {
      if (isCarpentryDoorIssueSaturated(params.state)) {
        return {
          language: 'fr',
          text: buildCarpentryExpertAcknowledgment({
            title: params.title,
            description: params.description,
            answers: params.state.answers,
            jarvisFacts: params.state.jarvisFacts,
            tenantFirstName: params.tenantFirstName,
          }),
          uiStatus: landlordHandoffStatus('fr'),
        };
      }
    }

    if (isCarpentryDoorIssueSaturated(params.state)) {
      return {
        language: 'fr',
        text: buildCarpentryExpertAcknowledgment({
          title: params.title,
          description: params.description,
          answers: params.state.answers,
          jarvisFacts: params.state.jarvisFacts,
          tenantFirstName: params.tenantFirstName,
        }),
        uiStatus: landlordHandoffStatus('fr'),
      };
    }

    if (
      /camera|appareil photo|photo.*(fonctionne|marche)|galerie/i.test(
        msg.toLowerCase(),
      )
    ) {
      if (lang === 'gcf') {
        return {
          language: 'gcf',
          text:
            `${name}, ok pou kamera — itilize bouton Galeri si ou ni foto, sinon mwen lanse analiz ak sa ou di deja.`,
        };
      }
      return {
        language: 'fr',
        text:
          `${name}, c’est noté pour l’appareil photo. Utilisez « Galerie » si vous avez une image, sinon je lance l’analyse avec votre description.`,
      };
    }

    return null;
  }
}
