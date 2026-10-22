/**
 * Durées des actions minutées. Pour les actions découpées en frames d'animation, chaque
 * tableau donne la durée en ticks de chaque frame : la somme est la durée de l'action.
 * Le client lit ces mêmes tableaux pour afficher la bonne frame.
 */

export const TURN_FRAME_TICKS: readonly number[] = [3, 3, 3];
export const ROLL_FRAME_TICKS: readonly number[] = Array.from({ length: 12 }, () => 3);

export const TURN_TICKS = totalTicks(TURN_FRAME_TICKS);
export const ROLL_TICKS = totalTicks(ROLL_FRAME_TICKS);
export const DASH_TICKS = 12;
export const CROUCH_DOWN_TICKS = 4;
export const STAND_UP_TICKS = 4;
export const LAND_TICKS = 5;
/**
 * Durée du recul après un coup. Le coup léger dure assez pour que l'attaque 2 suive à coup
 * sûr ; le coup lourd laisse le temps de rouler avant la reprise du combo.
 */
export const HURT_TICKS = 16;
export const HURT_HEAVY_TICKS = 11;

/**
 * Parade : active dès le premier tick pendant PARRY_ACTIVE_TICKS (167 ms), puis une longue
 * récupération (333 ms) où l'on encaisse un contre. Parer au hasard se paie.
 */
export const PARRY_ACTIVE_TICKS = 10;
export const PARRY_TICKS = 30;

/**
 * Feinte : temps d'arrêt bref (100 ms) après avoir annulé son armé, avant de pouvoir agir.
 */
export const FEINT_TICKS = 6;

/** Glissade : entrée, boucle, puis sortie. */
export const SLIDE_START_TICKS = 5;
export const SLIDE_END_TICKS = 5;
export const SLIDE_TICKS = 30;

/** Mort : chute, temps au sol, puis relève (la malédiction empêche de mourir vraiment). */
export const DEATH_FRAMES = 10;
export const DEATH_FALL_FRAME_TICKS = 4;
export const DEATH_LIE_TICKS = 60;
export const DEATH_RISE_FRAME_TICKS = 5;
export const DEATH_FALL_TICKS = DEATH_FRAMES * DEATH_FALL_FRAME_TICKS;
export const DEATH_RISE_TICKS = DEATH_FRAMES * DEATH_RISE_FRAME_TICKS;
export const DEATH_TOTAL_TICKS = DEATH_FALL_TICKS + DEATH_LIE_TICKS + DEATH_RISE_TICKS;

export function totalTicks(frameTicks: readonly number[]): number {
  return frameTicks.reduce((sum, ticks) => sum + ticks, 0);
}

/** Index de la frame affichée au tick donné, bloqué sur la dernière frame en fin d'action. */
export function frameAt(frameTicks: readonly number[], tick: number): number {
  let elapsed = 0;
  for (let i = 0; i < frameTicks.length; i++) {
    elapsed += frameTicks[i] ?? 0;
    if (tick < elapsed) return i;
  }
  return Math.max(0, frameTicks.length - 1);
}
