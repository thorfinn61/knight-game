import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/combat/attacks.ts';
import { OPPONENT_TARGET, activeHitbox } from '../src/combat/hits.ts';
import {
  COUNTER_DAMAGE_MULTIPLIER,
  COUNTER_EXTRA_STUN,
  COUNTDOWN_MS,
  MATCH_OVER_MS,
  ROUNDS_TO_WIN,
  ROUND_OVER_MS,
  ROUND_TIME_MS,
  applyStrike,
  advanceDuel,
  createDuelState,
  strikeLands,
  type DuelState,
  type Duelist,
} from '../src/duel.ts';
import type { InputFrame } from '../src/input.ts';
import { HURT_HEAVY_TICKS, HURT_TICKS } from '../src/knight/frameData.ts';
import { createKnight, type KnightState } from '../src/knight/state.ts';
import { KNIGHT_STAND_HEIGHT, ROLL_IFRAMES_FROM, ROLL_IFRAMES_TO } from '../src/knight/tuning.ts';
import { ARENA } from '../src/rooms/arena.ts';
import { staticLevel, stepKnight } from '../src/world.ts';
import { input } from './helpers.ts';

const FLOOR = ARENA.spawns[0]!.y;
const level = { ...staticLevel(ARENA), targets: [] };

function duelist(id: string, x: number, facing: 1 | -1): Duelist {
  return { ...createKnight(id, { x, y: FLOOR }, facing), wins: 0 };
}

/** Un tick « serveur » : chaque chevalier avance, les coups annoncés sont appliqués. */
function tick(
  a: Duelist,
  b: Duelist,
  inputA: Partial<InputFrame>,
  inputB: Partial<InputFrame> = {},
): number {
  let landed = 0;
  for (const [self, other, frame] of [
    [a, b, inputA],
    [b, a, inputB],
  ] as const) {
    for (const hit of stepKnight(self, input(frame), level)) {
      if (hit.targetIndex === OPPONENT_TARGET && applyStrike(self, other, hit, 'fighting'))
        landed++;
    }
  }
  return landed;
}

describe('coups annoncés', () => {
  it('une annonce ne compte que pendant une frame active, une fois par attaque', () => {
    const k = createKnight('a', { x: 100, y: FLOOR });
    let hits = stepKnight(k, input({ attackPressed: true, strike: true }), level);
    expect(hits).toHaveLength(0);
    let total = 0;
    for (let i = 0; i < 20; i++) total += stepKnight(k, input({ strike: true }), level).length;
    expect(total).toBe(1);
    hits = stepKnight(k, input({ strike: true }), level);
    expect(hits).toHaveLength(0);
  });

  it('un coup annoncé fige l’attaquant pendant le hitstop', () => {
    const k = createKnight('a', { x: 100, y: FLOOR });
    stepKnight(k, input({ attackPressed: true }), level);
    let hit = false;
    for (let i = 0; i < 10 && !hit; i++)
      hit = stepKnight(k, input({ strike: true }), level).length > 0;
    expect(hit).toBe(true);
    expect(k.hitstop).toBe(ATTACKS.attack1.hitstop);
  });

  it('un chevalier verrouillé n’obéit pas et ne frappe pas', () => {
    const k = { ...createKnight('a', { x: 100, y: FLOOR }), locked: true };
    for (let i = 0; i < 30; i++)
      stepKnight(k, input({ moveX: 1, attackPressed: true, strike: true }), level);
    expect(k.x).toBe(100);
    expect(k.action).toBe('idle');
  });
});

