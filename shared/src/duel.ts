/**
 * Règles du duel 1 contre 1, sans dépendance au réseau : le serveur les applique, les tests
 * les vérifient. Un duel se joue en manches ; la première manche perdue est celle où l'on
 * tombe à zéro. Le premier à ROUNDS_TO_WIN manches gagne, puis un nouveau duel commence.
 */
import {
  ASH_ON_CLASH,
  ASH_ON_COUNTER,
  ASH_ON_HIT,
  ASH_ON_PARRY,
  ASH_PER_DAMAGE_TAKEN,
  gainAsh,
} from './combat/ash.ts';
import { ATTACKS, isAttackId } from './combat/attacks.ts';
import { computeDamage } from './combat/damage.ts';
import { activeHitbox, revokeOpponentHit, type KnightHit } from './combat/hits.ts';
import type { ClashEvent, HitEvent, ParryEvent, WorldEvent } from './events.ts';
import { feetBox, intersection, overlaps, type Facing, type Rect } from './geometry.ts';
import { createKnight, knightBox, knightHeight, type KnightState } from './knight/state.ts';
import { KNIGHT_WIDTH } from './knight/tuning.ts';
import {
  endParry,
  hurtKnight,
  isCounterable,
  isInvulnerable,
  isParrying,
  killKnight,
} from './knight/update.ts';
import type { RoomDef } from './room.ts';
import { spawnPoint } from './world.ts';

export type DuelPhase = 'waiting' | 'countdown' | 'fighting' | 'roundOver' | 'matchOver';

export const DUEL_PLAYERS = 2;
export const ROUNDS_TO_WIN = 2;
export const COUNTDOWN_MS = 3000;
export const ROUND_TIME_MS = 60_000;
export const ROUND_OVER_MS = 3000;
export const MATCH_OVER_MS = 5000;

/**
 * Tolérance de portée accordée à un coup annoncé, en pixels. Le serveur juge le coup sur
 * l'adversaire tel que l'attaquant le voyait (rembobiné), d'où une marge faible.
 */
export const STRIKE_REACH_TOLERANCE = 10;

/**
 * Contre : toucher un adversaire en pleine attaque (armé, coup ou récupération) inflige plus
 * de dégâts et un recul plus long. Attaquer au hasard devient la pire des stratégies.
 */
export const COUNTER_DAMAGE_MULTIPLIER = 1.5;
export const COUNTER_EXTRA_STUN = 8;

/**
 * Parade réussie : l'attaquant reste déséquilibré 40 ticks (667 ms), assez pour une riposte
 * complète (attaque 1 puis attaque 2). Les deux combattants marquent un gel plus long.
 */
export const PARRY_STAGGER_TICKS = 40;
export const PARRY_HITSTOP = 8;
export const PARRY_PUSHBACK = 70;

/**
 * Délai de grâce pour parer : un coup porté sur un adversaire qui peut encore parer n'est
 * appliqué qu'après ces ticks. Une parade lancée sur son écran au bon moment, et arrivée au
 * serveur avec un peu de retard, compte quand même.
 */
export const PARRY_GRACE_TICKS = 5;

/** Choc des lames : les deux reculent, sans dégâts. */
export const CLASH_STUN_TICKS = 14;
export const CLASH_HITSTOP = 6;
/**
 * Deux coups sont simultanés si celui du défenseur est actif, ou le devient dans ces ticks.
 * Le serveur traite forcément l'un avant l'autre : sans cette marge, le premier traité
 * gagnerait au lieu de provoquer un choc.
 */
export const CLASH_LEAD_TICKS = 2;

/** L'adversaire tel que l'attaquant le voyait au moment du coup. */
export interface SeenTarget {
  x: number;
  y: number;
  /** Hauteur de la zone vulnérable, 0 pendant une esquive invulnérable ou la mort. */
  height: number;
}

/** Phase du duel, partagée par tous les joueurs du salon. */
export interface DuelState {
  phase: DuelPhase;
  /** Heure (horloge du salon, en ms) à laquelle la phase en cours se termine. */
  phaseEndsAt: number;
  round: number;
  /** Vainqueur de la dernière manche, vide en cas d'égalité. */
  roundWinner: string;
  /** Vainqueur du duel, vide tant qu'il n'est pas terminé. */
  matchWinner: string;
}

/** Un combattant : l'état de son chevalier et son nombre de manches gagnées. */
export interface Duelist extends KnightState {
  wins: number;
}

export function createDuelState(): DuelState {
  return { phase: 'waiting', phaseEndsAt: 0, round: 0, roundWinner: '', matchWinner: '' };
}

