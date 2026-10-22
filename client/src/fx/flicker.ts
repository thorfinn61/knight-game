/**
 * Vacillement des lumières : bruit lissé, purement visuel, donc hors de la simulation
 * (il n'a pas besoin d'être déterministe).
 */

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Bruit de valeur 1D lissé, dans [-1, 1]. */
function valueNoise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}

export interface Flicker {
  /** Multiplicateur du rayon, proche de 1. */
  radius: number;
  /** Multiplicateur de l'intensité, proche de 1. */
  intensity: number;
}

/**
 * Vacillement à l'instant `timeMs`. `strength` amplifie l'effet (1 pour la lumière portée,
 * davantage pour une flamme nue) ; `phase` décale chaque source pour qu'elles ne battent pas
 * à l'unisson.
 */
export function flicker(timeMs: number, strength = 1, phase = 0): Flicker {
  const t = timeMs / 1000 + phase * 17.3;
  const slow = valueNoise(t * 2.3);
  const fast = valueNoise(t * 9.1 + 40);
  return {
    radius: 1 + (0.035 * slow + 0.015 * fast) * strength,
    intensity: 1 + (0.07 * slow + 0.05 * fast) * strength,
  };
}
