import { ASH_MAX } from '../combat/ash.ts';
import { ATTACKS, isAttackId, type AttackId } from '../combat/attacks.ts';
import { DT } from '../constants.ts';
import type { Facing, Rect } from '../geometry.ts';
import { NEUTRAL_INPUT, type InputFrame } from '../input.ts';
import { approach } from '../math.ts';
import { fits, moveAndCollide, touchesGround } from '../physics.ts';
import {
  CROUCH_DOWN_TICKS,
  DASH_TICKS,
  DEATH_TOTAL_TICKS,
  FEINT_TICKS,
  HURT_HEAVY_TICKS,
  HURT_TICKS,
  LAND_TICKS,
  PARRY_ACTIVE_TICKS,
  PARRY_TICKS,
  ROLL_TICKS,
  SLIDE_TICKS,
  STAND_UP_TICKS,
  TURN_TICKS,
  totalTicks,
} from './frameData.ts';
import { knightHeight, type KnightAction, type KnightState } from './state.ts';
import * as T from './tuning.ts';

/**
 * Fait avancer un chevalier d'un tick : tampons d'entrée, machine à états, puis physique.
 * Pendant un gel de coup (hitstop), seuls les tampons d'entrée sont mis à jour.
 */
export function updateKnight(k: KnightState, rawInput: InputFrame, solids: readonly Rect[]): void {
  // Verrouillé (compte à rebours, fin de manche) : le chevalier vit, mais n'obéit plus.
  const input = k.locked ? NEUTRAL_INPUT : rawInput;
  bufferInputs(k, input);
  if (k.hitstop > 0) {
    k.hitstop--;
    return;
  }
  k.actionTick++;
  runAction(k, input, solids);
  integrate(k, input, solids);
  tickTimers(k);
}

/** Vrai pendant la fenêtre active d'une parade : un coup reçu maintenant est renvoyé. */
export function isParrying(k: KnightState): boolean {
  return k.action === 'parry' && k.actionTick < PARRY_ACTIVE_TICKS;
}

/** Vrai si le chevalier est en plein engagement : armé, coup, récupération, feinte, parade ratée. */
export function isCounterable(k: KnightState): boolean {
  if (isAttackId(k.action) || k.action === 'feint') return true;
  return k.action === 'parry' && k.actionTick >= PARRY_ACTIVE_TICKS;
}

/** Parade réussie : la garde se relâche aussitôt, le chevalier peut riposter. */
export function endParry(k: KnightState): void {
  if (k.action !== 'parry') return;
  k.vx = 0;
  enter(k, 'idle');
}

/** Vrai pendant les frames d'invulnérabilité de la roulade et de l'Embrasement, et la mort. */
export function isInvulnerable(k: KnightState): boolean {
  if (k.action === 'dead') return true;
  if (k.action === 'blaze') return k.actionTick < T.BLAZE_IFRAMES_TO;
  return (
    k.action === 'roll' && k.actionTick >= T.ROLL_IFRAMES_FROM && k.actionTick < T.ROLL_IFRAMES_TO
  );
}

/** L'Embrasement est-il possible ? Jauge des Cendres pleine, au sol. */
export function canBlaze(k: KnightState): boolean {
  return k.ash >= ASH_MAX && k.grounded && k.action !== 'dead';
}

/**
 * Coup reçu : recul dans la direction `push`, le chevalier se tourne vers l'origine du coup.
 * L'invulnérabilité n'est pas vérifiée ici : c'est à l'appelant de décider si le coup porte.
 */
export function hurtKnight(k: KnightState, push: Facing, heavy = false): void {
  clearBuffers(k);
  k.facing = (push === 1 ? -1 : 1) as Facing;
  k.vx = push * (heavy ? T.KNOCKBACK_HEAVY : T.KNOCKBACK_LIGHT);
  k.stun = heavy ? HURT_HEAVY_TICKS : HURT_TICKS;
  enter(k, 'hurt');
}