/** Hauteur vulnérable d'un chevalier : 0 s'il est invulnérable (roulade, mort). */
export function vulnerableHeight(k: KnightState): number {
  return k.action === 'dead' || isInvulnerable(k) ? 0 : knightHeight(k.action);
}

/** Le chevalier tel qu'il est maintenant, faute de mieux (solo, tests). */
export function seenNow(k: KnightState): SeenTarget {
  return { x: k.x, y: k.y, height: vulnerableHeight(k) };
}

/** Zone vulnérable d'un adversaire vu. */
export function seenBox(seen: SeenTarget): Rect {
  return feetBox(seen.x, seen.y, KNIGHT_WIDTH, seen.height);
}

/**
 * Le coup annoncé par `attacker` est-il plausible ? Le défenseur doit être en vie, et sa
 * zone vulnérable, telle que l'attaquant la voyait, doit croiser la hitbox de l'attaque.
 */
export function strikeLands(
  attacker: KnightState,
  defender: KnightState,
  seen = seenNow(defender),
): boolean {
  if (defender.action === 'dead' || defender.hp <= 0 || seen.height <= 0) return false;
  // Un Embrasement lancé ne s'interrompt pas, même par un coup vu juste avant : il a coûté
  // la jauge entière.
  if (defender.action === 'blaze' && isInvulnerable(defender)) return false;
  const hitbox = activeHitbox(attacker);
  if (!hitbox) return false;
  return overlaps(expand(hitbox, STRIKE_REACH_TOLERANCE), seenBox(seen));
}

/**
 * Applique à `defender` un coup annoncé par `attacker`, s'il porte : dégâts, gel, recul ou
 * chute. Renvoie l'événement à diffuser, ou null si le coup est refusé. Un coup refusé est
 * aussi annulé chez l'attaquant : annoncer des coups dans le vide ne rapporte rien.
 */
export function applyStrike(
  attacker: KnightState,
  defender: KnightState,
  hit: KnightHit,
  phase: DuelPhase,
  seen = seenNow(defender),
): HitEvent | null {
  if (phase !== 'fighting' || !strikeLands(attacker, defender, seen)) {
    revokeOpponentHit(attacker);
    return null;
  }
  const def = ATTACKS[hit.attack];
  const counter = isCounterable(defender);
  const base = counter ? def.damage * COUNTER_DAMAGE_MULTIPLIER : def.damage;
  const damage = computeDamage(base, attacker.power, defender.armor);
  const contact = contactPoint(attacker, seen);
  const push = (def.radial ? (defender.x >= attacker.x ? 1 : -1) : attacker.facing) as Facing;
  defender.hp = Math.max(0, defender.hp - damage);
  if (defender.hp === 0) killKnight(defender, push);
  else {
    hurtKnight(defender, push, def.heavy);
    if (def.knockback !== undefined) defender.vx = push * def.knockback;
    if (def.stun !== undefined) defender.stun = def.stun;
    if (counter) defender.stun += COUNTER_EXTRA_STUN;
  }
  defender.hitstop = def.hitstop;
  if (!def.ultimate) gainAsh(attacker, ASH_ON_HIT + (counter ? ASH_ON_COUNTER : 0));
  gainAsh(defender, damage * ASH_PER_DAMAGE_TAKEN);
  return {
    type: 'hit',
    attackerId: attacker.id,
    targetId: defender.id,
    attack: def.id,
    damage,
    heavy: def.heavy,
    counter,
    x: contact.x,
    y: contact.y,
    direction: push,
  };
}

export type StrikeVerdict = 'refused' | 'parried' | 'clash' | 'pending' | 'hit';

/** Actions depuis lesquelles une parade part au tick suivant : le coup attend un peu. */
const CAN_PARRY_FROM: ReadonlySet<string> = new Set([
  'idle',
  'run',
  'turn',
  'land',
  'crouchDown',
  'crouch',
  'crouchWalk',
  'standUp',
]);

/** Le défenseur pourrait-il encore parer ce coup dans le délai de grâce ? */
export function canParrySoon(k: KnightState): boolean {
  return k.hitstop === 0 && (k.parryBuffer > 0 || CAN_PARRY_FROM.has(k.action));
}

/** Les deux lames se croisent : le défenseur frappe lui aussi l'attaquant, au même instant. */
export function swordsCross(attacker: KnightState, defender: KnightState): boolean {
  if (!isAttackId(defender.action)) return false;
  const body = knightBox(attacker);
  for (let lead = 0; lead <= CLASH_LEAD_TICKS; lead++) {
    const theirs = activeHitbox({ ...defender, actionTick: defender.actionTick + lead });
    if (theirs && overlaps(theirs, body)) return true;
  }
  return false;
}

