# L'Ordre des Cendres

Jeu de duel 1 contre 1 en arène, en ligne, jouable dans le navigateur. Ce fichier est la référence du projet : le tenir à jour à chaque étape (état, décisions, commandes).

## Méthode de travail

- Mettre à jour ce fichier à la fin de chaque étape ou décision importante.
- Répondre en français.
- Avant de déclarer un travail fini : `npm run check` puis `npm run smoke` doivent passer.
- Pour une nouvelle étape, présenter le plan avant de coder, sauf si l'utilisateur délègue les détails (c'est le cas du jeu de duel, le 2026-10-20 : « je te fais confiance et te laisse les détails »).

## Vision

- **Le jeu** : un duel simple, en 1 contre 1 et en ligne, dans une arène. Deux chevaliers maudits d'un ordre déchu s'affrontent ; ils ne meurent jamais vraiment et se relèvent après chaque chute.
- **Le chevalier** : le même personnage et les mêmes mouvements que le prototype (pack FreeKnight).
- **L'arène** : sol plat, sans étages ni plateformes, un seul écran de large.
- **Accès** : on joue depuis un autre PC en se connectant au même serveur.
- **Ambiance** : très sombre, portée par le code. On y trouve l'éclairage dynamique, l'obscurité froide, une palette désaturée, le vignettage et les effets de coup (hit flash, screen shake, hitstop).
- **Inspirations** : Blasphemous, Dark Souls, Hollow Knight.

Le prototype précédent était une coop en expéditions, avec mobs, boss, hub et progression. Il a été abandonné le 2026-10-20 au profit du duel.

## Direction artistique

- **Aucun symbole ni référence religieuse**, dans le décor comme dans les textes. Ni croix, ni autel, ni chapelle, ni cathédrale, ni vitrail, ni ogive. Se méfier aussi des silhouettes : une barre horizontale sur un pieu forme une croix.
- L'emblème de l'ordre est une **flamme**. L'arène est la grande salle d'une **citadelle en ruine**.
- Le décor est fait de rectangles dessinés par le code (`client/src/view/RoomView.ts`, `textures.ts`).

## Règles du duel

| Règle               | Valeur                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Joueurs par duel    | 2                                                                                        |
| Manches pour gagner | 2 (meilleur des 3)                                                                       |
| Compte à rebours    | 3 s, chevaliers à leur place, verrouillés                                                |
| Durée d'une manche  | 60 s ; à la fin du temps, le plus de vie gagne, sinon égalité                            |
| Fin de manche       | 3 s ; le vaincu tombe puis se relève                                                     |
| Fin du duel         | 5 s d'annonce, puis un nouveau duel commence seul                                        |
| Vie                 | 100                                                                                      |
| Dégâts              | attaque 1 : 10 (chargée : 14), attaque 2 : 16, accroupie : 8, aérienne : 10 ; × 1,5 sur un contre |
| Recul après un coup | léger 16 ticks, lourd (attaque 2 ou chargée) 11 ticks et projection ; + 8 ticks sur un contre     |
| Parade              | garde de 30 ticks, active les 10 premiers ; réussie : attaquant déséquilibré 40 ticks  |
| Feinte              | avant l'impact / pendant l'armé ou la charge (L ou clic droit) ; arrêt 6 ticks, vulnérable au contre |
| Coup chargé         | maintenir attaque au tick 8 (jusqu'à 15 ticks) ; ≥ 12 ticks : 14 dégâts, coup lourd   |
| Jauge des Cendres   | 100 ; coup porté +10 (+5 sur un contre), parade +25, choc +5, la moitié des dégâts reçus |
| Embrasement         | jauge pleine ; 12 dégâts, imparable, invulnérable du tick 0 au tick 19                 |

- **Pas de matraquage gagnant** (règles du 2026-10-20) :
  - les coups sont lents à sortir : l'attaque 1 frappe après 150 ms, on la voit venir ;
  - **engagement** : un coup dans le vide va jusqu'au bout de sa récupération (270 ms pour l'attaque 1), sans esquive ni saut pour l'annuler ;
  - **combo limité à deux coups** : l'attaque 2 ne s'enchaîne que si l'attaque 1 a touché, et ne relance rien ;
  - **contre** : toucher un adversaire en pleine attaque (armé, coup ou récupération) inflige 50 % de dégâts en plus et 8 ticks de recul en plus, avec « Contre ! » à l'écran ;
  - le coup lourd qui clôt le combo repousse la victime hors de portée : sa riposte réflexe tombe dans le vide.
