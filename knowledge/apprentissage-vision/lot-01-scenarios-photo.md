# Apprentissage vision Grock — Scénarios de test avec photo

> **But** : chaque fiche associe une **photo réelle** de terrain (Guyane, bailleur social) à
> des **formulations locataire** variées + le **comportement attendu de Grock**.
> On compare ensuite ce que Grock produit réellement à l'attendu → apprentissage.
>
> **Conventions** (Loi Suprême N7) :
> - Libellés génériques : pas de nom d'organisme ni d'adresse réelle (anonymisés en `[résidence]`, `[bât.]`).
> - Le comportement attendu suit les invariants : **INV1** « preuve avant conclusion » (sondage photo si besoin),
>   **INV2** « la parole vient de Grock », **sécurité d'abord** si danger.
> - Responsabilité : `BAILLEUR` (structure, réseaux, parties communes) / `LOCATAIRE` (usage, entretien courant) /
>   `SINISTRE` (dégât actif / assurance) / `TIERS` (voisin, dégradation volontaire).
>
> **Source photos** : `D:/Users/ewald/Documents/image test locataire/` (2665 fichiers, traités par lots).
> Ce fichier = **Lot 01** (9 scénarios).

---

## Taxonomie visée (pour couvrir le métier)

| Famille | Exemples | Charge type |
|---|---|---|
| Humidité / infiltration façade | mousse, cloquage, auréole | BAILLEUR |
| Électricité | tableau, prise, minuterie partie commune | BAILLEUR / LOCATAIRE |
| Plomberie / sanitaire | lavabo, baignoire, joint, fuite | selon origine |
| Parties communes | hall, coursive, porte palière, parking | BAILLEUR |
| Sinistre grave | incendie, dégât des eaux actif | SINISTRE |
| Usage / entretien locataire | encombrement, salissure, ampoule | LOCATAIRE |
| Administratif | bon de travaux, étiquette inventaire | (hors diagnostic) |

---

## LOT-01-01 · Façade extérieure — mousse + cloquage peinture (humidité tropicale)

![façade humidité](D:/Users/ewald/Documents/image%20test%20locataire/20220913_142400.jpg)

