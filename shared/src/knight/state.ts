import { KNIGHT_ARMOR, KNIGHT_POWER } from '../combat/damage.ts';
import { feetBox, type Facing, type Point, type Rect } from '../geometry.ts';
import {
  KNIGHT_CROUCH_HEIGHT,
  KNIGHT_MAX_HP,
  KNIGHT_SLIDE_HEIGHT,
  KNIGHT_STAND_HEIGHT,
  KNIGHT_WIDTH,
} from './tuning.ts';

export type KnightAction =
  | 'idle'
  | 'run'
  | 'turn'
  | 'jump'
  | 'fall'
  | 'land'
  | 'crouchDown'
  | 'crouch'
  | 'crouchWalk'
  | 'standUp'
  | 'attack1'
  | 'attack2'
  | 'crouchAttack'
  | 'airAttack'
  | 'roll'
  | 'dash'
  | 'slide'
  | 'parry'
  | 'blaze'
  | 'hurt'
  | 'dead';

/**
 * État complet d'un chevalier : uniquement des champs scalaires. Le serveur le synchronise tel
 * quel, et la prédiction côté client le recopie champ par champ pour rejouer les entrées.
 */
export interface KnightState {
  id: string;
  /** Milieu des pieds. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  grounded: boolean;
  action: KnightAction;
  /** Ticks écoulés depuis l'entrée dans l'action courante. */
  actionTick: number;
  /** Ticks de gel restants après un coup porté ou reçu. */
  hitstop: number;
  /** Ticks restants pendant lesquels un saut reste possible après avoir quitté le sol. */
  coyote: number;
  jumpBuffer: number;
  attackBuffer: number;
  dodgeBuffer: number;
  parryBuffer: number;
  blazeBuffer: number;
  /** Le saut en cours a déjà été écourté. */
  jumpCut: boolean;
  /** Entrées ignorées : compte à rebours ou fin de manche. */
  locked: boolean;
  /** Durée en ticks du recul en cours, après un coup reçu. */
  stun: number;
  /** Point le plus haut atteint depuis le dernier contact avec le sol (y minimal). */
  airPeakY: number;
  airDashUsed: boolean;
  /** Un appui d'attaque attend le tick d'annulation pour enchaîner le coup suivant. */
  comboQueued: boolean;
  /**
   * Cibles déjà touchées par l'attaque en cours, un bit par index de cible dans la salle :
   * chaque coup ne touche qu'une fois. Un masque plutôt qu'une liste, pour rester scalaire.
   */
  hitMask: number;
  hp: number;
  maxHp: number;
  /** Multiplicateur des dégâts infligés. */
  power: number;
  /** Réduction fixe des dégâts reçus. */
  armor: number;
  /** Jauge des Cendres, de 0 à ASH_MAX : pleine, elle permet l'Embrasement. */
  ash: number;
}

export function createKnight(id: string, spawn: Point, facing: Facing = 1): KnightState {
  return {
    id,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing,
    grounded: true,
    action: 'idle',
    actionTick: 0,
    hitstop: 0,
    coyote: 0,
    jumpBuffer: 0,
    attackBuffer: 0,
    dodgeBuffer: 0,
    parryBuffer: 0,
    blazeBuffer: 0,
    jumpCut: false,
    locked: false,
    stun: 0,
    airPeakY: spawn.y,
    airDashUsed: false,
    comboQueued: false,
    hitMask: 0,
    hp: KNIGHT_MAX_HP,
    maxHp: KNIGHT_MAX_HP,
    power: KNIGHT_POWER,
    armor: KNIGHT_ARMOR,
    ash: 0,
  };
}

/** Noms des champs de l'état, ceux que la prédiction réseau recopie et rejoue. */
export const KNIGHT_STATE_FIELDS = Object.keys(
  createKnight('', { x: 0, y: 0 }),
) as readonly (keyof KnightState)[];

/** Hauteur de la boîte selon l'action : debout, accroupi ou en glissade. */
export function knightHeight(action: KnightAction): number {
  switch (action) {
    case 'crouchDown':
    case 'crouch':
    case 'crouchWalk':
    case 'crouchAttack':
      return KNIGHT_CROUCH_HEIGHT;
    case 'slide':
      return KNIGHT_SLIDE_HEIGHT;
    default:
      return KNIGHT_STAND_HEIGHT;
  }
}

/** Boîte de collision du chevalier, qui est aussi sa zone vulnérable. */
export function knightBox(k: KnightState): Rect {
  return feetBox(k.x, k.y, KNIGHT_WIDTH, knightHeight(k.action));
}
