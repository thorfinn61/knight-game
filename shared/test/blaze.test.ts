import { describe, expect, it } from 'vitest';
import {
  ASH_MAX,
  ASH_ON_HIT,
  ASH_ON_PARRY,
  ASH_PER_DAMAGE_TAKEN,
  gainAsh,
} from '../src/combat/ash.ts';
import { ATTACKS } from '../src/combat/attacks.ts';
import { activeHitbox } from '../src/combat/hits.ts';
import {
  COUNTDOWN_MS,
  COUNTER_DAMAGE_MULTIPLIER,
  MATCH_OVER_MS,
  ROUND_OVER_MS,
  advanceDuel,
  createDuelState,
  type Duelist,
} from '../src/duel.ts';
import { createKnight } from '../src/knight/state.ts';
import { isInvulnerable } from '../src/knight/update.ts';
import { ARENA } from '../src/rooms/arena.ts';
import { arena } from './helpers.ts';

const counterDamage = (base: number) => Math.round(base * COUNTER_DAMAGE_MULTIPLIER);

describe('jauge des Cendres', () => {
  it('se remplit en touchant, en encaissant et en parant, sans dépasser le maximum', () => {
    const hit = arena();
    hit.step({ attackPressed: true });
    for (let t = 0; t < 30; t++) hit.step({ strike: true });
    expect(hit.a.ash).toBe(ASH_ON_HIT);
    expect(hit.b.ash).toBe(Math.round(ATTACKS.attack1.damage * ASH_PER_DAMAGE_TAKEN));

    const parry = arena();
    parry.step({ attackPressed: true });
    while (!activeHitbox(parry.a)) parry.step({ strike: true });
    parry.step({ strike: true }, { parryPressed: true });
    for (let t = 0; t < 10; t++) parry.step();
    expect(parry.events.map((e) => e.type)).toEqual(['parry']);
    expect(parry.b.ash).toBe(ASH_ON_PARRY);
    expect(parry.a.ash).toBe(0);

    const full = createKnight('k', { x: 0, y: 0 });
    full.ash = ASH_MAX - 3;
    gainAsh(full, ASH_ON_PARRY);
    expect(full.ash).toBe(ASH_MAX);
  });

  it('se garde d’une manche à l’autre, et repart de zéro au duel suivant', () => {
    const duel = createDuelState();
    const fighters: Duelist[] = [
      { ...createKnight('a', ARENA.spawns[0]!, 1), wins: 0 },
      { ...createKnight('b', ARENA.spawns[1]!, -1), wins: 0 },
    ];
    const [a, b] = fighters as [Duelist, Duelist];
    let now = 0;
    const winRoundForA = () => {
      advanceDuel(duel, fighters, ARENA, (now += COUNTDOWN_MS));
      expect(duel.phase).toBe('fighting');
      b.hp = 0;
      advanceDuel(duel, fighters, ARENA, (now += 1));
      advanceDuel(duel, fighters, ARENA, (now += ROUND_OVER_MS));
    };
    advanceDuel(duel, fighters, ARENA, now);
    a.ash = 60;
    winRoundForA();
    expect(duel.round).toBe(2);
    expect(a.ash).toBe(60);
    expect(b.hp).toBe(b.maxHp);

    winRoundForA();
    expect(duel.phase).toBe('matchOver');
    advanceDuel(duel, fighters, ARENA, (now += MATCH_OVER_MS));
    expect(duel.round).toBe(1);
    expect(a.ash).toBe(0);
  });
});

describe('Embrasement', () => {
  it('exige une jauge pleine, au sol, et la vide d’un coup', () => {
    const { a, step } = arena(120);
    a.ash = ASH_MAX - 1;
    step({ blazePressed: true });
    expect(a.action).toBe('idle');
    // L'appui reste en mémoire quelques ticks, comme les autres : on le laisse expirer.
    for (let t = 0; t < 10; t++) step();

    a.ash = ASH_MAX;
    step({ jumpPressed: true, jumpHeld: true });
    step({ blazePressed: true, jumpHeld: true });
    expect(a.action).toBe('jump');
    while (!a.grounded) step();
    step({ blazePressed: true });
    expect(a.action).toBe('blaze');
    expect(a.ash).toBe(0);
  });

  it('l’onde touche de tous côtés, passe à travers une parade et projette loin', () => {
    // L'adversaire est dans le dos et lève sa garde juste avant l'onde.
    const { a, b, events, step } = arena(-30);
    a.ash = ASH_MAX;
    step({ blazePressed: true });
    while (a.actionTick < 12) step();
    step({ strike: true }, { parryPressed: true });
    for (let t = 0; t < 12; t++) step({ strike: true });

    expect(events.map((e) => e.type === 'hit' && e.attack)).toEqual(['blaze']);
    expect(b.hp).toBe(b.maxHp - ATTACKS.blaze.damage);
    expect(b.action).toBe('hurt');
    expect(b.stun).toBe(ATTACKS.blaze.stun);
    expect(b.vx).toBeLessThan(0);
    // L'Embrasement ne recharge pas la jauge de celui qui le lance.
    expect(a.ash).toBe(0);
  });

  it('invulnérable dès l’armé : lancé en encaissant, il brise le combo et le punit', () => {
    const { a, b, events, step } = arena();
    b.ash = ASH_MAX;
    step({ attackPressed: true });
    const blazed = () => events.some((e) => e.type === 'hit' && e.attackerId === 'b');
    for (let t = 0; t < 120 && !blazed(); t++) {
      step(
        { attackPressed: true, strike: true },
        { blazePressed: b.action === 'hurt', strike: true },
      );
    }

    const hits = events.flatMap((e) => (e.type === 'hit' ? [e] : []));
    expect(hits.map((e) => [e.attackerId, e.attack, e.counter])).toEqual([
      ['a', 'attack1', false],
      ['b', 'blaze', true],
    ]);
    expect(b.hp).toBe(b.maxHp - ATTACKS.attack1.damage);
    expect(a.hp).toBe(a.maxHp - counterDamage(ATTACKS.blaze.damage));
  });

  it('une roulade au bon moment passe à travers l’onde', () => {
    const { a, b, events, step } = arena(30);
    a.ash = ASH_MAX;
    step({ blazePressed: true });
    while (a.actionTick < 4) step({ strike: true });
    step({ strike: true }, { dodgePressed: true });
    while (a.action === 'blaze') step({ strike: true });
    expect(events).toEqual([]);
    expect(b.hp).toBe(b.maxHp);
  });

  it('raté, il laisse le chevalier essoufflé : puni d’un contre', () => {
    const { a, b, events, step } = arena(70);
    a.ash = ASH_MAX;
    step({ blazePressed: true });
    while (isInvulnerable(a)) step({ strike: true });
    expect(events).toEqual([]);

    for (let t = 0; t < 10; t++) step({}, { moveX: -1 });
    step({}, { attackPressed: true });
    for (let t = 0; t < 20; t++) step({}, { strike: true });
    const hit = events.find((e) => e.type === 'hit');
    expect(hit?.type === 'hit' && hit.attackerId === 'b' && hit.counter).toBe(true);
    expect(a.hp).toBe(a.maxHp - counterDamage(ATTACKS.attack1.damage));
  });
});
