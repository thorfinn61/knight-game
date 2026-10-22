/** Puissance de base du chevalier : multiplicateur des dégâts infligés. */
export const KNIGHT_POWER = 1;
/** Armure de base : réduction fixe des dégâts reçus. */
export const KNIGHT_ARMOR = 0;
export const DUMMY_ARMOR = 0;

/** Dégâts d'un coup : base × puissance de l'attaquant, moins l'armure de la cible, au moins 1. */
export function computeDamage(base: number, power: number, armor: number): number {
  return Math.max(1, Math.round(base * power - armor));
}
