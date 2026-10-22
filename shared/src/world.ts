import { applyHits, detectHits, type HitTarget, type KnightHit } from './combat/hits.ts';
import { DT } from './constants.ts';
import { createDummy, dummyBox, updateDummy, type DummyState } from './dummy.ts';
import type { HitEvent } from './events.ts';
import { overlaps, type Rect } from './geometry.ts';
import { NEUTRAL_INPUT, type InputFrame } from './input.ts';
import { clamp } from './math.ts';
import { moveAndCollide } from './physics.ts';
import { createKnight, knightBox, knightHeight, type KnightState } from './knight/state.ts';
import { KNIGHT_WIDTH, PUSH_OUT_SPEED } from './knight/tuning.ts';
import { updateKnight } from './knight/update.ts';
import type { RoomDef, SpawnPoint } from './room.ts';

/** État complet de la simulation. Tout est sérialisable, sauf la salle qui est une donnée fixe. */
export interface World {
  tick: number;
  room: RoomDef;
  knights: KnightState[];
  dummies: DummyState[];
}

/** Ce qu'un chevalier voit de la salle pour avancer d'un tick : les solides et les cibles. */
export interface LevelView {
  solids: readonly Rect[];
  targets: readonly HitTarget[];
}

/** Point d'apparition du joueur n° `index` : les points de la salle, pris dans l'ordre. */
export function spawnPoint(room: RoomDef, index: number): SpawnPoint {
  const spawn = room.spawns[index % Math.max(1, room.spawns.length)];
  if (!spawn) throw new Error(`la salle ${room.id} n'a aucun point d'apparition`);
  return spawn;
}

export function createWorld(room: RoomDef, playerIds: readonly string[] = ['p1']): World {
  return {
    tick: 0,
    room,
    knights: playerIds.map((id, i) => {
      const spawn = spawnPoint(room, i);
      return createKnight(id, spawn, spawn.facing);
    }),
    dummies: room.dummies.map((at, i) => createDummy(`dummy-${i + 1}`, at)),
  };
}

/** Vue de la salle d'un monde, avec ses mannequins comme cibles. */
export function levelOf(world: World): LevelView {
  return { solids: world.room.solids, targets: world.dummies };
}

/** Vue d'une salle à partir de sa seule définition, mannequins à leur position de départ. */
export function staticLevel(room: RoomDef): LevelView {
  return {
    solids: room.solids,
    targets: room.dummies.map((at, i) => createDummy(`dummy-${i + 1}`, at)),
  };
}

/**
 * Avance UN chevalier d'un tick : machine à états, séparation d'avec les mannequins, coups.
 * Ne touche que le chevalier. C'est la fonction que le serveur applique à chaque entrée reçue
 * et que le client rejoue pour prédire son propre chevalier.
 */
export function stepKnight(k: KnightState, input: InputFrame, level: LevelView): KnightHit[] {
  updateKnight(k, input, level.solids);
  separateFromTargets(k, level);
  return detectHits(k, level.targets, input.strike && !k.locked);
}

/**
 * Avance tout le monde d'un tick à partir des entrées de chaque joueur (indexées par id).
 * Modifie `world` en place et renvoie les événements produits pendant ce tick.
 */
export function step(world: World, inputs: Readonly<Record<string, InputFrame>>): HitEvent[] {
  const events: HitEvent[] = [];
  const level = levelOf(world);
  world.tick++;
  for (const k of world.knights) {
    const hits = stepKnight(k, inputs[k.id] ?? NEUTRAL_INPUT, level);
    applyHits(k, hits, world.dummies, events);
  }
  for (const d of world.dummies) updateDummy(d);
  return events;
}

/**
 * Le chevalier ne traverse pas un mannequin : il en est repoussé progressivement.
 * La roulade et la glissade passent au travers, comme une esquive.
 */
function separateFromTargets(k: KnightState, level: LevelView): void {
  if (k.action === 'roll' || k.action === 'slide' || k.action === 'dead' || k.hitstop > 0) return;
  for (const target of level.targets) {
    const kb = knightBox(k);
    const tb = dummyBox(target);
    if (!overlaps(kb, tb)) continue;
    const goal = k.x < target.x ? tb.x - kb.w / 2 : tb.x + tb.w + kb.w / 2;
    const maxStep = PUSH_OUT_SPEED * DT;
    const dx = clamp(goal - k.x, -maxStep, maxStep);
    k.x = moveAndCollide(k.x, k.y, KNIGHT_WIDTH, knightHeight(k.action), dx, 0, level.solids).x;
  }
}
