import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/combat/attacks.ts';
import { OPPONENT_TARGET, activeHitbox, type KnightHit } from '../src/combat/hits.ts';
import {
  CLASH_STUN_TICKS,
  COUNTER_DAMAGE_MULTIPLIER,
  PARRY_GRACE_TICKS,
  PARRY_STAGGER_TICKS,
  judgeStrike,
} from '../src/duel.ts';
import { PARRY_ACTIVE_TICKS, PARRY_TICKS } from '../src/knight/frameData.ts';
import { createKnight, type KnightState } from '../src/knight/state.ts';
import { isParrying } from '../src/knight/update.ts';
import { ARENA } from '../src/rooms/arena.ts';
import { staticLevel, stepKnight } from '../src/world.ts';
import { arena, input } from './helpers.ts';

const FLOOR = ARENA.spawns[0]!.y;
const level = { ...staticLevel(ARENA), targets: [] };

/** Fait sortir un coup de `k` jusqu'à sa première frame active. */
function ticksUntilActive(k: KnightState): number {
  const copy = { ...k };
  stepKnight(copy, input({ attackPressed: true }), level);
  let ticks = 1;
  while (!activeHitbox(copy)) {
    stepKnight(copy, input(), level);
    ticks++;
  }
  return ticks;
}

describe('parade', () => {
  it('active dès le premier tick, puis une récupération sans annulation possible', () => {
    const k = createKnight('a', { x: 200, y: FLOOR });
    stepKnight(k, input({ parryPressed: true }), level);
    expect(k.action).toBe('parry');
    let active = 0;
    for (let t = 1; t < PARRY_TICKS; t++) {
      if (isParrying(k)) active++;
      stepKnight(k, input({ dodgePressed: true, attackPressed: true, parryPressed: true }), level);
      if (t < PARRY_TICKS - 1) expect(k.action).toBe('parry');
    }
    expect(active).toBe(PARRY_ACTIVE_TICKS);
    stepKnight(k, input(), level);
    expect(k.action).not.toBe('parry');
  });

  it('une parade au bon moment déséquilibre l’attaquant et garantit la riposte', () => {
    const { a, b, events, step } = arena();
    step({ attackPressed: true });
    // Le défenseur pare juste avant que le coup ne sorte.
    const before = ticksUntilActive(createKnight('x', { x: 0, y: FLOOR }));
    for (let t = 1; t < before - 3; t++) step({ strike: true });
    step({ strike: true }, { parryPressed: true });
    for (let t = 0; t < 8; t++) step({ strike: true });
    expect(events.map((e) => e.type)).toEqual(['parry']);
    expect(a.action).toBe('hurt');
    expect(a.stun).toBe(PARRY_STAGGER_TICKS);
    expect(b.hp).toBe(b.maxHp);

    // Riposte : attaque 1 puis attaque 2, l'attaquant n'a pas le temps de se remettre.
    let pressedAgain = false;
    for (let t = 0; t < 60; t++) {
      const combo = !pressedAgain && b.action === 'attack1' && b.actionTick >= 3;
      if (combo) pressedAgain = true;
      step({ dodgePressed: true }, { attackPressed: t === 0 || combo, strike: true });
    }
    const hits = events.filter((e) => e.type === 'hit');
    expect(hits.map((e) => e.type === 'hit' && e.attack)).toEqual(['attack1', 'attack2']);
    expect(a.hp).toBe(a.maxHp - ATTACKS.attack1.damage - ATTACKS.attack2.damage);
  });

  it('une parade lancée un peu tard compte encore, grâce au délai de grâce', () => {
    const { a, b, events, step } = arena();
    step({ attackPressed: true });
    while (!activeHitbox(a)) step({ strike: true });
    // Le coup est annoncé ; le défenseur pare deux ticks après (sa parade arrive en retard).
    step({ strike: true });
    step({ strike: true });
    step({ strike: true }, { parryPressed: true });
    for (let t = 0; t < PARRY_GRACE_TICKS + 2; t++) step();
    expect(events.map((e) => e.type)).toEqual(['parry']);
    expect(b.hp).toBe(b.maxHp);
  });

  it('sans parade, le coup en attente est appliqué à la fin du délai', () => {
    const { a, b, events, step } = arena();
    step({ attackPressed: true });
    while (!activeHitbox(a)) step({ strike: true });
    for (let t = 0; t < PARRY_GRACE_TICKS + 2; t++) step({ strike: true });
    expect(events.map((e) => e.type)).toEqual(['hit']);
    expect(b.hp).toBe(b.maxHp - ATTACKS.attack1.damage);
  });

  it('parer au hasard se paie : touché pendant la récupération, c’est un contre', () => {
    const { a, b, events, step } = arena();
    step({}, { parryPressed: true });
    for (let t = 0; t < PARRY_ACTIVE_TICKS; t++) step();
    step({ attackPressed: true });
    for (let t = 0; t < 20; t++) step({ strike: true });
    const hit = events.find((e) => e.type === 'hit');
    expect(hit?.type === 'hit' && hit.counter).toBe(true);
    expect(b.hp).toBe(b.maxHp - Math.round(ATTACKS.attack1.damage * COUNTER_DAMAGE_MULTIPLIER));
  });
});

