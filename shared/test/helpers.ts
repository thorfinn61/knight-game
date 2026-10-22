import { OPPONENT_TARGET } from '../src/combat/hits.ts';
import { StrikeReferee } from '../src/duel.ts';
import type { HitEvent, WorldEvent } from '../src/events.ts';
import { NEUTRAL_INPUT, type InputFrame } from '../src/input.ts';
import { createKnight, type KnightState } from '../src/knight/state.ts';
import type { RoomDef } from '../src/room.ts';
import { ARENA } from '../src/rooms/arena.ts';
import { createWorld, staticLevel, step, stepKnight, type World } from '../src/world.ts';

export const FLOOR_Y = 200;

/**
 * Salle de test : sol plat qui s'arrête à x = 600 (un bord dans le vide), mur à gauche,
 * et un bloc suspendu entre x = 300 et 360 qui laisse 28 px de hauteur libre.
 */
export const TEST_ROOM: RoomDef = {
  id: 'test',
  width: 1000,
  height: 300,
  solids: [
    { kind: 'stone', x: 0, y: FLOOR_Y, w: 600, h: 100 },
    { kind: 'stone', x: -10, y: 0, w: 10, h: 300 },
    { kind: 'stone', x: 300, y: 0, w: 60, h: FLOOR_Y - 28 },
  ],
  decor: [],
  spawns: [
    { x: 100, y: FLOOR_Y, facing: 1 },
    { x: 200, y: FLOOR_Y, facing: -1 },
  ],
  dummies: [],
  torches: [],
  braziers: [],
};

export function makeWorld(room: RoomDef = TEST_ROOM): World {
  return createWorld(room, ['p1']);
}

export function knightOf(world: World): KnightState {
  const k = world.knights[0];
  if (!k) throw new Error('aucun chevalier dans le monde');
  return k;
}

export function input(overrides: Partial<InputFrame> = {}): InputFrame {
  return { ...NEUTRAL_INPUT, ...overrides };
}

/** Avance de `ticks` ticks avec la même entrée, et renvoie les événements produits. */
export function run(world: World, overrides: Partial<InputFrame> = {}, ticks = 1): HitEvent[] {
  const events: HitEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...step(world, { p1: input(overrides) }));
  return events;
}

/** Avance jusqu'à ce que `done` soit vrai, en échouant au-delà de `maxTicks`. */
export function runUntil(
  world: World,
  done: (k: KnightState) => boolean,
  overrides: Partial<InputFrame> = {},
  maxTicks = 600,
): number {
  for (let i = 1; i <= maxTicks; i++) {
    step(world, { p1: input(overrides) });
    if (done(knightOf(world))) return i;
  }
  throw new Error(`condition non atteinte en ${maxTicks} ticks`);
}

const ARENA_FLOOR = ARENA.spawns[0]!.y;
const ARENA_LEVEL = { ...staticLevel(ARENA), targets: [] };

/**
 * Deux combattants de l'arène, un arbitre comme celui du serveur, et une horloge en ticks.
 * `a` est en x = 200, tourné vers la droite ; `b` est à `gap` pixels, tourné vers `a`.
 */
export function arena(gap = 40) {
  const a = createKnight('a', { x: 200, y: ARENA_FLOOR }, 1);
  const b = createKnight('b', { x: 200 + gap, y: ARENA_FLOOR }, gap >= 0 ? -1 : 1);
  const referee = new StrikeReferee();
  const events: WorldEvent[] = [];
  let tick = 0;
  const find = (id: string) => [a, b].find((k) => k.id === id);
  const step = (inputA: Partial<InputFrame> = {}, inputB: Partial<InputFrame> = {}) => {
    tick++;
    for (const [self, other, frame] of [
      [a, b, inputA],
      [b, a, inputB],
    ] as const) {
      for (const hit of stepKnight(self, input(frame), ARENA_LEVEL)) {
        if (hit.targetIndex === OPPONENT_TARGET)
          events.push(...referee.claim(self, other, hit, 'fighting', tick));
      }
    }
    events.push(...referee.resolve(find, 'fighting', tick));
  };
  return { a, b, events, step };
}
