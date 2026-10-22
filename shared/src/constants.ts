/** Fréquence de la simulation : 60 ticks par seconde, côté client comme côté serveur. */
export const TICK_RATE = 60;

/** Durée d'un tick en millisecondes. */
export const TICK_MS = 1000 / TICK_RATE;

/** Durée d'un tick en secondes, pour intégrer les vitesses (px/s) et accélérations (px/s²). */
export const DT = 1 / TICK_RATE;
