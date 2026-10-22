import * as Phaser from 'phaser';
import { DEPTH, TEXTURES } from '../config.ts';

const RISE = { height: { min: 12, max: 26 }, drift: 5, ms: { min: 550, max: 900 } };
const BURST_MS = { min: 320, max: 520 };

/** Braises dessinées en code : celles qui montent d'un chevalier, celles qu'une onde projette. */
export class Embers {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Une braise qui monte en vacillant, puis s'éteint. */
  rise(x: number, y: number): void {
    const ember = this.spawn(x, y);
    this.scene.tweens.add({
      targets: ember,
      y: y - Phaser.Math.Between(RISE.height.min, RISE.height.max),
      x: x + Phaser.Math.FloatBetween(-RISE.drift, RISE.drift),
      alpha: { from: 1, to: 0 },
      duration: Phaser.Math.Between(RISE.ms.min, RISE.ms.max),
      ease: 'Sine.easeOut',
      onComplete: () => ember.destroy(),
    });
  }

  /** `count` braises projetées tout autour de (x, y), à `distance` pixels au plus. */
  burst(x: number, y: number, count: number, distance: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const reach = distance * Phaser.Math.FloatBetween(0.5, 1);
      const ember = this.spawn(x, y);
      this.scene.tweens.add({
        targets: ember,
        x: x + Math.cos(angle) * reach,
        // L'onde s'étale au ras du sol : les braises montent moins qu'elles ne s'écartent.
        y: y + Math.sin(angle) * reach * 0.5 - Phaser.Math.Between(0, 10),
        alpha: { from: 1, to: 0 },
        duration: Phaser.Math.Between(BURST_MS.min, BURST_MS.max),
        ease: 'Cubic.easeOut',
        onComplete: () => ember.destroy(),
      });
    }
  }

  private spawn(x: number, y: number): Phaser.GameObjects.Image {
    return this.scene.add
      .image(Math.round(x), Math.round(y), TEXTURES.ember)
      .setDepth(DEPTH.fx)
      .setBlendMode(Phaser.BlendModes.ADD);
  }
}