describe('validation par le serveur', () => {
  function attackerInActiveFrame(): KnightState {
    const k = createKnight('a', { x: 200, y: FLOOR }, 1);
    stepKnight(k, input({ attackPressed: true }), level);
    while (!activeHitbox(k)) stepKnight(k, input(), level);
    return k;
  }

  it('accepte un coup à portée, refuse un coup trop loin', () => {
    const attacker = attackerInActiveFrame();
    expect(strikeLands(attacker, createKnight('b', { x: attacker.x + 40, y: FLOOR }))).toBe(true);
    expect(strikeLands(attacker, createKnight('b', { x: attacker.x + 120, y: FLOOR }))).toBe(false);
  });

  it('la roulade protège, sauf si l’attaquant ne la voyait pas encore', () => {
    const attacker = attackerInActiveFrame();
    const rolling = {
      ...createKnight('b', { x: attacker.x + 40, y: FLOOR }),
      action: 'roll' as const,
      actionTick: ROLL_IFRAMES_FROM + 1,
    };
    expect(strikeLands(attacker, rolling)).toBe(false);
    // Rembobiné à ce que voyait l'attaquant : debout, juste avant de rouler.
    expect(
      strikeLands(attacker, rolling, { x: rolling.x, y: rolling.y, height: KNIGHT_STAND_HEIGHT }),
    ).toBe(true);
    expect(ROLL_IFRAMES_TO).toBeGreaterThan(ROLL_IFRAMES_FROM);
  });

  it('un adversaire vu trop loin n’est pas touché, même s’il est à portée maintenant', () => {
    const attacker = attackerInActiveFrame();
    const near = createKnight('b', { x: attacker.x + 40, y: FLOOR });
    expect(
      strikeLands(attacker, near, { x: attacker.x + 140, y: FLOOR, height: KNIGHT_STAND_HEIGHT }),
    ).toBe(false);
  });

  it('applique dégâts, recul et gel ; rien hors des phases de combat', () => {
    const attacker = attackerInActiveFrame();
    const defender = createKnight('b', { x: attacker.x + 40, y: FLOOR }, -1);
    const hit = {
      targetIndex: OPPONENT_TARGET,
      attack: 'attack1' as const,
      damage: 10,
      heavy: false,
      x: 0,
      y: 0,
      direction: 1 as const,
    };
    expect(applyStrike(attacker, defender, hit, 'countdown')).toBeNull();
    const event = applyStrike(attacker, defender, hit, 'fighting');
    expect(event?.damage).toBe(ATTACKS.attack1.damage);
    expect(defender.hp).toBe(defender.maxHp - ATTACKS.attack1.damage);
    expect(defender.action).toBe('hurt');
    expect(defender.stun).toBe(HURT_TICKS);
    expect(defender.vx).toBeGreaterThan(0);
    expect(defender.hitstop).toBe(ATTACKS.attack1.hitstop);
    expect(defender.facing).toBe(-1);
  });

  it('toucher un adversaire en pleine attaque est un contre : plus de dégâts et de recul', () => {
    const attacker = attackerInActiveFrame();
    const defender = {
      ...createKnight('b', { x: attacker.x + 40, y: FLOOR }, -1),
      action: 'attack1' as const,
      actionTick: 3,
    };
    const hit = {
      targetIndex: OPPONENT_TARGET,
      attack: 'attack1' as const,
      damage: 10,
      heavy: false,
      x: 0,
      y: 0,
      direction: 1 as const,
    };
    const event = applyStrike(attacker, defender, hit, 'fighting');
    expect(event?.counter).toBe(true);
    expect(event?.damage).toBe(Math.round(ATTACKS.attack1.damage * COUNTER_DAMAGE_MULTIPLIER));
    expect(defender.stun).toBe(HURT_TICKS + COUNTER_EXTRA_STUN);
    expect(defender.action).toBe('hurt');
  });

  it('un coup refusé est annulé chez l’attaquant : ni gel, ni enchaînement', () => {
    const attacker = attackerInActiveFrame();
    const far = createKnight('b', { x: attacker.x + 150, y: FLOOR }, -1);
    const hits = stepKnight(attacker, input({ strike: true, attackPressed: true }), level);
    expect(hits.some((h) => h.targetIndex === OPPONENT_TARGET)).toBe(true);
    expect(attacker.hitstop).toBeGreaterThan(0);
    const hit = hits.find((h) => h.targetIndex === OPPONENT_TARGET)!;
    expect(applyStrike(attacker, far, hit, 'fighting')).toBeNull();
    expect(attacker.hitstop).toBe(0);
    expect(attacker.hitMask).toBe(0);
    for (let i = 0; i < 40; i++) stepKnight(attacker, input({ attackPressed: true }), level);
    expect(far.hp).toBe(far.maxHp);
  });

  it('un coup fatal fait tomber le chevalier', () => {
    const attacker = attackerInActiveFrame();
    const defender = { ...createKnight('b', { x: attacker.x + 40, y: FLOOR }), hp: 5 };
    const hit = {
      targetIndex: OPPONENT_TARGET,
      attack: 'attack1' as const,
      damage: 10,
      heavy: false,
      x: 0,
      y: 0,
      direction: 1 as const,
    };
    applyStrike(attacker, defender, hit, 'fighting');
    expect(defender.hp).toBe(0);
    expect(defender.action).toBe('dead');
  });
});