/** Premier verdict sur un coup annoncé, au moment où le serveur le reçoit. */
export function judgeStrike(
  attacker: KnightState,
  defender: KnightState,
  phase: DuelPhase,
  seen = seenNow(defender),
): StrikeVerdict {
  if (phase !== 'fighting' || !strikeLands(attacker, defender, seen)) return 'refused';
  if (isAttackId(attacker.action) && ATTACKS[attacker.action].unparryable) return 'hit';
  if (isParrying(defender)) return 'parried';
  if (swordsCross(attacker, defender)) return 'clash';
  if (canParrySoon(defender)) return 'pending';
  return 'hit';
}

/** Parade réussie : l'attaquant est déséquilibré et repoussé, le défenseur se libère. */
export function applyParry(attacker: KnightState, defender: KnightState): ParryEvent {
  revokeOpponentHit(attacker);
  const push = defender.facing as Facing;
  hurtKnight(attacker, push);
  attacker.stun = PARRY_STAGGER_TICKS;
  attacker.vx = push * PARRY_PUSHBACK;
  attacker.hitstop = PARRY_HITSTOP;
  endParry(defender);
  defender.hitstop = PARRY_HITSTOP;
  gainAsh(defender, ASH_ON_PARRY);
  const body = knightBox(defender);
  return {
    type: 'parry',
    attackerId: attacker.id,
    targetId: defender.id,
    x: defender.x + defender.facing * 12,
    y: body.y + body.h * 0.45,
    direction: push,
  };
}

/** Choc des lames : aucun dégât, les deux combattants sont rejetés l'un de l'autre. */
export function applyClash(attacker: KnightState, defender: KnightState): ClashEvent {
  revokeOpponentHit(attacker);
  revokeOpponentHit(defender);
  const towardDefender = (defender.x >= attacker.x ? 1 : -1) as Facing;
  for (const [knight, push] of [
    [attacker, (towardDefender * -1) as Facing],
    [defender, towardDefender],
  ] as const) {
    hurtKnight(knight, push);
    knight.stun = CLASH_STUN_TICKS;
    knight.hitstop = CLASH_HITSTOP;
    gainAsh(knight, ASH_ON_CLASH);
  }
  // hurtKnight tourne chacun vers l'origine du coup : ici, vers l'autre.
  const body = knightBox(attacker);
  return {
    type: 'clash',
    attackerId: attacker.id,
    targetId: defender.id,
    x: (attacker.x + defender.x) / 2,
    y: body.y + body.h * 0.4,
    direction: towardDefender,
  };
}

interface PendingStrike {
  attackerId: string;
  defenderId: string;
  hit: KnightHit;
  seen: SeenTarget;
  /** Attaque qui a porté le coup : s'il en est sorti (choc, parade), le coup est perdu. */
  attack: KnightState['action'];
  dueTick: number;
}

/**
 * Arbitre des coups annoncés, côté serveur. Un coup sur un adversaire qui peut encore parer
 * attend PARRY_GRACE_TICKS : si l'adversaire pare entre-temps, le coup est paré.
 */
export class StrikeReferee {
  private pending: PendingStrike[] = [];

  /** Un coup annoncé vient d'être reçu. Renvoie les événements immédiats. */
  claim(
    attacker: KnightState,
    defender: KnightState,
    hit: KnightHit,
    phase: DuelPhase,
    tick: number,
    seen = seenNow(defender),
  ): WorldEvent[] {
    switch (judgeStrike(attacker, defender, phase, seen)) {
      case 'refused':
        revokeOpponentHit(attacker);
        return [];
      case 'parried':
        return [applyParry(attacker, defender)];
      case 'clash':
        return [applyClash(attacker, defender)];
      case 'pending':
        this.pending.push({
          attackerId: attacker.id,
          defenderId: defender.id,
          hit,
          seen,
          attack: attacker.action,
          dueTick: tick + PARRY_GRACE_TICKS,
        });
        return [];
      case 'hit': {
        const event = applyStrike(attacker, defender, hit, phase, seen);
        return event ? [event] : [];
      }
    }
  }

