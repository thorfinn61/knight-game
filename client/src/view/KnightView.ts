import type * as Phaser from 'phaser';
import {
  ASH_MAX,
  ATTACKS,
  DEATH_FALL_FRAME_TICKS,
  DEATH_FALL_TICKS,
  DEATH_FRAMES,
  DEATH_LIE_TICKS,
  DEATH_RISE_FRAME_TICKS,
  ROLL_FRAME_TICKS,
  SLIDE_END_TICKS,
  SLIDE_START_TICKS,
  SLIDE_TICKS,
  TICK_MS,
  TURN_FRAME_TICKS,
  frameAt,
  isParrying,
  type KnightState,
} from '@cendres/shared';
import { DEPTH } from '../config.ts';
import { Embers } from '../fx/Embers.ts';
import {
  KNIGHT_ANCHOR_X,
  KNIGHT_FRAME_WIDTH,
  KNIGHT_SHEETS,
  knightTextureKey,
  skinLook,
  type KnightSheet,
} from '../knight/sheets.ts';

/** Durée d'affichage des frames de montée et de sommet du saut, en ticks. */
const JUMP_FRAME_TICKS = 4;
const APEX_FRAME_TICKS = 4;
const APEX_TICKS = KNIGHT_SHEETS.JumpFallInbetween.frames * APEX_FRAME_TICKS;
/**
 * Le pack n'a pas d'animation de parade : la garde reprend la dernière frame de l'attaque 1,
 * lame tendue vers l'avant. Un reflet froid la distingue d'une fin d'attaque.
 */
const PARRY_POSE_FRAME = 3;
/** Ticks d'éclair au début de la parade, puis teinte d'acier jusqu'à la fin de la fenêtre. */
const PARRY_GLINT_TICKS = 3;
const PARRY_GLINT_COLOR = 0xe8f0ff;
const PARRY_TINT = 0xb4c8f0;
/**
 * Embrasement, sans animation dédiée dans le pack : armé accroupi (la transition), onde sur
 * le grand arc de l'attaque 2, puis le chevalier reste accroupi, essoufflé, s'il a raté.
 */
const BLAZE_WAVE_FRAME = 2;
const BLAZE_FOLLOW_TICKS = 6;
/** Armé : le chevalier rougeoie par saccades ; onde : chauffé à blanc ; raté : cendré. */
const BLAZE_GLOW = 0xff9a40;
const BLAZE_WARM = 0xffc890;
const BLAZE_WHITE_HOT = 0xfff0c0;
const BLAZE_ASHEN = 0x8a7a70;
/** Jauge pleine : une braise monte du chevalier à cet intervalle, en millisecondes. */
const EMBER_INTERVAL_MS = 110;
const EMBER_HEIGHT = { min: 6, max: 32 };

export interface KnightFrame {
  sheet: KnightSheet;
  frame: number;
}

/**
 * Planche et frame à afficher, déduites uniquement de l'état de la simulation.
 * Aucune horloge d'animation propre : le gel de coup et les joueurs distants s'affichent juste.
 */
export function pickKnightFrame(k: KnightState): KnightFrame {
  const t = k.actionTick;
  switch (k.action) {
    case 'idle':
      return loop('Idle', t);
    case 'run':
      return loop('Run', t);
    case 'turn':
      return { sheet: 'TurnAround', frame: frameAt(TURN_FRAME_TICKS, t) };
    case 'jump':
      return {
        sheet: 'Jump',
        frame: Math.min(KNIGHT_SHEETS.Jump.frames - 1, Math.floor(t / JUMP_FRAME_TICKS)),
      };
    case 'fall':
      return t < APEX_TICKS
        ? { sheet: 'JumpFallInbetween', frame: Math.floor(t / APEX_FRAME_TICKS) }
        : loop('Fall', t - APEX_TICKS);
    case 'land':
    case 'crouchDown':
    case 'standUp':
      return { sheet: 'CrouchTransition', frame: 0 };
    case 'crouch':
      return { sheet: 'Crouch', frame: 0 };
    case 'crouchWalk':
      return loop('CrouchWalk', t);
    case 'attack1':
      return { sheet: 'Attack', frame: frameAt(ATTACKS.attack1.frameTicks, t) };
    case 'airAttack':
      return { sheet: 'Attack', frame: frameAt(ATTACKS.airAttack.frameTicks, t) };
    case 'attack2':
      return { sheet: 'Attack2', frame: frameAt(ATTACKS.attack2.frameTicks, t) };
    case 'crouchAttack':
      return { sheet: 'CrouchAttack', frame: frameAt(ATTACKS.crouchAttack.frameTicks, t) };
    case 'parry':
      return { sheet: 'Attack', frame: PARRY_POSE_FRAME };
    case 'blaze':
      return blazeFrame(t);
    case 'roll':
      return { sheet: 'Roll', frame: frameAt(ROLL_FRAME_TICKS, t) };
    case 'dash':
      return loop('Dash', t);
    case 'slide':
      if (t < SLIDE_START_TICKS) return { sheet: 'SlideStart', frame: 0 };
      if (t >= SLIDE_TICKS - SLIDE_END_TICKS) return { sheet: 'SlideEnd', frame: 0 };
      return loop('Slide', t - SLIDE_START_TICKS);
    case 'hurt':
      return { sheet: 'Hit', frame: 0 };
    case 'dead':
      return deathFrame(t);
  }
}

