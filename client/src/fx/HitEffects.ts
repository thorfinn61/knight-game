import * as Phaser from 'phaser';
import type { ClashEvent, HitEvent, ParryEvent, WorldEvent } from '@cendres/shared';
import { DEPTH, TEXTURES } from '../config.ts';
import { Embers } from './Embers.ts';

/** Tremblement d'écran : durée en ms, intensité en fraction de la taille de la caméra. */
const SHAKE = {
  light: { ms: 90, intensity: 0.0035 },
  heavy: { ms: 150, intensity: 0.0065 },
  parry: { ms: 130, intensity: 0.005 },
  clash: { ms: 110, intensity: 0.0045 },
  blazeStart: { ms: 200, intensity: 0.002 },
  blazeWave: { ms: 260, intensity: 0.009 },
};
const SPARK_MS = { light: 110, heavy: 160 };
/** Parade : l'anneau s'élargit, des éclats froids partent vers l'attaquant. */
const PARRY_RING_MS = 280;
const PARRY_RING_SCALE = 2.8;
const PARRY_TINT = 0xd8e4ff;
const PARRY_SHARDS = 6;
/** Choc des lames : éclats projetés des deux côtés. */
const CLASH_SHARDS = 8;
const SHARD_MS = 240;
const SHARD_DISTANCE = { min: 10, max: 24 };
/** Embrasement : braises aspirées pendant l'armé, puis deux anneaux de flammes au ras du sol. */
const BLAZE_GATHER_EMBERS = 12;
const BLAZE_RING_MS = 320;
const BLAZE_RING_SCALE = 1.6;
/** L'onde s'étale au sol : l'anneau est aplati. */
const BLAZE_RING_FLATTEN = 0.5;
const BLAZE_SECOND_RING_DELAY_MS = 70;
const BLAZE_BURST_EMBERS = 22;
const BLAZE_BURST_DISTANCE = 56;
const BLAZE_FLASH = { ms: 110, r: 255, g: 150, b: 60 };

/** Retour visuel des coups, parades et chocs, et de l'Embrasement : secousses, éclats, anneaux. */
export class HitEffects {
  private readonly scene: Phaser.Scene;
  private readonly embers: Embers;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.embers = new Embers(scene);
  }

  /** Début de l'Embrasement, (x, y) au centre du corps : les braises montent autour de lui. */
  blazeStart(x: number, y: number): void {
    this.shake('blazeStart');
    for (let i = 0; i < BLAZE_GATHER_EMBERS; i++) {
      this.embers.rise(x + Phaser.Math.FloatBetween(-16, 16), y + Phaser.Math.FloatBetween(0, 18));
    }
  }

  /** L'onde de l'Embrasement part du chevalier, (x, y) au centre du corps. */
  blazeWave(x: number, y: number): void {
    this.shake('blazeWave');
    const { ms, r, g, b } = BLAZE_FLASH;
    this.scene.cameras.main.flash(ms, r, g, b);
    this.ring(x, y, 0);
    this.ring(x, y, BLAZE_SECOND_RING_DELAY_MS);
    this.embers.burst(x, y, BLAZE_BURST_EMBERS, BLAZE_BURST_DISTANCE);
  }

  play(event: WorldEvent): void {
    switch (event.type) {
      case 'hit':
        return this.hit(event);
      case 'parry':
        return this.parry(event);
      case 'clash':
        return this.clash(event);
    }
  }

  private hit(hit: HitEvent): void {
    // Un contre secoue comme un coup lourd.
    const weight = hit.heavy || hit.counter ? 'heavy' : 'light';
    this.shake(weight);
    this.spark(hit.x, hit.y, hit.heavy ? 1.6 : 1.1, SPARK_MS[weight]);
  }

  private parry(parry: ParryEvent): void {
    this.shake('parry');
    this.spark(parry.x, parry.y, 1.4, SPARK_MS.heavy, PARRY_TINT);
    const ring = this.scene.add
      .image(Math.round(parry.x), Math.round(parry.y), TEXTURES.parryRing)
      .setDepth(DEPTH.fx)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.6, to: PARRY_RING_SCALE },
      alpha: { from: 1, to: 0 },
      duration: PARRY_RING_MS,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    // Les éclats partent vers l'attaquant, en éventail.
    const toward = parry.direction === 1 ? 0 : Math.PI;
    for (let i = 0; i < PARRY_SHARDS; i++) {
      const spread = ((i / (PARRY_SHARDS - 1)) * 2 - 1) * 0.9;
      this.shard(parry.x, parry.y, toward + spread, PARRY_TINT);
    }
  }

  private clash(clash: ClashEvent): void {
    this.shake('clash');
    this.spark(clash.x, clash.y, 1.5, SPARK_MS.heavy);
    for (let i = 0; i < CLASH_SHARDS; i++) {
      const side = i % 2 === 0 ? 0 : Math.PI;
      this.shard(clash.x, clash.y, side + Phaser.Math.FloatBetween(-1.1, 1.1));
    }
  }

  private ring(x: number, y: number, delay: number): void {
    const ring = this.scene.add
      .image(Math.round(x), Math.round(y), TEXTURES.blazeRing)
      .setDepth(DEPTH.fx)
      .setScale(0.2, 0.2 * BLAZE_RING_FLATTEN)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ring,
      delay,
      scaleX: BLAZE_RING_SCALE,
      scaleY: BLAZE_RING_SCALE * BLAZE_RING_FLATTEN,
      alpha: { from: 1, to: 0 },
      duration: BLAZE_RING_MS,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private shake(kind: keyof typeof SHAKE): void {
    this.scene.cameras.main.shake(SHAKE[kind].ms, SHAKE[kind].intensity);
  }

  private spark(x: number, y: number, scale: number, ms: number, tint?: number): void {
    const spark = this.scene.add
      .image(Math.round(x), Math.round(y), TEXTURES.spark)
      .setDepth(DEPTH.fx)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (tint !== undefined) spark.setTint(tint);
    this.scene.tweens.add({
      targets: spark,
      scale: { from: scale, to: 0.3 },
      alpha: { from: 1, to: 0 },
      duration: ms,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  /** Petit éclat projeté dans la direction `angle` (radians, 0 vers la droite). */
  private shard(x: number, y: number, angle: number, tint?: number): void {
    const distance = Phaser.Math.Between(SHARD_DISTANCE.min, SHARD_DISTANCE.max);
    const shard = this.scene.add
      .image(Math.round(x), Math.round(y), TEXTURES.spark)
      .setDepth(DEPTH.fx)
      .setScale(0.35)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (tint !== undefined) shard.setTint(tint);
    this.scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      alpha: { from: 1, to: 0 },
      scale: { from: 0.45, to: 0.15 },
      duration: SHARD_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => shard.destroy(),
    });
  }
}