/** Mort du chevalier, projeté dans la direction `push`. Maudit, il se relève, vie restaurée. */
export function killKnight(k: KnightState, push: Facing | 0 = 0): void {
  if (k.action === 'dead') return;
  clearBuffers(k);
  k.hp = 0;
  k.vx = push * T.KNOCKBACK_HEAVY;
  enter(k, 'dead');
}

// ---------------------------------------------------------------------------------------------
// Tampons et transitions

function bufferInputs(k: KnightState, input: InputFrame): void {
  // Pendant la mort, les appuis sont ignorés : ils ne doivent pas partir à la relève.
  if (k.action === 'dead') return;
  if (input.jumpPressed) k.jumpBuffer = T.JUMP_BUFFER_TICKS;
  if (input.dodgePressed) k.dodgeBuffer = T.DODGE_BUFFER_TICKS;
  if (input.parryPressed) k.parryBuffer = T.PARRY_BUFFER_TICKS;
  if (input.blazePressed) k.blazeBuffer = T.BLAZE_BUFFER_TICKS;
  if (input.attackPressed) {
    k.attackBuffer = T.ATTACK_BUFFER_TICKS;
    if (isAttackId(k.action)) {
      const combo = ATTACKS[k.action].combo;
      if (combo && k.actionTick >= combo.fromTick) k.comboQueued = true;
    }
  }
}

function clearBuffers(k: KnightState): void {
  k.jumpBuffer = 0;
  k.attackBuffer = 0;
  k.dodgeBuffer = 0;
  k.parryBuffer = 0;
  k.blazeBuffer = 0;
  k.comboQueued = false;
  k.hitMask = 0;
  k.charge = 0;
}

/** Entre dans une action, en repartant de son premier tick. */
function enter(k: KnightState, action: KnightAction): void {
  k.action = action;
  k.actionTick = 0;
}

/** Passe dans une action continue (repos, course…) sans la relancer si on y est déjà. */
function switchTo(k: KnightState, action: KnightAction): void {
  if (k.action !== action) enter(k, action);
}

function canStand(k: KnightState, solids: readonly Rect[]): boolean {
  return fits(k.x, k.y, T.KNIGHT_WIDTH, T.KNIGHT_STAND_HEIGHT, solids);
}

function directionOr(input: InputFrame, fallback: Facing): Facing {
  return input.moveX === 0 ? fallback : input.moveX;
}

// ---------------------------------------------------------------------------------------------
// Démarrage des actions

function startJump(k: KnightState): void {
  k.vy = -T.JUMP_SPEED;
  k.grounded = false;
  k.coyote = 0;
  k.jumpBuffer = 0;
  k.jumpCut = false;
  enter(k, 'jump');
}

function startAttack(k: KnightState, id: AttackId, input: InputFrame): void {
  k.facing = directionOr(input, k.facing);
  k.attackBuffer = 0;
  k.comboQueued = false;
  k.hitMask = 0;
  k.charge = 0;
  const lunge = ATTACKS[id].lunge;
  if (lunge && lunge.fromTick === 0) k.vx = k.facing * lunge.speed;
  enter(k, id);
}

function startRoll(k: KnightState, input: InputFrame): void {
  k.facing = directionOr(input, k.facing);
  k.dodgeBuffer = 0;
  k.vx = k.facing * T.ROLL_SPEED;
  enter(k, 'roll');
}

function startSlide(k: KnightState, input: InputFrame): void {
  k.facing = directionOr(input, k.facing);
  k.dodgeBuffer = 0;
  k.vx = k.facing * T.SLIDE_SPEED_START;
  enter(k, 'slide');
}

function startParry(k: KnightState, input: InputFrame): void {
  k.facing = directionOr(input, k.facing);
  k.parryBuffer = 0;
  enter(k, 'parry');
}

/** Embrasement : la jauge se vide d'un coup, le chevalier s'embrase sur place. */
function startBlaze(k: KnightState): void {
  k.ash = 0;
  k.blazeBuffer = 0;
  k.attackBuffer = 0;
  k.comboQueued = false;
  k.hitMask = 0;
  k.stun = 0;
  enter(k, 'blaze');
}