- **Fichier** : `20220913_142400.jpg`
- **Ce que je vois** : mur extérieur crème sous un débord de toiture tôle ; **peinture qui cloque et s'écaille**
  au-dessus et autour d'une fenêtre à jalousies (persiennes) ; **traînées de mousse/algues vertes** partant du haut
  du mur (ruissellement d'eau de pluie récurrent). Grille de défense métallique.
- **Localisation** : **partie commune / enveloppe du bâtiment** (mur extérieur, sous rive de toiture).
- **Pathologie tropicale** : ruissellement + humidité permanente → développement biologique (algues) + décollement
  du film de peinture. Classique climat équatorial (forte pluie, hygrométrie).
- **Responsabilité attendue** : **BAILLEUR** (façade / enveloppe / étanchéité de rive).
- **Comportement Grock attendu** :
  - Pas de danger immédiat → pas de consigne sécurité.
  - Origine claire (enveloppe extérieure) → peut **conclure BAILLEUR** ; une **photo large** de la rive de toiture
    peut être demandée (INV1) pour confirmer l'origine (gouttière/rive vs remontée).
  - `note_interne` : ruissellement de rive, reprise étanchéité + traitement anti-mousse + réfection peinture façade.

**10 formulations locataire :**
1. « Le mur dehors, à côté de ma fenêtre, la peinture s'écaille et il y a du vert qui coule. »
2. « Bonjour, façade abîmée : peinture qui gonfle et moisissure verte au-dessus de la fenêtre. »
3. (court) « mur extérieur moisi »
4. (paniqué) « C'est plein de moisissure dehors, ça va rentrer chez moi ??? »
5. (familier) « Eh, le mur dehors il est tout pourri, la peinture part en morceaux. »
6. (créole guyanais) « Miray déwò-a ka moizi, laptenti-a ka détaché. »
7. (SMS) « bjr mur exterieur peinture parti + traces vertes fenetre »
8. (très détaillé) « Sur le mur extérieur, sous la tôle du toit, la peinture cloque sur environ 1 m² et il y a des coulures vertes qui descendent depuis le haut, surtout quand il a plu. »
9. (minimisant) « C'est pas urgent mais le mur dehors se dégrade un peu. »
10. (personne âgée) « Mon fils, dehors le mur perd sa peinture et c'est tout verdâtre, je ne sais pas quoi faire. »

---

## LOT-01-02 · Tableau électrique — disjoncteurs / différentiels

![tableau électrique](D:/Users/ewald/Documents/image%20test%20locataire/20230619_085843.jpg)

- **Fichier** : `20230619_085843.jpg`
- **Ce que je vois** : **tableau de répartition** avec 2 **interrupteurs différentiels 30 mA / 40 A** (Type A et Type AC)
  et disjoncteurs Legrand (C32 ALIM FOUR, C20 CHAUFFE-EAU, C16 PRISE, C10 ÉCLAIRAGE…). Étiquettes de repérage
  collées. Plâtre légèrement dégradé derrière le peigne.
- **Localisation** : intérieur logement (GTL / tableau).
- **Responsabilité attendue** : dépend du symptôme réel — l'image seule est **saine**. Sert de contexte pour un
  signalement « ça disjoncte ».
- **Comportement Grock attendu** :
  - Si le locataire dit « ça saute » → **sonder** (quel disjoncteur ? se réarme ? un appareil précis ?) avant de conclure (INV1).
  - **Sécurité** si odeur de brûlé / chaleur / traces noires → consigne : ne pas réarmer, couper au général.
  - Origine appareil personnel → **LOCATAIRE** ; différentiel/installation défaillante → **BAILLEUR**.

**10 formulations locataire :**
1. « Le courant saute tout le temps, je dois remettre le bouton dans le tableau. »
2. « Bonjour, mon disjoncteur du four déclenche dès que j'allume la plaque. »
3. (court) « ça disjoncte »
4. (paniqué) « Ça saute sans arrêt et ça sent le chaud dans le tableau !! »
5. (familier) « Le compteur il arrête pas de sauter, c'est chiant. »
6. (créole guyanais) « Kouran-an ka soté tout lè, mo blijé rémèt bouton-an. »
7. (SMS) « slt le disjoncteur saute des que je branche le chauffe eau »
8. (très détaillé) « L'interrupteur différentiel de gauche (30 mA) saute uniquement quand le chauffe-eau et le four fonctionnent ensemble, il se réarme après quelques minutes. »
9. (minimisant) « De temps en temps le courant coupe, rien de grave je pense. »
10. (personne âgée) « Je n'arrive plus à remettre le courant, tout est éteint chez moi. »

---

## LOT-01-03 · Embrasure partie commune — minuterie + interrupteur, peinture écaillée

![minuterie couloir](D:/Users/ewald/Documents/image%20test%20locataire/20230503_100527.jpg)

- **Fichier** : `20230503_100527.jpg`
- **Ce que je vois** : **tableau/embrasure d'un couloir commun** peint (bandeau bordeaux + blanc) ; **bouton poussoir
  de minuterie** et **interrupteur** ; peinture **très écaillée** sur le dormant et le soubassement ; mur adjacent orange.
- **Localisation** : **PARTIE COMMUNE** (cage / coursive).
- **Responsabilité attendue** : **BAILLEUR** (entretien parties communes + appareillage électrique commun).
- **Comportement Grock attendu** :
  - Si « minuterie HS / lumière du couloir ne marche pas » → charge **BAILLEUR** (éclairage commun) ; sonder si toute
    la cage est concernée (ampoule vs minuterie vs alimentation).
  - Peinture écaillée seule = entretien programmé BAILLEUR, non urgent.

**10 formulations locataire :**
1. « La minuterie du couloir ne marche plus, on est dans le noir le soir. »
2. « Bonjour, dans les parties communes le bouton de la lumière est cassé. »
3. (court) « lumière couloir HS »
4. (paniqué) « Plus aucune lumière dans l'escalier, c'est dangereux la nuit ! »
5. (familier) « Le bouton de la lumière dans le hall il tient plus, ça pend. »
6. (créole guyanais) « Limyè kouloir-a pa ka maché, nou nan fènwa lèswè. »
7. (SMS) « bjr minuterie palier cassée + peinture qui part »
8. (très détaillé) « Le poussoir de minuterie du rez-de-chaussée reste enfoncé et la lumière ne s'allume plus ; la peinture autour de l'interrupteur est complètement écaillée. »
9. (minimisant) « La peinture du couloir s'abîme, quand vous aurez le temps. »
10. (personne âgée) « Le soir je ne vois rien dans le couloir, la lumière ne s'allume plus. »

---

## LOT-01-04 · Coursive + porte palière dégradée (partie commune)

![coursive porte palière](D:/Users/ewald/Documents/image%20test%20locataire/20241021_113637.jpg)

- **Fichier** : `20241021_113637.jpg`
- **Ce que je vois** : **coursive/hall** carrelé donnant sur un logement ; **porte palière orange** avec **bas de porte
  (tôle de protection) enfoncé/rouillé**, salissures et coulures ; mur d'en face orange marqué ; imposte à persiennes ;
  2 boutons (interrupteur/sonnette). Ambiance humidité (traces sombres en haut du poteau).
- **Localisation** : **PARTIE COMMUNE** (palier / coursive) + porte palière.
- **Responsabilité attendue** : **BAILLEUR** (porte palière = élément fourni, coursive commune) — sauf dégradation
  volontaire → **TIERS**.
- **Comportement Grock attendu** :
  - Sonder si la porte **ferme/verrouille** encore (sécurité du logement).
  - Si serrure/porte ne sécurise plus → priorité intervention BAILLEUR.
  - Salissures coursive = nettoyage/entretien commun BAILLEUR.

**10 formulations locataire :**
1. « Le bas de ma porte d'entrée est enfoncé et rouillé, ça ferme mal. »
2. « Bonjour, la porte palière est abîmée et le couloir commun est très sale. »
3. (court) « porte entrée abimée »
4. (paniqué) « Ma porte ne ferme plus correctement, n'importe qui peut entrer ! »
5. (familier) « La tôle en bas de la porte elle est toute défoncée. »
6. (créole guyanais) « Anba pòt mo kaz-la kwoché, i pa ka fèmen byen. »
7. (SMS) « slt bas de porte enfoncé rouillé + couloir sale »
8. (très détaillé) « La plaque métallique en bas de la porte palière est enfoncée et rouillée, le battant frotte et je dois forcer pour verrouiller ; le sol de la coursive est taché. »
9. (minimisant) « La porte est un peu abîmée en bas, rien de grave. »
10. (agressif/exigeant) « Ça fait des mois que la porte est pétée, vous intervenez quand ? »

---

## LOT-01-05 · Salle de bain — faïence vieillie, joint baignoire

![salle de bain](D:/Users/ewald/Documents/image%20test%20locataire/20250404_104017.jpg)

- **Fichier** : `20250404_104017.jpg`
- **Ce que je vois** : **salle de bain** ; lavabo sur colonne, **baignoire**, faïence beige ancienne, tablette verre,
  porte-savon ; **joint périphérique baignoire dégradé** (liaison faïence/baignoire) ; sol carrelé rouge.
- **Localisation** : intérieur logement (salle de bain).
- **Responsabilité attendue** : **partagée** — étanchéité/joint et vétusté équipement = **BAILLEUR** ; entretien
  courant du joint (moisissure d'usage, aération) = **LOCATAIRE** ; à trancher selon symptôme.
- **Comportement Grock attendu** :
  - **Sonder** : fuite active ? eau qui passe derrière la baignoire (chez le voisin du dessous) ? simple moisissure de joint ?
  - Si infiltration/fuite → BAILLEUR (voire SINISTRE si dégât actif chez un tiers).
  - Si moisissure de joint liée à l'aération → conseils + entretien LOCATAIRE.

**10 formulations locataire :**
1. « Le joint autour de la baignoire est noir et décollé, l'eau passe derrière. »
2. « Bonjour, la faïence de la salle de bain est vieille et le joint de la baignoire moisit. »
3. (court) « joint baignoire moisi »
4. (paniqué) « L'eau coule derrière la baignoire, je crois que ça fuit chez le voisin en bas ! »
5. (familier) « Le silicone de la baignoire il est tout noir et il se barre. »
6. (créole guyanais) « Jwen bèywa-a ka moizi, dolo ka pasé dèyè. »
7. (SMS) « bjr joint baignoire decolle eau passe derriere »
8. (très détaillé) « Le joint silicone entre la baignoire et le carrelage est fissuré sur tout un côté ; quand je prends une douche, de l'eau s'infiltre derrière et il y a de la moisissure noire. »
9. (minimisant) « Le joint de la baignoire est un peu abîmé. »
10. (personne âgée) « Ma salle de bain est ancienne, l'eau s'infiltre autour de la baignoire. »

---

## LOT-01-06 · Sol carrelé — taches / points (usage vs nuisible)

![carrelage taches](D:/Users/ewald/Documents/image%20test%20locataire/20240411_152515.jpg)

- **Fichier** : `20240411_152515.jpg`
- **Ce que je vois** : **sol carrelé** clair (carreaux ~15×15), joints ciment ; quelques **petites taches/points brun-roux**
  au sol (déjections d'insecte, rouille ponctuelle, ou salissure) ; pas de fissure structurelle visible.
- **Localisation** : intérieur logement (sol).
- **Responsabilité attendue** : **LOCATAIRE** (entretien courant) sauf si signe de remontée/nuisible avéré.
- **Comportement Grock attendu** :
  - **Sonder** l'origine (taches nettoyables ? reviennent-elles ? présence d'insectes/nuisibles ?).
  - Salissure d'usage → LOCATAIRE (entretien). Nuisibles récurrents (parties communes) → BAILLEUR (dératisation/désinsectisation collective).
  - Photo rapprochée demandée (INV1) pour distinguer déjection vs remontée d'humidité.

**10 formulations locataire :**
1. « J'ai des petites taches marron qui reviennent sur le carrelage, j'ai beau nettoyer. »
2. « Bonjour, des points bruns apparaissent sur le sol, on dirait des insectes. »
3. (court) « taches sol carrelage »
4. (paniqué) « Il y a des trucs qui tachent partout par terre, c'est quoi ces bêtes ?! »
5. (familier) « Y'a des petites crottes marron sur le carrelage, dégueu. »
6. (créole guyanais) « Ni ti tach mawon asou karo-a, mo ka nétwayé mé i ka rivini. »
7. (SMS) « slt petites taches marron au sol qui reviennent »
8. (très détaillé) « Sur le carrelage clair il y a régulièrement de petits points brun-roux, comme des déjections, à plusieurs endroits ; je nettoie mais ça revient au bout de deux jours. »
9. (minimisant) « Rien de grave, juste des taches au sol. »
10. (personne âgée) « Je n'arrive pas à enlever ces petites saletés marron par terre. »

---

## LOT-01-07 · Débarras / cellier encombré (usage locataire + hygiène)

![débarras encombré](D:/Users/ewald/Documents/image%20test%20locataire/20250818_151203.jpg)

- **Fichier** : `20250818_151203.jpg`
- **Ce que je vois** : petit **débarras/cellier** carrelé (faïence beige) **fortement encombré** : caisses plastiques
  empilées, planches de bois, sac poubelle noir au sol, ventilateur ; **salissures au sol**, tuyaux/gaines apparents.
  Porte persienne bleue.
- **Localisation** : intérieur logement (cellier/débarras) — possible local technique attenant.
- **Responsabilité attendue** : **LOCATAIRE** (encombrement, propreté, stockage) ; si gaines/évacuations communes
  concernées → volet BAILLEUR.
- **Comportement Grock attendu** :
  - Distinguer **usage locataire** (rangement/hygiène → LOCATAIRE) d'un **problème technique** (fuite sur gaine,
    évacuation → BAILLEUR).
  - Si le locataire signale odeur/humidité derrière l'encombrement → sonder pour isoler la cause.
  - Rappel sécurité si encombrement bloque une évacuation/ventilation.

**10 formulations locataire :**
1. « Le local à côté de la cuisine est encombré et ça sent mauvais. »
2. « Bonjour, il y a une odeur d'humidité dans le débarras derrière les caisses. »
3. (court) « débarras qui pue »
4. (paniqué) « Ça sent l'égout dans le cellier, il y a peut-être une fuite derrière ! »
5. (familier) « Le petit débarras c'est un vrai bazar et ça sent le renfermé. »
6. (créole guyanais) « Ti dépo-a plen, i ka santi move. »
7. (SMS) « slt odeur humidite dans le cellier »
8. (très détaillé) « Dans le débarras, derrière les caisses et le sac poubelle, il y a des gaines au sol, c'est humide et il y a une odeur ; je ne sais pas si ça vient d'une évacuation. »
9. (minimisant) « Faut que je range le débarras, mais bon. »
10. (personne âgée) « Je ne peux plus entrer dans le cellier tellement c'est encombré. »

---

## LOT-01-08 · Parking sous immeuble — VÉHICULE INCENDIÉ (sinistre grave partie commune)

![véhicule incendié parking](D:/Users/ewald/Documents/image%20test%20locataire/20260619_115725.jpg)

- **Fichier** : `20260619_115725.jpg`
- **Ce que je vois** : **parking sous immeuble** (pilotis) ; **carcasse de voiture entièrement brûlée**, rubalise ;
  **plafond/poutre béton noirci de suie**, **coulures/écaillage sous la dalle** (choc thermique sur le béton),
  poteaux maculés, sol jonché de résidus. Sinistre incendie majeur en partie commune.
- **Localisation** : **PARTIE COMMUNE** (parking couvert / structure porteuse du bâtiment).
- **Responsabilité attendue** : **SINISTRE** — sécurité + assurance + expertise structure. Origine du feu à établir
  (véhicule tiers → TIERS/assurance du propriétaire ; malveillance → dépôt de plainte).
- **Comportement Grock attendu** :
  - **Sécurité d'abord** : périmètre, ne pas stationner/circuler sous la zone (structure potentiellement fragilisée),
    signaler danger éventuel (chute d'enduit, solidité dalle).
  - **SINISTRE** : déclaration assurance + **expertise structure béton** (résistance après incendie) → technicien/référent bailleur.
  - Origine : véhicule d'un tiers / malveillance → **plainte + assurance** ; ne pas conclure « charge locataire ».
  - Ne pas banaliser : signalement grave même si formulé simplement.

**10 formulations locataire :**
1. « Une voiture a brûlé sous le bâtiment, le plafond du parking est tout noir. »
2. « Bonjour, incendie de véhicule au parking commun cette nuit, la dalle est noircie. »
3. (court) « voiture brûlée parking »
4. (paniqué) « Une bagnole a cramé sous l'immeuble, j'ai peur que le béton tienne plus !! »
5. (familier) « Y'a une caisse qui a grillé au parking, le plafond est tout cramé. »
6. (créole guyanais) « On loto brilé anba batiman-an, plafon parking-a tou nwè. »
7. (SMS) « slt voiture incendiee ss l immeuble beton noirci cest dangereux ? »
8. (très détaillé) « Cette nuit un véhicule a entièrement brûlé sur le parking couvert ; la poutre et la dalle au-dessus sont couvertes de suie, il y a des coulures et l'enduit se décolle, je m'inquiète pour la solidité. »
9. (minimisant) « Une voiture a brûlé mais c'est éteint maintenant. »
10. (signalement gardien/voisin) « En tant que voisin je signale : incendie de voiture au parking commun, zone à sécuriser. »

---

## LOT-01-09 · Bon de travaux (document administratif)

![bon de travaux](D:/Users/ewald/Documents/image%20test%20locataire/20220823_092854.jpg)

- **Fichier** : `20220823_092854.jpg`
- **Ce que je vois** : **document papier / bon de travaux** manuscrit et imprimé : références logement/bâtiment/porte
  (anonymisées `[résidence] / [bât.] / [porte]`), mention manuscrite « **Vidange évier** ».
- **Localisation** : n/a (document).
- **Usage** : ce n'est **pas** une photo de pathologie → **hors diagnostic visuel**. Sert éventuellement à tester la
  capacité de Grock à **reconnaître un document** et à demander une **photo du problème réel** (INV1), pas du papier.
- **Comportement Grock attendu** :
  - Détecter « ceci est un document, pas la pathologie » → demander une photo de l'équipement concerné (ici l'évier).
  - Ne pas conclure une responsabilité à partir d'un bon de travaux.

**10 formulations locataire (autour de « vidange évier ») :**
1. « L'eau ne s'écoule plus dans mon évier de cuisine. »
2. « Bonjour, évier bouché, l'eau stagne et remonte. »
3. (court) « évier bouché »
4. (paniqué) « Mon évier déborde, ça pue et l'eau ne part plus du tout ! »
5. (familier) « L'évier il se vide plus, c'est bouché grave. »
6. (créole guyanais) « Dlo pa ka désann nan évyé-a, i bouché. »
7. (SMS) « slt evier cuisine bouché eau stagne »
8. (très détaillé) « Depuis deux jours l'eau ne s'évacue plus de l'évier ; j'ai versé du déboucheur, ça remonte quand même et il y a une mauvaise odeur ; le siphon dessous fuit un peu. »
9. (minimisant) « L'évier se vide lentement, pas urgent. »
10. (personne âgée) « L'eau reste dans mon évier, je ne sais pas comment le déboucher. »

---

### Note de traitement
- **Écartés** (bruit) : selfies (`20260702_082626.jpg`…), étiquette photocopieur (`20250822_085749.jpg`), vidéos `.mp4`.
- **À suivre** : Lot 02+ (2665 fichiers au total, beaucoup de séries quasi identiques → 1 fiche par sujet réel).
