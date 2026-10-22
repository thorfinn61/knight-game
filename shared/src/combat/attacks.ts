import type { Rect } from '../geometry.ts';

export type AttackId = 'attack1' | 'attack2' | 'crouchAttack' | 'airAttack' | 'blaze';

export interface AttackDef {
  id: AttackId;
  /** Durée en ticks de chaque frame d'animation. */
  frameTicks: readonly number[];
  /**
   * Hitbox par index de frame active, relative aux pieds, chevalier tourné vers la droite.
   * Mesurées sur l'arc dessiné dans les frames du pack.
   */
  hitboxes: Readonly<Partial<Record<number, Rect>>>;
  damage: number;
  /** Gel du coup, en ticks, appliqué à l'attaquant et à la cible quand le coup porte. */
  hitstop: number;
  /** Coup lourd : retour plus marqué (tremblement, balancement du mannequin). */
  heavy: boolean;
  /** Petite avancée pendant le coup, gérée par la simulation et non par l'animation. */
  lunge?: { fromTick: number; toTick: number; speed: number };
  /** Enchaînement : un appui à partir de `fromTick` lance `next` au tick d'annulation. */
  combo?: { next: AttackId; fromTick: number };
  /**
   * À partir de ce tick, la récupération peut être annulée (combo, esquive, saut), mais
   * seulement si le coup a touché. Un coup dans le vide va jusqu'au bout : c'est ce qui
   * rend le matraquage punissable.
   */
  cancelTick: number;
  /** Touché, le coup s'arrête à ce tick : le reste de la récupération ne punit qu'un raté. */
  endOnHitTick?: number;
  /** Repousse la cible loin de l'attaquant, de quelque côté qu'elle soit. */
  radial?: boolean;
  /** Ni parade ni choc des lames : seules l'esquive et la distance l'évitent. */
  unparryable?: boolean;
  /** Vitesse du recul infligé, à la place du recul léger ou lourd. */
  knockback?: number;
  /** Durée du recul infligé, en ticks, à la place de la durée habituelle. */
  stun?: number;
  /** Coup ultime : il ne recharge pas la jauge des Cendres. */
  ultimate?: boolean;
}

export const ATTACKS: Readonly<Record<AttackId, AttackDef>> = {
  // Coup de taille haut : l'arc passe au-dessus de la tête et retombe devant. L'armé est
  // long (150 ms) pour qu'on puisse le voir venir. Raté, il laisse une longue récupération
  // (270 ms) : de quoi se faire punir. Touché, il s'annule en attaque 2.
  attack1: {
    id: 'attack1',
    frameTicks: [9, 3, 3, 16],
    hitboxes: {
      1: { x: 4, y: -44, w: 46, h: 44 },
      2: { x: 8, y: -36, w: 43, h: 36 },
    },
    damage: 10,
    hitstop: 4,
    heavy: false,
    lunge: { fromTick: 2, toTick: 10, speed: 40 },
    combo: { next: 'attack2', fromTick: 3 },
    cancelTick: 15,
  },
  // Balayage bas qui clôt le combo : il ne s'obtient qu'en touchant avec l'attaque 1, et
  // ne relance rien. Le combo s'arrête à deux coups.
  attack2: {
    id: 'attack2',
    frameTicks: [3, 5, 3, 3, 6, 8],
    hitboxes: {
      2: { x: 2, y: -40, w: 47, h: 40 },
      3: { x: 2, y: -18, w: 31, h: 18 },
    },
    damage: 16,
    hitstop: 7,
    heavy: true,
    lunge: { fromTick: 3, toTick: 11, speed: 90 },
    cancelTick: 20,
  },
  // Coup accroupi : le plus rapide à sortir, mais court, peu puissant et long à récupérer.
  crouchAttack: {
    id: 'crouchAttack',
    frameTicks: [6, 3, 3, 14],
    hitboxes: {
      1: { x: 2, y: -24, w: 43, h: 24 },
      2: { x: 2, y: -14, w: 16, h: 14 },
    },
    damage: 8,
    hitstop: 4,
    heavy: false,
    cancelTick: 12,
  },
  // Attaque en l'air : reprend l'animation de l'attaque 1, le pack n'en ayant pas d'autre.
  airAttack: {
    id: 'airAttack',
    frameTicks: [5, 3, 3, 12],
    hitboxes: {
      1: { x: 4, y: -44, w: 46, h: 44 },
      2: { x: 8, y: -36, w: 43, h: 36 },
    },
    damage: 10,
    hitstop: 4,
    heavy: false,
    cancelTick: 18,
  },
  // Embrasement, jauge des Cendres pleine : une onde de flammes tout autour du chevalier.
  // Frames : armé (233 ms, bien visible), onde, puis un long essoufflement (500 ms) qui
  // fait payer un Embrasement raté. Touché, il s'arrête au tick 24 et l'adversaire est
  // projeté loin : le chevalier reprend la main.
  blaze: {
    id: 'blaze',
    frameTicks: [14, 6, 30],
    hitboxes: {
      1: { x: -46, y: -46, w: 92, h: 46 },
    },
    damage: 12,
    hitstop: 10,
    heavy: true,
    cancelTick: 24,
    endOnHitTick: 24,
    radial: true,
    unparryable: true,
    knockback: 380,
    stun: 30,
    ultimate: true,
  },
};

export function isAttackId(value: string): value is AttackId {
  return Object.hasOwn(ATTACKS, value);
}
