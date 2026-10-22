import { describe, expect, it } from 'vitest';
import { ATTACKS, isAttackId } from '../src/combat/attacks.ts';
import { OPPONENT_TARGET } from '../src/combat/hits.ts';
import { StrikeReferee } from '../src/duel.ts';
import type { WorldEvent } from '../src/events.ts';
import type { InputFrame } from '../src/input.ts';
import { PARRY_ACTIVE_TICKS, frameAt } from '../src/knight/frameData.ts';
import { createKnight, type KnightState } from '../src/knight/state.ts';
import { ARENA } from '../src/rooms/arena.ts';
import { staticLevel, stepKnight } from '../src/world.ts';
import { input } from './helpers.ts';

const level = { ...staticLevel(ARENA), targets: [] };
const ONE_MINUTE = 3600;
type Player = (self: KnightState, foe: KnightState) => Partial<InputFrame>;

const distance = (a: KnightState, b: KnightState) => Math.abs(b.x - a.x);
const toward = (a: KnightState, b: KnightState) => Math.sign(b.x - a.x) as 1 | -1;
const busy = (k: KnightState) => k.action === 'hurt' || k.hitstop > 0 || k.action === 'dead';

/** L'adversaire vient de rater son coup et n'est pas encore remis. */
function whiffed(k: KnightState): boolean {
  if (!isAttackId(k.action) || k.hitMask !== 0) return false;
  const def = ATTACKS[k.action];
  return frameAt(def.frameTicks, k.actionTick) >= def.frameTicks.length - 1;
}

/** Poursuit son combo s'il a touché, ne fait rien d'autre pendant une attaque. */
function finishAttack(self: KnightState): Partial<InputFrame> | null {
  if (self.action === 'attack1' && self.hitMask !== 0) return { attackPressed: true, strike: true };
  if (isAttackId(self.action)) return { strike: true };
  return null;
}

/** Tient la distance : juste hors de portée, recule si on le presse, roule s'il est acculé. */
function keepDistance(self: KnightState, foe: KnightState): Partial<InputFrame> {
  const d = distance(self, foe);
  const dir = toward(self, foe);
  if (d < 70) {
    const cornered = (dir === 1 && self.x < 40) || (dir === -1 && self.x > ARENA.width - 40);
    return cornered ? { moveX: dir, dodgePressed: true } : { moveX: (dir * -1) as 1 | -1 };
  }
  return d > 82 ? { moveX: dir } : {};
}

/** Fonce et appuie sur attaque à chaque tick, en annonçant toujours un coup. */
const masher: Player = (self, foe) => {
  const dx = foe.x - self.x;
  return {
    moveX: Math.abs(dx) > 30 ? (Math.sign(dx) as 1 | -1) : 0,
    attackPressed: true,
    strike: true,
  };
};

/** Garde ses distances et ne frappe que pour punir un coup raté. */
const patient: Player = (self, foe) => {
  if (busy(self)) return {};
  const attacking = finishAttack(self);
  if (attacking) return attacking;
  const dir = toward(self, foe);
  if (whiffed(foe))
    return distance(self, foe) < 66
      ? { moveX: dir, attackPressed: true, strike: true }
      : { moveX: dir };
  return keepDistance(self, foe);
};

/** Lit l'armé adverse et le pare, puis riposte sur l'adversaire déséquilibré. */
const parrier: Player = (self, foe) => {
  if (busy(self)) return {};
  const attacking = finishAttack(self);
  if (attacking) return attacking;
  const d = distance(self, foe);
  const dir = toward(self, foe);
  if (foe.action === 'hurt' && foe.stun > 20)
    return d < 66 ? { moveX: dir, attackPressed: true, strike: true } : { moveX: dir };
  if (foe.action === 'attack1' && foe.actionTick >= 5 && foe.actionTick <= 7 && d < 80)
    return { parryPressed: true };
  return keepDistance(self, foe);
};

/** Pare sans arrêt, sur place. */
const parrySpammer: Player = () => ({ parryPressed: true });

/** Frappe pendant la récupération d'une parade adverse. */
const parryPunisher: Player = (self, foe) => {
  if (busy(self)) return {};
  const attacking = finishAttack(self);
  if (attacking) return attacking;
  const d = distance(self, foe);
  const dir = toward(self, foe);
  const recovering =
    foe.action === 'parry' && foe.actionTick >= 1 && foe.actionTick <= PARRY_ACTIVE_TICKS;
  if (recovering && d < 66) return { moveX: dir, attackPressed: true, strike: true };
  return d > 60 ? { moveX: dir } : {};
};

/** Un duel simulé tick par tick, avec l'arbitre du serveur. */
function duel(left: Player, right: Player) {
  const a = createKnight('gauche', ARENA.spawns[0]!, 1);
  const b = createKnight('droite', ARENA.spawns[1]!, -1);
  const referee = new StrikeReferee();
  const events: WorldEvent[] = [];
  const find = (id: string) => [a, b].find((k) => k.id === id);
  let tick = 0;
  for (; tick < ONE_MINUTE && a.hp > 0 && b.hp > 0; tick++) {
    const frames = [left(a, b), right(b, a)] as const;
    for (const [self, other, frame] of [
      [a, b, frames[0]],
      [b, a, frames[1]],
    ] as const) {
      for (const hit of stepKnight(self, input(frame), level)) {
        if (hit.targetIndex === OPPONENT_TARGET)
          events.push(...referee.claim(self, other, hit, 'fighting', tick));
      }
    }
    events.push(...referee.resolve(find, 'fighting', tick));
  }
  const dealtBy = (id: string) =>
    events.reduce((sum, e) => sum + (e.type === 'hit' && e.attackerId === id ? e.damage : 0), 0);
  return { a, b, events, left: dealtBy('gauche'), right: dealtBy('droite'), seconds: tick / 60 };
}

describe('équilibrage', () => {
  it('matraquer perd contre un joueur qui garde ses distances et punit', () => {
    const result = duel(masher, patient);
    expect(result.a.hp).toBe(0);
    expect(result.b.hp).toBeGreaterThan(result.b.maxHp / 2);
    expect(result.right).toBeGreaterThan(result.left * 3);
    expect(result.seconds).toBeLessThan(30);
  });

  it('matraquer perd contre un joueur qui pare et riposte', () => {
    const result = duel(masher, parrier);
    expect(result.a.hp).toBe(0);
    expect(result.events.some((e) => e.type === 'parry')).toBe(true);
    expect(result.right).toBeGreaterThan(result.left * 3);
  });

  it('parer sans arrêt perd contre un joueur qui frappe pendant la récupération', () => {
    const result = duel(parrySpammer, parryPunisher);
    expect(result.a.hp).toBe(0);
    expect(result.b.hp).toBe(result.b.maxHp);
  });
});
