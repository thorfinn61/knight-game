import type { DuelPhase, DummyState, InputFrame, KnightState, WorldEvent } from '@cendres/shared';

/** Chevalier tel qu'il doit être affiché cette image. */
export interface DisplayedKnight {
  id: string;
  name: string;
  /** Place et apparence : 0 à gauche (armure os et cendre), 1 à droite (armure acier). */
  skin: number;
  /** Vrai pour le chevalier du joueur de ce navigateur. */
  local: boolean;
  /** État à afficher : positions lissées ou interpolées, frame déduite de l'action. */
  state: KnightState;
}

export interface FighterStatus {
  id: string;
  name: string;
  skin: number;
  hp: number;
  maxHp: number;
  wins: number;
  /** Jauge des Cendres, de 0 à ASH_MAX. */
  ash: number;
  local: boolean;
}

export interface DuelStatus {
  phase: DuelPhase;
  /** Temps restant dans la phase en cours, en millisecondes. */
  remainingMs: number;
  round: number;
  roundWinner: string;
  matchWinner: string;
  /** Combattants rangés par place : gauche, puis droite. */
  fighters: FighterStatus[];
}

export interface SessionStatus {
  mode: 'training' | 'duel';
  code: string | null;
  players: number;
  pingMs: number | null;
  /** Écart moyen entre prédiction et serveur, en pixels (en ligne seulement). */
  driftPx: number | null;
  duel: DuelStatus | null;
  /** Le combattant de ce navigateur, en duel comme à l'entraînement. */
  self: FighterStatus | null;
}

/**
 * Une partie en cours, vue par la scène de jeu. La scène affiche ; la session décide de
 * l'état, en simulant seule (entraînement) ou en prédisant puis en suivant le serveur (duel).
 */
export interface Session {
  readonly mode: 'training' | 'duel';
  /** Avance la partie : lit les entrées au rythme des ticks, simule ou prédit. */
  update(timeMs: number, deltaMs: number, sample: () => InputFrame): void;
  knights(): readonly DisplayedKnight[];
  dummies(): readonly DummyState[];
  /** État exact du chevalier local, sans lissage (logique, debug). */
  localKnight(): KnightState | null;
  /** Coups, parades et chocs à jouer maintenant à l'écran, depuis le dernier appel. */
  drainEvents(): WorldEvent[];
  status(): SessionStatus;
  /** Actions de test du mode debug. Entraînement seulement : en duel, le serveur fait autorité. */
  readonly debugActions: { hurt(): void; kill(): void; fillAsh(): void } | null;
  /** La session prévient quand elle se termine d'elle-même (connexion perdue). */
  onEnded(listener: (reason: string) => void): void;
  destroy(): void;
}
