import { describe, expect, it } from 'vitest';
import { computeDamage } from '../src/combat/damage.ts';
import { ATTACKS } from '../src/combat/attacks.ts';
import { dummyBox } from '../src/dummy.ts';
import { overlaps } from '../src/geometry.ts';
import type { RoomDef } from '../src/room.ts';
import { knightBox } from '../src/knight/state.ts';
import { createWorld, step } from '../src/world.ts';
import { FLOOR_Y, TEST_ROOM, input, knightOf, run, runUntil } from './helpers.ts';

const ROOM_WITH_DUMMY: RoomDef = { ...TEST_ROOM, dummies: [{ x: 250, y: FLOOR_Y }] };

function arena(knightX: number) {
  const w = createWorld(ROOM_WITH_DUMMY);
  knightOf(w).x = knightX;
  const dummy = w.dummies[0];
  if (!dummy) throw new Error('mannequin manquant');
  return { w, dummy };
}

describe('dégâts', () => {
  it('multiplie par la puissance, retire l’armure, au moins 1', () => {
    expect(computeDamage(10, 1.5, 2)).toBe(13);
    expect(computeDamage(3, 1, 10)).toBe(1);
  });
});

describe('coups sur le mannequin', () => {
  it('l’attaque 1 touche une seule fois et gèle les deux combattants', () => {
    const { w, dummy } = arena(220);
    const events = run(w, { attackPressed: true });
    events.push(...run(w, {}, 11));
    expect(events).toHaveLength(1);
    const hit = events[0];
    expect(hit?.attack).toBe('attack1');
    expect(hit?.damage).toBe(ATTACKS.attack1.damage);
    expect(hit?.heavy).toBe(false);
    expect(knightOf(w).hitstop).toBeGreaterThan(0);
    expect(dummy.hitstop).toBeGreaterThan(0);
    run(w, {}, 30);
    expect(dummy.hitsTaken).toBe(1);
  });

  it('le combo complet inflige les deux coups, le second plus lourd', () => {
    const { w, dummy } = arena(220);
    const events = run(w, { attackPressed: true });
    for (let i = 0; i < 40; i++) {
      events.push(...step(w, { p1: input({ attackPressed: i === 8 }) }));
    }
    expect(events.map((e) => e.attack)).toEqual(['attack1', 'attack2']);
    expect(events[1]?.heavy).toBe(true);
    expect(dummy.totalDamage).toBe(ATTACKS.attack1.damage + ATTACKS.attack2.damage);
  });

  it('ne touche pas hors de portée', () => {
    const { w, dummy } = arena(150);
    run(w, { attackPressed: true });
    run(w, {}, 30);
    expect(dummy.hitsTaken).toBe(0);
  });

  it('touche aussi vers la gauche', () => {
    const { w, dummy } = arena(280);
    run(w, { attackPressed: true, moveX: -1 });
    expect(knightOf(w).facing).toBe(-1);
    run(w, {}, 30);
    expect(dummy.hitsTaken).toBe(1);
  });

  it('le chevalier ne traverse pas le mannequin en marchant', () => {
    const { w, dummy } = arena(200);
    run(w, { moveX: 1 }, 90);
    expect(overlaps(knightBox(knightOf(w)), dummyBox(dummy))).toBe(false);
    expect(knightOf(w).x).toBeLessThan(dummy.x);
  });

  it('la roulade passe au travers du mannequin', () => {
    const { w, dummy } = arena(200);
    run(w, { dodgePressed: true });
    runUntil(w, (k) => k.action !== 'roll');
    expect(knightOf(w).x).toBeGreaterThan(dummy.x);
  });
});

describe('déterminisme', () => {
  it('les mêmes entrées donnent exactement le même monde', () => {
    const a = createWorld(ROOM_WITH_DUMMY);
    const b = createWorld(ROOM_WITH_DUMMY);
    let seed = 1234567;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 900; i++) {
      const frame = input({
        moveX: random() < 0.4 ? 1 : random() < 0.5 ? -1 : 0,
        crouch: random() < 0.1,
        jumpHeld: random() < 0.5,
        jumpPressed: random() < 0.05,
        attackPressed: random() < 0.08,
        dodgePressed: random() < 0.03,
      });
      step(a, { p1: frame });
      step(b, { p1: frame });
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.tick).toBe(900);
  });
});
