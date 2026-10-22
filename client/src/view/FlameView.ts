import type * as Phaser from 'phaser';
import type { Point } from '@cendres/shared';
import { DEPTH, TEXTURES, TORCH_FLAME_FRAMES } from '../config.ts';

/** Images de flamme par seconde. */
const FLAME_FPS = 9;

export interface FlameOptions {
  /** Agrandissement de la flamme (pixels doublés pour un brasero). */
  scale: number;
  /** Ajoute le support en fer d'une torche murale. */
  bracket: boolean;
}

/** Flamme animée d'une torche ou d'un brasero. Sa lumière est gérée par l'ambiance. */
export class FlameView {
  private readonly flame: Phaser.GameObjects.Image;
  /** Décalage propre à chaque flamme, pour qu'elles ne vacillent pas toutes ensemble. */
  private readonly phase: number;

  constructor(scene: Phaser.Scene, position: Point, index: number, options: FlameOptions) {
    this.phase = index * 0.37 + 0.11;
    if (options.bracket) {
      scene.add
        .image(position.x, position.y + 4, TEXTURES.torchBracket)
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.torch);
    }
    this.flame = scene.add
      .image(position.x, position.y + (options.bracket ? 5 : 0), TEXTURES.torchFlame, 0)
      .setOrigin(0.5, 1)
      .setScale(options.scale)
      .setDepth(DEPTH.torch);
  }

  update(timeMs: number): void {
    const frame =
      Math.floor((timeMs / 1000) * FLAME_FPS + this.phase * TORCH_FLAME_FRAMES) %
      TORCH_FLAME_FRAMES;
    this.flame.setFrame(frame);
  }
}