function startDash(k: KnightState, input: InputFrame): void {
  k.facing = directionOr(input, k.facing);
  k.dodgeBuffer = 0;
  k.airDashUsed = true;
  k.vx = k.facing * T.DASH_SPEED;
  k.vy = 0;
  enter(k, 'dash');
}

/**
 * Actions disponibles depuis le sol, par priorité : Embrasement, parade, esquive, saut,
 * attaque. Sous un plafond bas, l'esquive devient une glissade et l'attaque un coup accroupi.
 */
function tryGroundActions(k: KnightState, input: InputFrame, solids: readonly Rect[]): boolean {
  const low = input.crouch || !canStand(k, solids);
  if (k.blazeBuffer > 0 && canBlaze(k)) {
    startBlaze(k);
    return true;
  }
  if (k.parryBuffer > 0 && canStand(k, solids)) {
    startParry(k, input);
    return true;
  }
  if (k.dodgeBuffer > 0) {
    if (low) startSlide(k, input);
    else startRoll(k, input);
    return true;
  }
  if (k.jumpBuffer > 0 && canStand(k, solids)) {
    startJump(k);
    return true;
  }
  if (k.attackBuffer > 0) {
    startAttack(k, low ? 'crouchAttack' : 'attack1', input);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Machine à états

function runAction(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  switch (k.action) {
    case 'idle':
    case 'run':
      return groundMove(k, input, solids);
    case 'turn':
      return turning(k, input, solids);
    case 'land':
      return landing(k, input, solids);
    case 'jump':
    case 'fall':
      return airborne(k, input);
    case 'crouchDown':
    case 'crouch':
    case 'crouchWalk':
      return crouching(k, input, solids);
    case 'standUp':
      return standingUp(k, input, solids);
    case 'attack1':
    case 'attack2':
    case 'crouchAttack':
    case 'airAttack':
    case 'blaze':
      return attacking(k, k.action, input, solids);
    case 'roll':
      return rolling(k, input, solids);
    case 'dash':
      return dashing(k);
    case 'slide':
      return sliding(k, input, solids);
    case 'parry':
      return parrying(k, input);
    case 'feint':
      return feinting(k, input, solids);
    case 'hurt':
      return hurting(k);
    case 'dead':
      return dying(k);
  }
}

function groundMove(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  if (tryGroundActions(k, input, solids)) return;
  if (input.crouch) {
    enter(k, 'crouchDown');
    return;
  }
  const dir = input.moveX;
  // Demi-tour en pleine course : dérapage avant de repartir dans l'autre sens.
  if (dir !== 0 && dir !== k.facing && k.action === 'run' && Math.abs(k.vx) >= T.TURN_MIN_SPEED) {
    enter(k, 'turn');
    return;
  }
  if (dir !== 0) k.facing = dir;
  const accel = dir !== 0 ? T.GROUND_ACCEL : T.GROUND_DECEL;
  k.vx = approach(k.vx, dir * T.RUN_SPEED, accel * DT);
  switchTo(k, dir !== 0 ? 'run' : 'idle');
}

function turning(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  // Une action lancée pendant le dérapage part déjà dans la nouvelle direction.
  const buffered = k.dodgeBuffer + k.jumpBuffer + k.attackBuffer + k.parryBuffer + k.blazeBuffer;
  if (buffered > 0) {
    const previous = k.facing;
    k.facing = directionOr(input, (previous === 1 ? -1 : 1) as Facing);
    if (tryGroundActions(k, input, solids)) return;
    k.facing = previous;
  }
  // Le dérapage est visuel : le chevalier repart déjà dans le sens voulu, sans rester planté.
  k.vx = approach(k.vx, input.moveX * T.RUN_SPEED, T.GROUND_DECEL * DT);
  if (k.actionTick >= TURN_TICKS) {
    k.facing = (k.facing === 1 ? -1 : 1) as Facing;
    switchTo(k, input.moveX !== 0 ? 'run' : 'idle');
  }
}

function landing(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  if (tryGroundActions(k, input, solids)) return;
  k.vx = approach(k.vx, 0, T.GROUND_DECEL * DT);
  if (k.actionTick >= LAND_TICKS) switchTo(k, input.moveX !== 0 ? 'run' : 'idle');
}

function airborne(k: KnightState, input: InputFrame): void {
  if (k.dodgeBuffer > 0 && !k.airDashUsed) {
    startDash(k, input);
    return;
  }
  if (k.jumpBuffer > 0 && k.coyote > 0) {
    startJump(k);
    return;
  }
  if (k.attackBuffer > 0) {
    startAttack(k, 'airAttack', input);
    return;
  }
  const dir = input.moveX;
  if (dir !== 0) k.facing = dir;
  const accel = dir !== 0 ? T.AIR_ACCEL : T.AIR_DECEL;
  k.vx = approach(k.vx, dir * T.RUN_SPEED, accel * DT);
  if (k.action === 'jump') {
    // Saut à hauteur variable : relâcher tôt écourte la montée.
    if (!input.jumpHeld && !k.jumpCut && k.vy < 0) {
      k.vy *= T.JUMP_CUT_MULTIPLIER;
      k.jumpCut = true;
    }
    if (k.vy >= T.APEX_SPEED) enter(k, 'fall');
  }
}

function crouching(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  if (k.blazeBuffer > 0 && canBlaze(k)) {
    startBlaze(k);
    return;
  }
  if (k.parryBuffer > 0 && canStand(k, solids)) {
    startParry(k, input);
    return;
  }
  if (k.dodgeBuffer > 0) {
    startSlide(k, input);
    return;
  }
  if (k.attackBuffer > 0) {
    startAttack(k, 'crouchAttack', input);
    return;
  }
  if (k.jumpBuffer > 0 && canStand(k, solids)) {
    startJump(k);
    return;
  }
  // Sous un plafond bas, le chevalier reste accroupi même si la touche est relâchée.
  if (!input.crouch && k.action !== 'crouchDown' && canStand(k, solids)) {
    enter(k, 'standUp');
    return;
  }
  const dir = input.moveX;
  if (dir !== 0) k.facing = dir;
  const accel = dir !== 0 ? T.GROUND_ACCEL : T.GROUND_DECEL;
  k.vx = approach(k.vx, dir * T.CROUCH_WALK_SPEED, accel * DT);
  if (k.action === 'crouchDown' && k.actionTick < CROUCH_DOWN_TICKS) return;
  switchTo(k, dir !== 0 ? 'crouchWalk' : 'crouch');
}

function standingUp(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  if (tryGroundActions(k, input, solids)) return;
  if (input.crouch) {
    switchTo(k, 'crouch');
    return;
  }
  if (input.moveX !== 0) {
    groundMove(k, input, solids);
    return;
  }
  k.vx = approach(k.vx, 0, T.GROUND_DECEL * DT);
  if (k.actionTick >= STAND_UP_TICKS) switchTo(k, 'idle');
}

function attacking(k: KnightState, id: AttackId, input: InputFrame, solids: readonly Rect[]): void {
  const def = ATTACKS[id];
  const t = k.actionTick;
  const startupTicks = def.frameTicks[0] ?? 0;
  // Feinte : tant que le coup n'a pas touché et avant la fin de l'engagement
  // (durant l'armé, la charge, ou avant la récupération), un appui sur parade
  // annule l'attaque et bascule en feinte (court temps d'arrêt).
  const feintWindow = def.feintMaxTick ?? def.cancelTick;
  if (def.feintable && (t < feintWindow || k.charge > 0) && k.hitMask === 0) {
    if (input.parryPressed || k.parryBuffer > 0) {
      k.charge = 0;
      clearBuffers(k);
      enter(k, 'feint');
      return;
    }
  }
  // Coup chargé : au dernier tick d'armé, tant que la touche reste maintenue,
  // le chevalier retient son coup jusqu'à maxChargeTicks.
  const armTick = startupTicks - 1;
  if (def.chargeable && t === armTick && k.hitMask === 0) {
    if (input.attackHeld && k.charge < def.chargeable.maxChargeTicks) {
      k.charge++;
      k.actionTick = armTick - 1;
      k.vx = approach(k.vx, 0, T.ATTACK_DECEL * DT);
      return;
    }
  }
  // Seul un coup qui a touché s'annule : rater engage jusqu'à la fin de l'animation.
  const connected = k.hitMask !== 0;
  if (connected && def.endOnHitTick !== undefined && t >= def.endOnHitTick) {
    endAttack(k, id, input, solids);
    return;
  }
  if (connected && t >= def.cancelTick) {
    if (def.combo && (k.comboQueued || k.attackBuffer > 0)) {
      startAttack(k, def.combo.next, input);
      return;
    }
    if (id !== 'airAttack' && k.grounded && (k.dodgeBuffer > 0 || k.jumpBuffer > 0)) {
      if (tryGroundActions(k, input, solids)) return;
    }
  }
  if (t >= totalTicks(def.frameTicks)) {
    endAttack(k, id, input, solids);
    return;
  }
  if (id === 'airAttack') {
    if (k.grounded) {
      k.vx = approach(k.vx, 0, T.GROUND_DECEL * DT);
    } else {
      const dir = input.moveX;
      const accel = (dir !== 0 ? T.AIR_ACCEL : T.AIR_DECEL) * T.AIR_ATTACK_CONTROL;
      k.vx = approach(k.vx, dir * T.RUN_SPEED, accel * DT);
    }
  } else if (def.lunge && t >= def.lunge.fromTick && t < def.lunge.toTick) {
    k.vx = k.facing * def.lunge.speed;
  } else {
    k.vx = approach(k.vx, 0, T.ATTACK_DECEL * DT);
  }
}

function endAttack(k: KnightState, id: AttackId, input: InputFrame, solids: readonly Rect[]): void {
  k.comboQueued = false;
  k.hitMask = 0;
  k.charge = 0;
  if (!k.grounded) {
    enter(k, 'fall');
  } else if (id === 'crouchAttack' || !canStand(k, solids)) {
    enter(k, 'crouch');
  } else {
    switchTo(k, input.moveX !== 0 ? 'run' : 'idle');
  }
}

function rolling(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  const t = k.actionTick;
  if (t >= T.ROLL_CANCEL_TICK && tryGroundActions(k, input, solids)) return;
  if (t >= ROLL_TICKS) {
    switchTo(k, input.moveX !== 0 ? 'run' : 'idle');
    return;
  }
  const slowdown =
    t < T.ROLL_FAST_TICKS ? 1 : 1 - (t - T.ROLL_FAST_TICKS) / (ROLL_TICKS - T.ROLL_FAST_TICKS);
  k.vx = k.facing * T.ROLL_SPEED * slowdown;
}

function dashing(k: KnightState): void {
  if (k.actionTick >= DASH_TICKS) {
    k.vx = k.facing * T.RUN_SPEED;
    enter(k, k.grounded ? 'idle' : 'fall');
    return;
  }
  k.vx = k.facing * T.DASH_SPEED;
  k.vy = 0;
}

function sliding(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  const t = k.actionTick;
  if (t >= SLIDE_TICKS) {
    if (input.crouch || !canStand(k, solids)) enter(k, 'crouch');
    else switchTo(k, input.moveX !== 0 ? 'run' : 'idle');
    return;
  }
  if (k.jumpBuffer > 0 && t >= T.SLIDE_JUMP_FROM_TICK && canStand(k, solids)) {
    startJump(k);
    return;
  }
  const progress = t / SLIDE_TICKS;
  k.vx = k.facing * (T.SLIDE_SPEED_START + (T.SLIDE_SPEED_END - T.SLIDE_SPEED_START) * progress);
}

/** Parade : planté sur place, lame devant ; aucune annulation, même dans la récupération. */
function parrying(k: KnightState, input: InputFrame): void {
  k.vx = approach(k.vx, 0, T.GROUND_DECEL * DT);
  if (k.actionTick >= PARRY_TICKS) switchTo(k, input.moveX !== 0 ? 'run' : 'idle');
}

/** Feinte : temps d'arrêt bref après avoir avorté un armé. */
function feinting(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  k.vx = approach(k.vx, 0, T.GROUND_DECEL * DT);
  if (k.actionTick >= FEINT_TICKS) {
    if (tryGroundActions(k, input, solids)) return;
    switchTo(k, input.moveX !== 0 ? 'run' : 'idle');
  }
}

/** Recul après un coup. Un Embrasement, jauge pleine, permet d'en sortir aussitôt. */
function hurting(k: KnightState): void {
  if (k.blazeBuffer > 0 && canBlaze(k)) {
    startBlaze(k);
    return;
  }
  k.vx = approach(k.vx, 0, T.GROUND_DECEL * 0.5 * DT);
  if (k.actionTick >= (k.stun || HURT_TICKS)) enter(k, k.grounded ? 'idle' : 'fall');
}

function dying(k: KnightState): void {
  k.vx = approach(k.vx, 0, T.GROUND_DECEL * DT);
  if (k.actionTick >= DEATH_TOTAL_TICKS) {
    k.hp = k.maxHp;
    enter(k, 'idle');
  }
}

// ---------------------------------------------------------------------------------------------
// Physique

function integrate(k: KnightState, input: InputFrame, solids: readonly Rect[]): void {
  if (k.action !== 'dash') {
    const gravity = k.vy > 0 ? T.GRAVITY * T.FALL_GRAVITY_MULTIPLIER : T.GRAVITY;
    k.vy = Math.min(k.vy + gravity * DT, T.MAX_FALL_SPEED);
  }
  const height = knightHeight(k.action);
  const result = moveAndCollide(k.x, k.y, T.KNIGHT_WIDTH, height, k.vx * DT, k.vy * DT, solids);
  k.x = result.x;
  k.y = result.y;
  if (result.hitX !== 0) k.vx = 0;
  if (result.hitY !== 0) k.vy = 0;

  const wasGrounded = k.grounded;
  // Sans mouvement vertical (dash), la sonde sous les pieds confirme le contact au sol.
  k.grounded = result.hitY === 1 || (k.vy >= 0 && touchesGround(k.x, k.y, T.KNIGHT_WIDTH, solids));
  if (k.grounded) {
    k.airDashUsed = false;
    k.coyote = T.COYOTE_TICKS;
    if (!wasGrounded) onLanding(k, input, k.y - k.airPeakY);
    k.airPeakY = k.y;
  } else {
    k.airPeakY = Math.min(k.airPeakY, k.y);
    if (wasGrounded) onLeftGround(k);
  }
}

/** Atterrissage : seule une grande chute marque un temps d'arrêt, pas un saut ordinaire. */
function onLanding(k: KnightState, input: InputFrame, fallHeight: number): void {
  if (k.action !== 'jump' && k.action !== 'fall') return;
  if (fallHeight >= T.HARD_LANDING_HEIGHT) enter(k, 'land');
  else if (input.crouch) enter(k, 'crouch');
  else enter(k, input.moveX !== 0 ? 'run' : 'idle');
}

function onLeftGround(k: KnightState): void {
  switch (k.action) {
    case 'idle':
    case 'run':
    case 'turn':
    case 'land':
    case 'crouchDown':
    case 'crouch':
    case 'crouchWalk':
    case 'standUp':
    case 'roll':
    case 'slide':
    case 'parry':
    case 'feint':
      enter(k, 'fall');
      return;
    default:
      // Les attaques, le dash et les réactions continuent en l'air.
      return;
  }
}

function tickTimers(k: KnightState): void {
  if (!k.grounded && k.coyote > 0) k.coyote--;
  if (k.jumpBuffer > 0) k.jumpBuffer--;
  if (k.attackBuffer > 0) k.attackBuffer--;
  if (k.dodgeBuffer > 0) k.dodgeBuffer--;
  if (k.parryBuffer > 0) k.parryBuffer--;
  if (k.blazeBuffer > 0) k.blazeBuffer--;
}
