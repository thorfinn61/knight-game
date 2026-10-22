/**
 * Jauge des Cendres : elle se remplit au fil du combat, en touchant, en parant et en
 * encaissant. Pleine, elle permet l'Embrasement. Elle se garde d'une manche à l'autre et
 * repart de zéro à chaque nouveau duel.
 */
import type { KnightState } from '../knight/state.ts';

export const ASH_MAX = 100;
/** Coup porté, sur l'adversaire ou sur le mannequin. */
export const ASH_ON_HIT = 10;
/** En plus, sur un contre. */
export const ASH_ON_COUNTER = 5;
/** Parade réussie : la façon la plus rapide de remplir la jauge. */
export const ASH_ON_PARRY = 25;
/** Choc des lames, pour chacun des deux. */
export const ASH_ON_CLASH = 5;
/** Par point de vie perdu : de quoi revenir dans un duel mal engagé. */
export const ASH_PER_DAMAGE_TAKEN = 0.5;

/** Ajoute des cendres à la jauge, arrondies à l'entier, sans dépasser le maximum. */
export function gainAsh(k: KnightState, amount: number): void {
  k.ash = Math.min(ASH_MAX, k.ash + Math.round(amount));
}
