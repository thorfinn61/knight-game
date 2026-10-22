import {
  ASH_MAX,
  ATTACKS,
  knightHeight,
  type KnightState,
  type Point,
  type RoomDef,
} from '@cendres/shared';
import { flicker } from './flicker.ts';

export type Rgb = readonly [number, number, number];

/** Source de lumière, en coordonnées du monde. */
export interface LightSource {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: Rgb;
}

/** Lumière portée par chaque chevalier. */
export const KNIGHT_LIGHT = { radius: 125, intensity: 1.35, color: [1.0, 0.74, 0.46] as Rgb };
/** Lumière d'une torche : plus courte, plus orangée, et qui vacille davantage. */
export const TORCH_LIGHT = { radius: 104, intensity: 1.15, color: [1.0, 0.6, 0.3] as Rgb };
const TORCH_FLICKER = 2.2;
/** Brasero : un grand feu au sol, plus puissant qu'une torche. */
export const BRAZIER_LIGHT = { radius: 124, intensity: 1.3, color: [1.0, 0.55, 0.25] as Rgb };
const BRAZIER_FLICKER = 2.6;
/** Clair de lune froid qui passe par une brèche du mur. */
export const MOON_LIGHT = { radius: 150, intensity: 0.42, color: [0.45, 0.55, 0.85] as Rgb };

/** La lumière est portée un peu devant le corps, à mi-hauteur. */
const KNIGHT_LIGHT_OFFSET_X = 4;
const KNIGHT_LIGHT_HEIGHT_RATIO = 0.6;
/** Vitesse à laquelle la lumière rattrape le chevalier : elle suit avec un léger retard. */
const KNIGHT_LIGHT_FOLLOW_RATE = 18;
/** Lumière du chevalier selon sa jauge et son Embrasement : multiplicateurs de rayon et d'intensité. */
const GLOW = {
  normal: { radius: 1, intensity: 1 },
  ashFull: { radius: 1.08, intensity: 1.12 },
  gathering: { radius: 1.2, intensity: 1.25 },
  wave: { radius: 1.8, intensity: 1.6 },
  winded: { radius: 0.85, intensity: 0.8 },
};
/** La flambée de l'onde dure un peu plus que l'onde elle-même. */
const WAVE_GLOW_EXTRA_TICKS = 8;

function glowOf(k: KnightState): { radius: number; intensity: number } {
  if (k.action === 'blaze') {
    const [startup = 0, wave = 0] = ATTACKS.blaze.frameTicks;
    if (k.actionTick < startup) return GLOW.gathering;
    if (k.actionTick < startup + wave + WAVE_GLOW_EXTRA_TICKS) return GLOW.wave;
    return GLOW.winded;
  }
  return k.ash >= ASH_MAX ? GLOW.ashFull : GLOW.normal;
}

/**
 * Lumières de la scène. Celle de chaque chevalier le suit avec un léger retard, comme une
 * lanterne qui balance. Torches, braseros et brèches de la salle s'y ajoutent, fixes.
 */
export class LightRig {
  private readonly carried = new Map<string, Point>();
  private readonly torches: readonly Point[];
  private readonly braziers: readonly Point[];
  private readonly breaches: readonly Point[];

  constructor(room: RoomDef) {
    this.torches = room.torches;
    this.braziers = room.braziers;
    this.breaches = room.decor
      .filter((d) => d.kind === 'breach')
      .map((d) => ({ x: d.x + d.w / 2, y: d.y + d.h * 0.6 }));
  }

  sources(
    knights: readonly { id: string; state: KnightState }[],
    timeMs: number,
    deltaMs: number,
  ): LightSource[] {
    const blend = 1 - Math.exp(-(deltaMs / 1000) * KNIGHT_LIGHT_FOLLOW_RATE);
    const sources: LightSource[] = [];
    const seen = new Set<string>();
    knights.forEach(({ id, state }, index) => {
      seen.add(id);
      const targetX = state.x + state.facing * KNIGHT_LIGHT_OFFSET_X;
      const targetY = state.y - knightHeight(state.action) * KNIGHT_LIGHT_HEIGHT_RATIO;
      let light = this.carried.get(id);
      if (!light) {
        light = { x: targetX, y: targetY };
        this.carried.set(id, light);
      }
      light.x += (targetX - light.x) * blend;
      light.y += (targetY - light.y) * blend;
      const wobble = flicker(timeMs, 1, index);
      const glow = glowOf(state);
      sources.push({
        x: light.x,
        y: light.y,
        radius: KNIGHT_LIGHT.radius * wobble.radius * glow.radius,
        intensity: KNIGHT_LIGHT.intensity * wobble.intensity * glow.intensity,
        color: KNIGHT_LIGHT.color,
      });
    });
    for (const id of this.carried.keys()) if (!seen.has(id)) this.carried.delete(id);

    const fire = (
      points: readonly Point[],
      light: typeof TORCH_LIGHT,
      strength: number,
      seed: number,
    ) =>
      points.forEach((point, index) => {
        const wobble = flicker(timeMs, strength, index + seed);
        sources.push({
          x: point.x,
          y: point.y - 4,
          radius: light.radius * wobble.radius,
          intensity: light.intensity * wobble.intensity,
          color: light.color,
        });
      });
    fire(this.braziers, BRAZIER_LIGHT, BRAZIER_FLICKER, 20);
    fire(this.torches, TORCH_LIGHT, TORCH_FLICKER, 10);
    for (const breach of this.breaches) sources.push({ ...breach, ...MOON_LIGHT });
    return sources;
  }
}
