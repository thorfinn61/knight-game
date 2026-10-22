import { describe, expect, it } from 'vitest';
import { createKnight } from '../src/knight/state.ts';
import { ARENA } from '../src/rooms/arena.ts';
import { createWorld, levelOf, staticLevel, step, stepKnight } from '../src/world.ts';
import { input } from './helpers.ts';

describe('contrat de la prédiction réseau', () => {
  it('l’état du chevalier ne contient que des champs scalaires', () => {
    const k = createKnight('p1', { x: 0, y: 0 });
    for (const [field, value] of Object.entries(k)) {
      expect(['number', 'string', 'boolean'], field).toContain(typeof value);
    }
  });

  it('stepKnight ne modifie que le chevalier, jamais les cibles', () => {
    const level = staticLevel(ARENA);
    const before = JSON.stringify(level.targets);
    const k = createKnight('p1', { x: 220, y: ARENA.spawns[0]!.y });
    let hits = 0;
    hits += stepKnight(k, input({ attackPressed: true }), level).length;
    for (let i = 0; i < 20; i++) hits += stepKnight(k, input(), level).length;
    expect(hits).toBe(1);
    expect(k.hitMask).toBe(1);
    expect(JSON.stringify(level.targets)).toBe(before);
  });

  it('rejouer les mêmes entrées depuis un même état redonne exactement le même état', () => {
    const level = staticLevel(ARENA);
    const inputs = Array.from({ length: 240 }, (_, i) =>
      input({
        moveX: i % 50 < 30 ? 1 : -1,
        jumpPressed: i % 37 === 0,
        jumpHeld: i % 37 < 10,
        attackPressed: i % 23 === 0,
        dodgePressed: i % 61 === 0,
      }),
    );
    const start = createKnight('p1', ARENA.spawns[0]!);
    const a = { ...start };
    const b = { ...start };
    for (const frame of inputs) stepKnight(a, frame, level);
    for (const frame of inputs) stepKnight(b, frame, level);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('le chevalier évolue pareil seul ou au sein du monde complet', () => {
    const world = createWorld(ARENA, ['p1']);
    const alone = { ...world.knights[0]! };
    const level = levelOf(createWorld(ARENA, ['p1']));
    for (let i = 0; i < 300; i++) {
      const frame = input({ moveX: 1, attackPressed: i % 20 === 0 });
      step(world, { p1: frame });
      stepKnight(alone, frame, level);
    }
    expect(JSON.stringify(alone)).toBe(JSON.stringify(world.knights[0]));
  });
});