function blazeFrame(t: number): KnightFrame {
  const [startup = 0, wave = 0] = ATTACKS.blaze.frameTicks;
  if (t < startup) return { sheet: 'CrouchTransition', frame: 0 };
  if (t < startup + wave) return { sheet: 'Attack2', frame: BLAZE_WAVE_FRAME };
  if (t < startup + wave + BLAZE_FOLLOW_TICKS)
    return { sheet: 'Attack2', frame: BLAZE_WAVE_FRAME + 1 };
  return { sheet: 'CrouchTransition', frame: 0 };
}

/** Animation en boucle, au rythme d'origine du pack. */
function loop(sheet: KnightSheet, ticks: number): KnightFrame {
  const def = KNIGHT_SHEETS[sheet];
  return { sheet, frame: Math.floor((ticks * TICK_MS) / def.frameMs) % def.frames };
}

/** Chute, temps au sol, puis l'animation de mort jouée à l'envers : le chevalier se relève. */
function deathFrame(t: number): KnightFrame {
  const last = DEATH_FRAMES - 1;
  if (t < DEATH_FALL_TICKS)
    return { sheet: 'Death', frame: Math.floor(t / DEATH_FALL_FRAME_TICKS) };
  const rising = t - DEATH_FALL_TICKS - DEATH_LIE_TICKS;
  if (rising < 0) return { sheet: 'Death', frame: last };
  return { sheet: 'Death', frame: Math.max(0, last - Math.floor(rising / DEATH_RISE_FRAME_TICKS)) };
}

const FLASH_MS = 70;
const FLASH_HEAVY_MS = 110;

export class KnightView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly look;
  private readonly embers: Embers;
  private flashMs = 0;
  private emberMs = 0;

  constructor(scene: Phaser.Scene, skin: number) {
    this.look = skinLook(skin);
    this.embers = new Embers(scene);
    this.sprite = scene.add
      .sprite(0, 0, knightTextureKey(this.look.variant, 'Idle'), 0)
      .setDepth(DEPTH.knight);
    if (this.look.tint !== null) this.sprite.setTint(this.look.tint);
  }

  /** Éclair blanc quand le chevalier encaisse un coup. */
  flash(heavy: boolean): void {
    this.flashMs = heavy ? FLASH_HEAVY_MS : FLASH_MS;
  }

  /** Affiche l'état `k` ; ses coordonnées sont déjà lissées ou interpolées par la session. */
  render(k: KnightState, deltaMs = 0): void {
    if (this.flashMs > 0) {
      this.flashMs -= deltaMs;
      this.sprite.setTintFill(0xffffff);
    } else if (isParrying(k)) {
      if (k.actionTick < PARRY_GLINT_TICKS) this.sprite.setTintFill(PARRY_GLINT_COLOR);
      else this.sprite.setTint(PARRY_TINT);
    } else if (k.action === 'blaze') {
      this.paintBlaze(k.actionTick);
    } else if (this.look.tint !== null) {
      this.sprite.setTint(this.look.tint);
    } else {
      this.sprite.clearTint();
    }

    const { sheet, frame } = pickKnightFrame(k);
    const key = knightTextureKey(this.look.variant, sheet);
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key, frame);
    else this.sprite.setFrame(frame);

    // Le retournement de Phaser se fait autour du centre de l'image ; le corps étant décalé,
    // on déplace l'origine pour que le miroir se fasse autour du corps.
    const left = k.facing < 0;
    const anchor = left ? KNIGHT_FRAME_WIDTH - KNIGHT_ANCHOR_X : KNIGHT_ANCHOR_X;
    this.sprite.setFlipX(left);
    this.sprite.setOrigin(anchor / KNIGHT_FRAME_WIDTH, 1);
    this.sprite.setPosition(Math.round(k.x), Math.round(k.y));
    this.emitEmbers(k, deltaMs);
  }

  private paintBlaze(t: number): void {
    const [startup = 0, wave = 0] = ATTACKS.blaze.frameTicks;
    if (t < startup) {
      if (Math.floor(t / 2) % 2 === 0) this.sprite.setTintFill(BLAZE_GLOW);
      else this.sprite.setTint(BLAZE_WARM);
    } else if (t < startup + wave) {
      this.sprite.setTintFill(BLAZE_WHITE_HOT);
    } else {
      this.sprite.setTint(BLAZE_ASHEN);
    }
  }

  /** Jauge pleine : des braises montent du chevalier, l'adversaire sait ce qui l'attend. */
  private emitEmbers(k: KnightState, deltaMs: number): void {
    if (k.ash < ASH_MAX || k.action === 'dead') {
      this.emberMs = 0;
      return;
    }
    this.emberMs += deltaMs;
    for (; this.emberMs >= EMBER_INTERVAL_MS; this.emberMs -= EMBER_INTERVAL_MS) {
      const x = k.x + (Math.random() - 0.5) * 14;
      const y = k.y - EMBER_HEIGHT.min - Math.random() * (EMBER_HEIGHT.max - EMBER_HEIGHT.min);
      this.embers.rise(x, y);
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
