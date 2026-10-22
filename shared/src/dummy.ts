import { DUMMY_ARMOR } from './combat/damage.ts';
import { feetBox, type Point, type Rect } from './geometry.ts';

export const DUMMY_WIDTH = 16;
export const DUMMY_HEIGHT = 40;

/** Mannequin d'entraînement : immobile, vie infinie, il compte les coups reçus. */
export interface DummyState {
  id: string;
  x: number;
  y: number;
  armor: number;
  hitstop: number;
  hitsTaken: number;
  lastDamage: number;
  totalDamage: number;
}

export function createDummy(id: string, at: Point): DummyState {
  return {
    id,
    x: at.x,
    y: at.y,
    armor: DUMMY_ARMOR,
    hitstop: 0,
    hitsTaken: 0,
    lastDamage: 0,
    totalDamage: 0,
  };
}

/** Boîte d'un mannequin, à partir de sa seule position. */
export function dummyBox(d: Point): Rect {
  return feetBox(d.x, d.y, DUMMY_WIDTH, DUMMY_HEIGHT);
}

export function updateDummy(d: DummyState): void {
  if (d.hitstop > 0) d.hitstop--;
}