describe('choc des lames', () => {
  it('deux coups qui se croisent s’annulent : pas de dégâts, les deux reculent', () => {
    const { a, b, events, step } = arena(44);
    step({ attackPressed: true }, { attackPressed: true });
    for (let t = 0; t < 14; t++) step({ strike: true }, { strike: true });
    expect(events.map((e) => e.type)).toEqual(['clash']);
    expect(a.hp).toBe(a.maxHp);
    expect(b.hp).toBe(b.maxHp);
    expect(a.action).toBe('hurt');
    expect(b.action).toBe('hurt');
    expect(a.stun).toBe(CLASH_STUN_TICKS);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('frapper le premier pendant l’armé adverse n’est pas un choc mais un contre', () => {
    const attacker = createKnight('a', { x: 200, y: FLOOR }, 1);
    stepKnight(attacker, input({ attackPressed: true }), level);
    while (!activeHitbox(attacker)) stepKnight(attacker, input(), level);
    const defender = {
      ...createKnight('b', { x: 240, y: FLOOR }, -1),
      action: 'attack1' as const,
      actionTick: 2,
    };
    expect(judgeStrike(attacker, defender, 'fighting')).toBe('hit');
  });
});

describe('verdict d’un coup annoncé', () => {
  const hit: KnightHit = {
    targetIndex: OPPONENT_TARGET,
    attack: 'attack1',
    damage: 10,
    heavy: false,
    x: 0,
    y: 0,
    direction: 1,
  };
  void hit;
  it('attend un adversaire qui peut encore parer, applique tout de suite sinon', () => {
    const attacker = createKnight('a', { x: 200, y: FLOOR }, 1);
    stepKnight(attacker, input({ attackPressed: true }), level);
    while (!activeHitbox(attacker)) stepKnight(attacker, input(), level);
    expect(judgeStrike(attacker, createKnight('b', { x: 240, y: FLOOR }), 'fighting')).toBe(
      'pending',
    );
    const rolling = {
      ...createKnight('b', { x: 240, y: FLOOR }),
      action: 'roll' as const,
      actionTick: 25,
    };
    expect(judgeStrike(attacker, rolling, 'fighting')).toBe('hit');
    const parrying = {
      ...createKnight('b', { x: 240, y: FLOOR }),
      action: 'parry' as const,
      actionTick: 3,
    };
    expect(judgeStrike(attacker, parrying, 'fighting')).toBe('parried');
    expect(judgeStrike(attacker, createKnight('b', { x: 400, y: FLOOR }), 'fighting')).toBe(
      'refused',
    );
  });
});
