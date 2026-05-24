/**
 * Messages bailleur plomberie — selon le poste réellement détecté (pas un texte douche générique).
 */
import {
  isEmbeddedPlumbing,
  isShowerInaccessibleDrain,
} from './lia-plumbing-rules';

export function buildPlumbingBailleurMessage(contextText: string): string {
  if (isShowerInaccessibleDrain(contextText)) {
    return (
      'Le problème concerne l’évacuation ou le siphon sous la douche (souvent sans trappe d’accès). ' +
      'Cette réparation relève du bailleur. Un agent va vous recontacter.'
    );
  }
  if (isEmbeddedPlumbing(contextText)) {
    return (
      'Le problème concerne une canalisation encastrée ou le réseau fixe du logement. ' +
      'Cette intervention relève du bailleur. Un agent va vous recontacter.'
    );
  }
  return (
    'Le problème de plomberie relève du bailleur (réseau ou installation fixe). ' +
    'Un agent va vous recontacter.'
  );
}