- **Parade** (règles du 2026-10-21), au sol, depuis le repos, la course ou l'accroupi, jamais depuis la récupération d'un coup :
  - la garde est active dès le premier tick et pendant 10 ticks (167 ms), puis 20 ticks de récupération, sans annulation ;
  - elle pare tous les coups. L'attaquant est déséquilibré 40 ticks (667 ms) et repoussé, les deux gèlent 8 ticks, le pareur sort aussitôt de sa garde : sa riposte (attaque 1 puis 2) est garantie ;
  - parer au hasard se paie : touché pendant la récupération de la garde, c'est un contre (× 1,5) ;
  - **délai de grâce** : un coup porté sur un adversaire qui pourrait encore parer attend 5 ticks (83 ms) sur le serveur. Une parade lancée à temps sur son écran, mais arrivée un peu tard, compte encore.
- **Choc des lames** : deux coups qui se croisent (celui du défenseur est actif, ou le devient dans les 2 ticks) s'annulent, sans dégâts ; les deux combattants reculent 14 ticks. Frapper pendant l'armé adverse n'est pas un choc mais un contre.
- **Jauge des Cendres** (règles du 2026-10-21) : elle se remplit en touchant, en parant et en encaissant (tableau ci-dessus) ; l'Embrasement ne la recharge pas. Elle se garde d'une manche à l'autre et repart de zéro à chaque nouveau duel. Pleine, des braises montent du chevalier : l'adversaire le voit.
- **Embrasement** (E ou I), jauge pleine, au sol, depuis le repos, la course, l'accroupi, et **même en encaissant un coup** (pour briser un combo) ; jamais en l'air ni en pleine attaque :
  - la jauge se vide d'un coup ; 14 ticks d'armé, 6 ticks d'onde tout autour du chevalier (46 px de chaque côté), 30 ticks d'essoufflement ;
  - invulnérable pendant l'armé et l'onde ; le serveur le protège même d'un coup que l'attaquant voyait porter juste avant ;
  - l'onde ne se pare pas et ne provoque pas de choc ; 12 dégâts (× 1,5 sur un contre), l'adversaire est projeté loin et reste 30 ticks dans le recul. Touché, l'Embrasement s'arrête au tick 24 et le chevalier reprend la main ;
  - contre-jeu : reculer hors de portée, sauter par-dessus, ou rouler au bon moment. Raté, l'essoufflement de 500 ms se punit d'un contre.
- **Feinte d'attaque** (règles du 2026-10-22) :
  - pendant l'armé de l'attaque 1 (avant les frames actives du tick 9), appuyer sur la touche de parade (L ou clic droit) annule le geste ;
  - le chevalier entre dans un court arrêt de 6 ticks (100 ms) où il ne peut pas frapper immédiatement, et encaisse un contre s'il est touché ;
  - l'adversaire qui a tenté de parer au réflexe reste coincé dans sa garde (30 ticks, dont 20 ticks de récupération vulnérable) : le feinteur peut alors riposter avec un contre garanti (× 1,5).
- **Coup chargé** (règles du 2026-10-22) :
  - maintenir la touche d'attaque (J ou clic gauche) retient l'armé au tick 8 jusqu'à 15 ticks supplémentaires (250 ms max) avant de frapper ;
  - relâcher avant pleine charge décale le timing d'impact pour tromper la fenêtre de parade adverse (10 dégâts de base) ;
  - à pleine charge (≥ 12 ticks de charge), le coup s'accompagne d'un flash blanc-doré, inflige 14 dégâts (21 dégâts sur un contre), un hitstop de 7 ticks et repousse lourdement la cible ;
  - un coup en cours de charge peut également être feinté à tout moment avec la touche de parade.
- Le combo est garanti si le premier coup touche, puis le défenseur peut rouler avant la reprise. Trois tests d'équilibrage le vérifient : celui qui matraque perd contre un joueur qui garde ses distances et punit, et contre un joueur qui pare et riposte ; celui qui pare sans arrêt perd contre un joueur qui frappe pendant sa récupération.
- La roulade est invulnérable du tick 2 au tick 19, puis punissable jusqu'au tick 34 : rouler sans arrêt ne protège pas. Les chevaliers se traversent (pas de collision entre joueurs).
- Un joueur seul attend son adversaire ; un départ en cours de duel remet le salon en attente.
- **Combat rapide** : rejoint le premier duel qui attend, sinon en ouvre un. **Duel privé** : ne se rejoint que par son code de 4 lettres.
- **Entraînement** : seul face au mannequin, sans serveur, avec les touches de test du mode debug. Le HUD n'y montre que le panneau du joueur (vie et jauge).

