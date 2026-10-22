import type { AttackId } from './combat/attacks.ts';
import type { Facing } from './geometry.ts';

/** Un coup a porté. Le client s'en sert pour les effets (flash, tremblement, étincelle). */
export interface HitEvent {
  type: 'hit';
  attackerId: string;
  targetId: string;
  attack: AttackId;
  damage: number;
  heavy: boolean;
  /** Contre : la cible était en pleine attaque. Dégâts et recul majorés. */
  counter: boolean;
  /** Point d'impact, au centre de la zone où la hitbox touche la cible. */
  x: number;
  y: number;
  /** Sens du coup. */
  direction: Facing;
}

/** Parade réussie : l'attaquant est déséquilibré, le défenseur peut riposter. */
export interface ParryEvent {
  type: 'parry';
  /** Celui dont le coup a été paré. */
  attackerId: string;
  /** Celui qui a paré. */
  targetId: string;
  x: number;
  y: number;
  direction: Facing;
}

/** Choc des lames : deux coups simultanés s'annulent, les deux combattants reculent. */
export interface ClashEvent {
  type: 'clash';
  attackerId: string;
  targetId: string;
  x: number;
  y: number;
  direction: Facing;
}

export type WorldEvent = HitEvent | ParryEvent | ClashEvent;