  /** À chaque pas : parade tardive, ou coup appliqué une fois le délai écoulé. */
  resolve(
    find: (id: string) => KnightState | undefined,
    phase: DuelPhase,
    tick: number,
  ): WorldEvent[] {
    const events: WorldEvent[] = [];
    this.pending = this.pending.filter((strike) => {
      const attacker = find(strike.attackerId);
      const defender = find(strike.defenderId);
      if (!attacker || !defender || attacker.action !== strike.attack) return false;
      if (isParrying(defender)) {
        events.push(applyParry(attacker, defender));
        return false;
      }
      if (tick < strike.dueTick) return true;
      const event = applyStrike(attacker, defender, strike.hit, phase, strike.seen);
      if (event) events.push(event);
      return false;
    });
    return events;
  }

  clear(): void {
    this.pending = [];
  }
}

/**
 * Fait avancer les phases du duel à l'heure `now`. `duelists` est rangé par place
 * (gauche puis droite). Appelée à chaque pas de simulation, après les coups.
 */
export function advanceDuel(
  duel: DuelState,
  duelists: readonly Duelist[],
  room: RoomDef,
  now: number,
): void {
  if (duelists.length < DUEL_PLAYERS) {
    if (duel.phase !== 'waiting') enterWaiting(duel, duelists);
    return;
  }
  switch (duel.phase) {
    case 'waiting':
      startMatch(duel, duelists, room, now);
      return;
    case 'countdown':
      if (now < duel.phaseEndsAt) return;
      duel.phase = 'fighting';
      duel.phaseEndsAt = now + ROUND_TIME_MS;
      for (const d of duelists) d.locked = false;
      return;
    case 'fighting': {
      const standing = duelists.filter((d) => d.hp > 0);
      if (standing.length === DUEL_PLAYERS && now < duel.phaseEndsAt) return;
      const winner = standing.length === 1 ? standing[0] : timeoutWinner(standing);
      duel.roundWinner = winner?.id ?? '';
      if (winner) winner.wins++;
      for (const d of duelists) d.locked = true;
      duel.phase = 'roundOver';
      duel.phaseEndsAt = now + ROUND_OVER_MS;
      return;
    }
    case 'roundOver': {
      if (now < duel.phaseEndsAt) return;
      const champion = duelists.find((d) => d.wins >= ROUNDS_TO_WIN);
      if (champion) {
        duel.phase = 'matchOver';
        duel.matchWinner = champion.id;
        duel.phaseEndsAt = now + MATCH_OVER_MS;
      } else {
        startRound(duel, duelists, room, now, duel.round + 1);
      }
      return;
    }
    case 'matchOver':
      if (now >= duel.phaseEndsAt) startMatch(duel, duelists, room, now);
      return;
  }
}

function startMatch(
  duel: DuelState,
  duelists: readonly Duelist[],
  room: RoomDef,
  now: number,
): void {
  for (const d of duelists) {
    d.wins = 0;
    d.ash = 0;
  }
  duel.matchWinner = '';
  startRound(duel, duelists, room, now, 1);
}

/**
 * Chaque combattant revient à sa place, vie pleine, verrouillé pendant le compte à rebours.
 * Sa jauge des Cendres le suit d'une manche à l'autre.
 */
function startRound(
  duel: DuelState,
  duelists: readonly Duelist[],
  room: RoomDef,
  now: number,
  round: number,
): void {
  duelists.forEach((d, place) => {
    const spawn = spawnPoint(room, place);
    Object.assign(d, createKnight(d.id, spawn, spawn.facing), { locked: true, ash: d.ash });
  });
  duel.phase = 'countdown';
  duel.round = round;
  duel.roundWinner = '';
  duel.phaseEndsAt = now + COUNTDOWN_MS;
}

function enterWaiting(duel: DuelState, duelists: readonly Duelist[]): void {
  Object.assign(duel, createDuelState());
  for (const d of duelists) {
    d.wins = 0;
    d.ash = 0;
    d.locked = false;
    if (d.action !== 'dead') d.hp = d.maxHp;
  }
}

/** Fin du temps : le plus de vie l'emporte ; à égalité, personne. */
function timeoutWinner(standing: readonly Duelist[]): Duelist | undefined {
  const [a, b] = standing;
  if (!a) return undefined;
  if (!b) return a;
  if (a.hp === b.hp) return undefined;
  return a.hp > b.hp ? a : b;
}

function expand(r: Rect, margin: number): Rect {
  return { x: r.x - margin, y: r.y - margin / 2, w: r.w + margin * 2, h: r.h + margin };
}

function contactPoint(attacker: KnightState, seen: SeenTarget): { x: number; y: number } {
  const hitbox = activeHitbox(attacker);
  const body = seenBox(seen);
  const zone = hitbox ? intersection(hitbox, body) : null;
  if (zone) return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
  return { x: (attacker.x + seen.x) / 2, y: body.y + body.h / 2 };
}