## Jouer depuis un autre PC

1. Sur la machine qui héberge : `nvm use` puis `npm start`. Le jeu est construit puis servi avec le serveur sur le **port 2567**, qui affiche l'adresse à donner (par exemple `http://10.13.4.10:2567`).
2. Sur l'autre PC du même réseau : ouvrir cette adresse dans un navigateur. Le menu du jeu l'affiche aussi (« Depuis un autre PC : … »).
3. Les deux joueurs cliquent sur **Combat rapide** (ou l'un crée un **Duel privé** et donne son code).

En développement, `npm run dev` expose aussi Vite sur le réseau : l'autre PC ouvre `http://<adresse>:5173`.

Si l'autre PC n'arrive pas à se connecter : vérifier le pare-feu (`sudo ufw allow 2567/tcp`), et savoir que certains réseaux (Wi-Fi d'école ou d'entreprise) isolent les machines entre elles. Hors réseau local, il faut rediriger le port 2567 sur la box, ou passer par un tunnel HTTPS (le client se connecte alors à la même adresse que la page).

## Stack technique

| Outil           | Version           | Rôle                                                      |
| --------------- | ----------------- | --------------------------------------------------------- |
| Node.js         | 24 LTS (`.nvmrc`) | exigé par Colyseus 0.18 et Vitest 5 ; exécute le TS natif |
| npm workspaces  | npm 11            | monorepo `shared/`, `client/`, `server/`                  |
| TypeScript      | 7.0               | typage strict, vérification seule (`noEmit`)              |
| Phaser          | 3.90.0            | rendu, chargement, caméra (client uniquement)             |
| Vite            | 8.3               | serveur de dev et build du client                         |
| Colyseus        | 0.18              | serveur qui fait autorité, prédiction, rembobinage        |
| Express         | 5                 | route `/info` et service du client construit              |
| Vitest          | 5.0               | tests de `shared/` et du serveur                          |
| Prettier        | 3.9               | formatage                                                 |
| playwright-core | 1.64              | test de fumée dans le Chrome installé                     |

## Commandes

Toujours commencer par `nvm use` dans le dossier du projet : la version par défaut de la machine est Node 20.

```bash
nvm use            # bascule sur Node 24 (lit .nvmrc)
npm install        # installe toutes les dépendances du monorepo
npm run dev        # serveur de jeu (2567) + Vite (5173), accessibles sur le réseau
npm start          # construit le client puis le sert avec le serveur, un seul port : 2567
npm test           # tests Vitest de shared/ et du serveur
npm run typecheck  # vérification des types de tous les paquets
npm run build      # build de production dans client/dist
npm run check      # typecheck + tests + build
npm run smoke      # entraînement puis duel complet dans Chrome headless, captures dans .smoke/
npm run format     # Prettier sur tout le projet
```

`npm run dev`, `npm start` et `npm test` s'arrêtent avec un message clair si Node n'est pas en version 24 (`scripts/check-node.mjs`). `npm run smoke` cherche Chrome dans `/usr/bin` ; sinon, donner son chemin dans la variable `CHROME_PATH`. La latence se simule avec `COLYSEUS_LATENCY` (aller-retour en ms) ; le test de fumée joue à 80 ms.

## Architecture

```
assets/knight/        pack de sprites, servi tel quel par Vite (publicDir)
shared/src/           simulation pure, exécutée par le client ET par le serveur
  constants.ts        tick (60 par seconde), DT
  geometry.ts         Rect, chevauchement, boîtes ancrées aux pieds, miroir selon le regard
  physics.ts          déplacement AABB contre rectangles statiques, test de place, sonde de sol
  input.ts            InputFrame : intentions du joueur pour un tick, dont l'annonce de coup
  room.ts             types des salles ; rooms/arena.ts : l'arène de duel
  knight/             état, machine à états, réglages, durées des actions
  combat/             données des attaques, détection des coups, dégâts, jauge des Cendres (`ash.ts`)
  duel.ts             règles du duel : coups annoncés, arbitre (parade, choc), manches, victoire
  world.ts            stepKnight (un chevalier, un tick) ; step (entraînement)
  players.ts          noms, apparences, codes de salon
  net/index.ts        protocole Colyseus (`@cendres/shared/net`) : schémas, constantes
shared/test/          tests Vitest (physique, chevalier, combat, parade, duel, équilibrage, prédiction, joueurs)
server/src/           Node 24 exécute le TypeScript tel quel, sans build
  DuelRoom.ts         salon de duel : entrées, simulation, rembobinage, manches
  app.ts              configuration Colyseus, route /info, service du client construit
  network.ts          adresses de la machine sur le réseau local
server/test/          tests d'intégration avec de vrais clients du SDK
client/src/           Phaser : rendu, entrées, effets
  main.ts             configuration du jeu, menu, lancement des sessions
  session/            Session (interface), SoloSession (entraînement), OnlineSession (duel)
  net/connection.ts   adresse du serveur, combat rapide, duel privé, /info
  scenes/             Boot (chargement), Arena (boucle de jeu), DebugOverlay (boîtes)
  view/               KnightView, DummyView, RoomView, FlameView, textures en code
  fx/                 AmbiancePipeline + ambiance.frag (shader), lights, flicker, HitEffects
  ui/                 Menu, DuelHud (vies, manches, annonces), Hud, Nameplates
  input/              KeyboardMouseInput : clavier et souris vers InputFrame
scripts/              dev.mjs (serveur + client), smoke.mjs (test de fumée)
```

## Réseau

1. **Simulation à pas fixe** de 60 ticks par seconde, dans `shared/`. L'état d'un chevalier n'a que des champs scalaires : Colyseus le synchronise et la prédiction le recopie champ par champ.
2. **Le serveur fait autorité.** Chaque entrée reçue fait avancer son chevalier d'un tick avec `stepKnight`, la même fonction que la prédiction du client.
3. **Prédiction** (`predict.reconciler` de Colyseus) : le chevalier local répond tout de suite, puis se corrige à chaque état reçu en rejouant les entrées non confirmées. La dérive mesurée est nulle hors combat, ce qui prouve le déterminisme.
4. **Adversaire interpolé** 60 ms dans le passé, à partir des états reçus à 60 Hz. Position et animation suivent la même horloge.
5. **Coups annoncés** : le client met `strike` dans l'entrée du tick quand sa hitbox croise l'adversaire affiché. Un coup que le serveur refuse est aussi annulé chez l'attaquant (ni gel, ni droit d'enchaîner) : annoncer des coups au hasard ne rapporte rien. Le verdict voyage avec l'entrée, donc la prédiction et le serveur figent l'attaquant de la même façon. Le serveur valide ensuite le coup sur l'adversaire **rembobiné** à l'instant vu par l'attaquant (`allowRewindState`, champs x, y et `vulnerableHeight`).
6. **Arbitre** (`StrikeReferee`, dans `duel.ts`) : le serveur rend un verdict sur chaque coup validé : paré, choc, en attente (délai de grâce de la parade) ou touché. Il applique alors dégâts, recul et gel, ou la parade, ou le choc. Les événements (`WorldEvent` : coup, parade, choc) partent sur le message `EVENT_MESSAGE`.
7. **Effets** : nos coups sont joués dès la prédiction, sauf si l'adversaire affiché pare ou frappe en même temps (on attend alors le verdict). Ce qui nous concerne est joué dès réception, le reste à l'instant où l'attaquant affiché frappe.
8. Pas de collision entre chevaliers : elle dépendrait de la position de l'autre, que chaque client voit différemment.