describe('rythme du combo', () => {
  it('l’attaque 2 suit l’attaque 1 à coup sûr, puis l’adversaire peut s’échapper', () => {
    const a = duelist('a', 200, 1);
    const b = duelist('b', 236, -1);
    const actions: string[] = [];
    const hitTicks: number[] = [];
    let pressedAgain = false;
    for (let t = 0; t < 120; t++) {
      // L'attaquant enchaîne dès que possible et relance le combo sans fin ; touché une
      // première fois, le défenseur tente de rouler à chaque tick.
      const first = t === 0;
      const combo = !pressedAgain && a.action === 'attack1' && a.actionTick >= 3;
      if (combo) pressedAgain = true;
      const loop = a.action === 'attack2' && a.actionTick >= 10;
      const landed = tick(
        a,
        b,
        { attackPressed: first || combo || loop, strike: true },
        { dodgePressed: hitTicks.length > 0, moveX: -1 },
      );
      if (landed > 0) hitTicks.push(t);
      actions.push(b.action);
    }
    const [firstHit, secondHit] = hitTicks;
    expect(hitTicks).toHaveLength(2);
    // Entre les deux coups, le défenseur n'a jamais repris la main.
    expect(actions.slice(firstHit, secondHit).every((action) => action === 'hurt')).toBe(true);
    // Après le second, il roule et le combo relancé ne le touche plus.
    expect(actions.slice(secondHit).includes('roll')).toBe(true);
    expect(b.hp).toBe(b.maxHp - ATTACKS.attack1.damage - ATTACKS.attack2.damage);
    expect(HURT_HEAVY_TICKS).toBeLessThan(HURT_TICKS);
  });
});

describe('manches et duel', () => {
  function setup(): { duel: DuelState; fighters: Duelist[] } {
    return { duel: createDuelState(), fighters: [duelist('a', 100, 1), duelist('b', 300, -1)] };
  }

  it('attend un adversaire, puis compte à rebours et place les combattants', () => {
    const { duel, fighters } = setup();
    advanceDuel(duel, [fighters[0]!], ARENA, 0);
    expect(duel.phase).toBe('waiting');
    advanceDuel(duel, fighters, ARENA, 1000);
    expect(duel.phase).toBe('countdown');
    expect(duel.round).toBe(1);
    expect(fighters.map((f) => f.x)).toEqual(ARENA.spawns.map((s) => s.x));
    expect(fighters.every((f) => f.locked)).toBe(true);
    advanceDuel(duel, fighters, ARENA, 1000 + COUNTDOWN_MS);
    expect(duel.phase).toBe('fighting');
    expect(fighters.every((f) => !f.locked)).toBe(true);
  });

  it('un K.O. donne la manche, puis le duel au premier à deux manches', () => {
    const { duel, fighters } = setup();
    let now = 0;
    advanceDuel(duel, fighters, ARENA, now);
    for (let round = 1; round <= ROUNDS_TO_WIN; round++) {
      now += COUNTDOWN_MS;
      advanceDuel(duel, fighters, ARENA, now);
      expect(duel.phase).toBe('fighting');
      fighters[1]!.hp = 0;
      advanceDuel(duel, fighters, ARENA, now);
      expect(duel.phase).toBe('roundOver');
      expect(duel.roundWinner).toBe('a');
      expect(fighters[0]!.wins).toBe(round);
      now += ROUND_OVER_MS;
      advanceDuel(duel, fighters, ARENA, now);
    }
    expect(duel.phase).toBe('matchOver');
    expect(duel.matchWinner).toBe('a');
    now += MATCH_OVER_MS;
    advanceDuel(duel, fighters, ARENA, now);
    expect(duel.phase).toBe('countdown');
    expect(duel.round).toBe(1);
    expect(fighters.map((f) => f.wins)).toEqual([0, 0]);
    expect(fighters.every((f) => f.hp === f.maxHp)).toBe(true);
  });

  it('à la fin du temps, le plus de vie l’emporte ; à égalité, personne', () => {
    const { duel, fighters } = setup();
    advanceDuel(duel, fighters, ARENA, 0);
    advanceDuel(duel, fighters, ARENA, COUNTDOWN_MS);
    fighters[0]!.hp = 40;
    advanceDuel(duel, fighters, ARENA, COUNTDOWN_MS + ROUND_TIME_MS);
    expect(duel.roundWinner).toBe('b');

    const draw = setup();
    advanceDuel(draw.duel, draw.fighters, ARENA, 0);
    advanceDuel(draw.duel, draw.fighters, ARENA, COUNTDOWN_MS);
    advanceDuel(draw.duel, draw.fighters, ARENA, COUNTDOWN_MS + ROUND_TIME_MS);
    expect(draw.duel.phase).toBe('roundOver');
    expect(draw.duel.roundWinner).toBe('');
    expect(draw.fighters.map((f) => f.wins)).toEqual([0, 0]);
  });

  it('le départ d’un joueur remet le salon en attente', () => {
    const { duel, fighters } = setup();
    advanceDuel(duel, fighters, ARENA, 0);
    advanceDuel(duel, fighters, ARENA, COUNTDOWN_MS);
    fighters[0]!.wins = 1;
    advanceDuel(duel, [fighters[0]!], ARENA, COUNTDOWN_MS + 10);
    expect(duel.phase).toBe('waiting');
    expect(fighters[0]!.wins).toBe(0);
    expect(fighters[0]!.locked).toBe(false);
  });
});
