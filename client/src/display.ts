import { GAME_HEIGHT, GAME_WIDTH } from './config.ts';

/**
 * Zoom d'affichage : le plus grand multiple entier, en pixels physiques, qui tient dans la
 * fenêtre. Chaque pixel du jeu reste ainsi un carré net, y compris sur écran haute densité.
 */
export function computeZoom(): number {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.floor(
    Math.min((window.innerWidth * dpr) / GAME_WIDTH, (window.innerHeight * dpr) / GAME_HEIGHT),
  );
  return Math.max(1, scale) / dpr;
}