## Conventions de code

- Identifiants (variables, fonctions, types, noms de fichiers) en anglais. Commentaires, docs et textes du jeu en français.
- TypeScript strict partout (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`), modules ES, pas de `any` sans justification en commentaire.
- **Syntaxe effaçable uniquement** (`erasableSyntaxOnly`) : pas d'`enum`, de `namespace` ni de propriétés de paramètre de constructeur. Imports relatifs avec l'extension `.ts`, `import type` pour les types (`verbatimModuleSyntax`). Node 24 exécute ainsi le serveur et `shared/` sans build.
- Schémas Colyseus déclarés avec `schema()` et `t.*`, sans décorateurs. Leurs champs n'ont pas de valeur par défaut : partir d'un état complet (`createKnight`).
- Des assertions de types dans `shared/src/net/index.ts` vérifient que les schémas restent compatibles avec la simulation.
- Phaser 3.90 n'a pas d'export par défaut en ESM : `import * as Phaser from 'phaser'` (ou `import type * as Phaser` pour les seuls types). Ne pas nommer une propriété de scène comme un membre de Phaser (`lights`, `data`…).
- `shared/` : aucune dépendance à Phaser, au DOM ou à Node (sa config ne charge que la lib ES2022), sauf `@colyseus/schema` dans `net/`. Temps en ticks entiers ; pas de `Date.now()` ni de `Math.random()` dans la simulation.
- Réglages de gameplay dans des constantes nommées (`tuning.ts`, `frameData.ts`, `attacks.ts`, `duel.ts`), jamais en nombres magiques dans la logique.
- Chaque règle de `shared/` est couverte par des tests Vitest.
- `client/` : aucune règle de jeu. Les vues lisent l'état, les effets écoutent les événements. Le purement visuel (vacillement, balancement, traînée des barres de vie) vit côté client.
- Repères : pixels, axe y vers le bas. La position d'une entité est le milieu de ses pieds. `facing` vaut 1 (droite) ou -1 (gauche). Les hitbox sont décrites pour un regard vers la droite et retournées par `orientBox`.
- Entrées clavier lues par position physique (`KeyboardEvent.code`) : ZQSD sur AZERTY correspond à WASD sur QWERTY. Exception : les touches de debug (H, M) sont lues par caractère.
- Nommage : `PascalCase` pour les classes, types et scènes (et leurs fichiers), `camelCase` pour les fonctions et variables, `SCREAMING_SNAKE_CASE` pour les constantes de réglage.

## Contrôles

| Action                                                                       | Clavier                    | Souris      |
| ---------------------------------------------------------------------------- | -------------------------- | ----------- |
| Se déplacer                                                                  | Q / D (ou flèches)         |             |
| Sauter, maintenir pour monter plus haut                                      | Z, Espace ou flèche haut   |             |
| S'accroupir, marche accroupie avec Q / D                                     | S maintenu (ou flèche bas) |             |
| Attaquer, maintenir pour charger le coup ; accroupi : coup bas ; en l'air : aérienne | J                          | clic gauche |
| Feinter : pendant l'armé d'une attaque, annule le geste et trompe la parade          | L                          | clic droit  |
| Parer (au sol) : renvoie un coup reçu au bon moment                                  | L                          | clic droit  |
| Embrasement, jauge des Cendres pleine (au sol, même en encaissant un coup)   | E ou I                     |             |
| Esquive : roulade au sol (invulnérable), dash en l'air (un par saut)         | Maj gauche ou K            |             |
| Glissade                                                                     | S + esquive                |             |
| Retour au menu                                                               | Échap                      |             |
| Mode debug : boîtes, état, réseau, rappel des touches                        | F1 ou ²                    |             |
| En entraînement, mode debug : coup reçu / mort puis relève / jauge pleine    | H / M / C                  |             |

## Le chevalier : réglages

- Résolution interne 480×270, zoom entier en pixels physiques. L'arène fait exactement un écran : la caméra reste fixe.
- Boîte de 14 px de large ; 36 px de haut debout, 24 accroupi, 16 en glissade. Course à 125 px/s, saut d'environ 61 px (25 px pour un appui bref), coyote time et saut mémorisé de 6 ticks.
- Attaques, en ticks d'armé / de frappe / de récupération : attaque 1 9 / 6 / 16, attaque 2 8 / 6 / 14, accroupie 6 / 6 / 14, aérienne 5 / 6 / 12. Les annulations (combo, esquive, saut) ne sont permises que sur un coup qui a touché.
- Combo : un appui à partir du tick 3 de l'attaque 1 enchaîne l'attaque 2 au tick 15, si elle a touché. Gel de 4 ticks (léger) ou 7 (lourd) pour l'attaquant et la cible.
- Roulade de 36 ticks, annulable à partir du tick 34 ; dash aérien de 12 ticks. Au demi-tour en pleine course, l'animation de dérapage dure 9 ticks mais le chevalier repart aussitôt dans l'autre sens.
- Lumières : celle de chaque chevalier, 4 torches, 2 braseros, le clair de lune de la brèche. Plafond de lumière cumulée à 1,35. Réglages en tête de `client/src/fx/lights.ts` et `AmbiancePipeline.ts`.

## Assets : le chevalier

Pack « FreeKnight v1 » d'aamatniekss (itch.io), identifié d'après sa structure. Aucun fichier de licence n'est inclus : vérifier les conditions sur la page du pack avant toute mise en ligne publique.

- **Emplacement** : `assets/knight/<Colour1|Colour2>/<NoOutline|Outline>/120x80_PNGSheets/_<Nom>.png`, avec des GIF d'aperçu dans `120x80_gifs/`.
- **Format** : une planche PNG par animation, frames de 120×80 px sur une ligne, RGBA.
- **Apparences** : à gauche Colour1/Outline (armure os et cendre), à droite Colour2/Outline (armure acier).
- **Ancrage** : pieds sur la dernière ligne (y = 80), centre du corps à x ≈ 55. `flipX` retournant autour du centre de l'image, l'origine passe de 55/120 à 65/120 vers la gauche.
- **Épée** : l'arc du coup est dessiné dans les frames d'attaque, et les hitbox ont été mesurées dessus.
- **Absent du pack** : parade ou blocage, attaque aérienne dédiée. La garde reprend la dernière frame de `_AttackNoMovement` (lame tendue vers l'avant), avec un éclair puis un reflet d'acier froid pendant la fenêtre active (`KnightView.ts`).
- On utilise les versions `NoMovement` des animations, le déplacement étant géré par la simulation. Les planches composites (AttackCombo, CrouchFull/All, SlideFull/All) ne sont pas chargées.

| Planche                 | Frames | ms/frame | Utilisation                                                                         |
| ----------------------- | ------ | -------- | ----------------------------------------------------------------------------------- |
| `_Idle`                 | 10     | 80       | repos                                                                               |
| `_Run`                  | 10     | 60       | course                                                                              |
| `_TurnAround`           | 3      | 70       | demi-tour en pleine course                                                          |
| `_Jump`                 | 3      | 60       | montée du saut                                                                      |
| `_JumpFallInbetween`    | 2      | 60       | sommet du saut, début de chute                                                      |
| `_Fall`                 | 3      | 60       | chute                                                                               |
| `_AttackNoMovement`     | 4      | 60       | attaque 1, attaque aérienne ; frame 3 : la garde                                    |
| `_Attack2NoMovement`    | 6      | 60       | attaque 2 ; frames 2 et 3 : l'onde de l'Embrasement                                 |
| `_CrouchAttack`         | 4      | 60       | attaque accroupie                                                                   |
| `_CrouchTransition`     | 1      | 100      | s'accroupir, se relever, atterrissage lourd, armé et essoufflement de l'Embrasement |
| `_Crouch`               | 1      | 60       | accroupi immobile                                                                   |
| `_CrouchWalk`           | 8      | 80       | marche accroupie                                                                    |
| `_Roll`                 | 12     | 50       | roulade                                                                             |
| `_Dash`                 | 2      | 60       | dash aérien                                                                         |
| `_SlideTransitionStart` | 1      | 100      | début de glissade                                                                   |
| `_Slide`                | 2      | 60       | glissade                                                                            |
| `_SlideTransitionEnd`   | 1      | 100      | fin de glissade                                                                     |
| `_Hit`                  | 1      | 60       | coup reçu                                                                           |
| `_DeathNoMovement`      | 10     | 60       | K.O., puis relève en jouant l'animation à l'envers                                  |

Les planches murales (`_WallSlide`, `_WallHang`, `_WallClimb…`) ne sont pas chargées : pas de mouvements muraux.

## État actuel

- Duel 1 contre 1 jouable en ligne, depuis un autre PC du réseau local : combat rapide, duel privé par code, manches, chronomètre, K.O., victoire, revanche automatique. L'entraînement se joue face au mannequin.
- Parade, feinte d'attaque et coup chargé jouables en ligne et à l'entraînement, avec retours visuels (reflet de garde, lueur et flash de charge).
- Jauge des Cendres et Embrasement jouables en ligne et à l'entraînement : jauge sous chaque barre de vie, braises sur le chevalier quand elle est pleine, anneau de flammes, lumière qui flambe.
- Les 88 tests de `shared/`, dont trois d'équilibrage et la suite de feinte/charge, et les 5 tests d'intégration du serveur passent, ainsi que le typecheck et le build.
- Le test de fumée joue un entraînement puis un duel complet à 80 ms de latence : parade à L et au clic droit, parade réussie vue des deux navigateurs, Embrasement à l'entraînement et en duel, deux manches, sans erreur ni divergence.
- Vérifié via l'adresse réseau local (`http://10.13.4.10:2567`) : deux navigateurs se retrouvent par le combat rapide et se battent.
- En développement, `window.__cendres` expose `{ session, scene, ready }` pour les tests et la console du navigateur.

## Pistes

Rien n'est décidé. Pour le gameplay : un adversaire d'entraînement qui attaque (le mannequin ne frappe pas, la parade ne s'y entraîne pas), une jauge d'endurance (écartée jusqu'ici), d'autres arènes. Ailleurs : les sons, les particules et la brume, un classement, la mise en ligne publique.

## Journal des décisions

- 2026-10-14 : pack de sprites rangé dans `assets/knight/` ; versions `NoMovement` ; Phaser 3.90 maintenu malgré Phaser 4 ; Node 24 fixé par `.nvmrc`.
- 2026-10-14 : pas de mouvements muraux ; parade en attente faute d'animation (clic droit et L réservés).
- 2026-10-14 : prototype coop en ligne (Colyseus 0.18, prédiction, interpolation) ; noms au-dessus des têtes ; torches.
- 2026-10-20 : le jeu devient un duel 1 contre 1 en arène ; arène plate d'un écran ; accès depuis un autre PC (un seul port avec `npm start`).
- 2026-10-20 : coups entre joueurs annoncés par l'attaquant et validés par le serveur sur l'adversaire rembobiné ; pas de collision entre joueurs.
- 2026-10-20 : aucun symbole religieux ; l'emblème de l'ordre est une flamme, l'arène une citadelle en ruine.
- 2026-10-20 : contre le matraquage, coups plus lents, engagement sur un coup raté, combo limité à deux coups, contres majorés, coup lourd qui repousse hors de portée, roulade punissable en fin ; un coup annoncé refusé est annulé chez l'attaquant ; demi-tour fluide.
- 2026-10-21 : parade (L, clic droit) avec délai de grâce réseau de 5 ticks, choc des lames ; l'arbitre des coups vit dans `shared/` ; le message `hit` devient `EVENT_MESSAGE` ; l'étincelle d'impact devient un losange (l'étoile à quatre branches dessinait une croix).
- 2026-10-21 : jauge des Cendres et Embrasement (E, I), le coup ultime : imparable, invulnérable à l'armé, utilisable en encaissant un coup ; la jauge se garde entre les manches. Le gain sur le mannequin se fait dans `detectHits` (la prédiction reste identique au monde complet), celui sur l'adversaire dans l'arbitre.
- 2026-10-22 : feinte d'attaque (parade pendant l'armé, la charge ou avant l'impact, temps d'arrêt de 6 ticks vulnérable au contre pour baiter une parade) et coup chargé (maintien de l'attaque au tick 8 jusqu'à 15 ticks de charge supplémentaires, décalage du timing, 14 dégâts et coup lourd dès 12 ticks, feintable). Fenêtre de feinte étendue jusqu'à cancelTick tant que le coup n'a pas touché, écoute mousedown/mouseup multi-boutons (clic droit fiable même avec clic gauche maintenu, support Ctrl+clic Mac).

## Points d'attention

- Phaser 3.90.0 (mai 2025) est la dernière version 3.x. Phaser 4 est la version maintenue depuis avril 2026.
- Colyseus 0.18 : le client s'appelle `@colyseus/sdk` (`colyseus.js` est l'ancien nom). Son API de prédiction est postérieure aux connaissances de Claude : relire https://docs.colyseus.io/llms.txt avant d'y toucher.
- Un onglet en arrière-plan n'envoie plus d'entrées : son chevalier se fige côté serveur.
- Si F1 ouvre l'aide du navigateur malgré l'interception, utiliser la touche ².
- Les hitbox sont mesurées sur les frames du pack : à revoir si les planches changent.
- Le client honnête annonce aussi ses coups sur un adversaire qui pare. Un client modifié pourrait s'en abstenir pour ne jamais être paré (mais il ne toucherait pas non plus) : à durcir avant une mise en ligne publique.
- Le build embarque tout `assets/` (les quatre variantes et les GIF, environ 1,5 Mo).
