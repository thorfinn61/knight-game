import { dummyBox, type DummyState } from '../dummy.ts';
import type { HitEvent } from '../events.ts';
import { intersection, orientBox, type Facing, type Point, type Rect } from '../geometry.ts';
import { frameAt } from '../knight/frameData.ts';
import type { KnightState } from '../knight/state.ts';
import { ASH_ON_HIT, gainAsh } from './ash.ts';
import { ATTACKS, isAttackId, type AttackId } from './attacks.ts';
import { computeDamage } from './damage.ts';

/** Cible qu'un chevalier peut frapper : sa position suffit, avec son armure. */
export interface HitTarget extends Point {
  armor: number;
}

/** Index de cible réservé à l'adversaire en duel, touché sur annonce du joueur. */
export const OPPONENT_TARGET = -1;
/** Bit du masque des cibles touchées réservé à l'adversaire. */
const OPPONENT_BIT = 2 ** 30;

/** Coup porté par un chevalier, avant son application à la cible. */
export interface KnightHit {
  /** Index de la cible dans la liste des cibles de la salle, ou OPPONENT_TARGET. */
  targetIndex: number;
  attack: AttackId;
  damage: number;
  heavy: boolean;
  /** Point d'impact, au centre de la zone où la hitbox touche la cible. */
  x: number;
  y: number;
  direction: Facing;
}

/** Hitbox active du chevalier dans le monde, ou null hors des frames actives. */
export function activeHitbox(k: KnightState): Rect | null {
  if (!isAttackId(k.action)) return null;
  const def = ATTACKS[k.action];
  const local = def.hitboxes[frameAt(def.frameTicks, k.actionTick)];
  return local ? orientBox(local, k.x, k.y, k.facing) : null;
}

function hasBit(mask: number, bit: number): boolean {
  return Math.floor(mask / bit) % 2 === 1;
}

/** Vrai si l'attaque en cours a déjà touché l'adversaire : une seule fois par attaque. */
export function hasHitOpponent(k: KnightState): boolean {
  return hasBit(k.hitMask, OPPONENT_BIT);
}

/**
 * Annule chez l'attaquant un coup annoncé que le serveur a refusé : il n'a pas touché, donc
 * ni gel, ni droit d'annuler sa récupération. Sa prédiction sera corrigée en conséquence.
 */
export function revokeOpponentHit(k: KnightState): void {
  if (!hasHitOpponent(k)) return;
  k.hitMask -= OPPONENT_BIT;
  k.hitstop = 0;
}

/**
 * Coups portés par le chevalier ce tick. Ne modifie que le chevalier : il note les cibles
 * touchées et se fige pendant le hitstop. Les cibles ne sont pas modifiées ici, ce qui permet
 * à la prédiction côté client de rejouer ce calcul sans effet de bord.
 *
 * Les mannequins sont touchés par géométrie. L'adversaire d'un duel l'est sur annonce
 * (`strike`), pendant une frame active, une seule fois par attaque : c'est l'arbitre qui
 * remplit alors la jauge, une fois le coup jugé.
 */
export function detectHits(
  k: KnightState,
  targets: readonly HitTarget[],
  strike = false,
): KnightHit[] {
  if (k.hitstop > 0) return [];
  const hitbox = activeHitbox(k);
  if (!hitbox || !isAttackId(k.action)) return [];
  const def = ATTACKS[k.action];
  const hits: KnightHit[] = [];
  targets.forEach((target, targetIndex) => {
    const bit = 2 ** targetIndex;
    if (hasBit(k.hitMask, bit)) return;
    const contact = intersection(hitbox, dummyBox(target));
    if (!contact) return;
    k.hitMask += bit;
    // Un mannequin ne pare pas : le coup est acquis, la jauge se remplit tout de suite.
    if (!def.ultimate) gainAsh(k, ASH_ON_HIT);
    hits.push({
      targetIndex,
      attack: def.id,
      damage: computeDamage(def.damage, k.power, target.armor),
      heavy: def.heavy,
      x: contact.x + contact.w / 2,
      y: contact.y + contact.h / 2,
      direction: def.radial ? ((target.x >= k.x ? 1 : -1) as Facing) : k.facing,
    });
  });
  if (strike && !hasBit(k.hitMask, OPPONENT_BIT)) {
    k.hitMask += OPPONENT_BIT;
    hits.push({
      targetIndex: OPPONENT_TARGET,
      attack: def.id,
      damage: computeDamage(def.damage, k.power, 0),
      heavy: def.heavy,
      x: hitbox.x + hitbox.w / 2,
      y: hitbox.y + hitbox.h / 2,
      direction: k.facing,
    });
  }
  if (hits.length > 0) k.hitstop = def.hitstop;
  return hits;
}

/** Applique des coups aux mannequins (simulation qui fait autorité) et produit les événements. */
export function applyHits(
  attacker: KnightState,
  hits: readonly KnightHit[],
  dummies: readonly DummyState[],
  events: HitEvent[],
): void {
  for (const hit of hits) {
    if (hit.targetIndex === OPPONENT_TARGET) continue;
    const d = dummies[hit.targetIndex];
    if (!d) continue;
    d.hitsTaken++;
    d.lastDamage = hit.damage;
    d.totalDamage += hit.damage;
    d.hitstop = ATTACKS[hit.attack].hitstop;
    events.push({
      type: 'hit',
      attackerId: attacker.id,
      targetId: d.id,
      attack: hit.attack,
      damage: hit.damage,
      heavy: hit.heavy,
      counter: false,
      x: hit.x,
      y: hit.y,
      direction: hit.direction,
    });
  }
}
