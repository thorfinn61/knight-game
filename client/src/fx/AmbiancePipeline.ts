import * as Phaser from 'phaser';
import fragShader from './ambiance.frag?raw';
import type { LightSource } from './lights.ts';

/** Nombre maximal de lumières visibles à la fois, à garder égal à MAX_LIGHTS du shader. */
export const MAX_LIGHTS = 16;
/** Lumière ambiante : presque noire, légèrement froide. Couleurs en RVB de 0 à 1. */
export const AMBIENT_COLOR: readonly [number, number, number] = [0.035, 0.04, 0.055];
/** Part de couleur conservée : 0 donne du noir et blanc, 1 les couleurs d'origine. */
export const SATURATION = 0.55;
export const VIGNETTE_STRENGTH = 0.6;
export const LIGHT_BANDS = 6;
/** Plafond de la lumière cumulée quand plusieurs halos se superposent. */
export const MAX_LIGHT = 1.35;

/**
 * Post-traitement de la caméra principale : obscurité, halos des lumières (chevaliers et
 * torches), palette désaturée et vignettage. La scène fournit les lumières à chaque image.
 */
export class AmbiancePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly KEY = 'AmbiancePipeline';

  private readonly lightData = new Float32Array(MAX_LIGHTS * 4);
  private readonly colorData = new Float32Array(MAX_LIGHTS * 3);
  private lightCount = 0;

  constructor(game: Phaser.Game) {
    super({ game, name: AmbiancePipeline.KEY, fragShader });
  }

  /** Lumières du monde à afficher, vues depuis une caméra qui défile de (scrollX, scrollY). */
  setLights(lights: readonly LightSource[], scrollX: number, scrollY: number): void {
    const { width, height } = this.renderer;
    let count = 0;
    for (const light of lights) {
      if (count >= MAX_LIGHTS) break;
      const x = light.x - scrollX;
      const y = light.y - scrollY;
      const r = light.radius;
      if (x + r < 0 || x - r > width || y + r < 0 || y - r > height) continue;
      this.lightData.set([x, height - y, r, light.intensity], count * 4);
      this.colorData.set(light.color, count * 3);
      count++;
    }
    this.lightCount = count;
  }

  override onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    const { width, height } = this.renderer;
    this.set2f('uResolution', width, height);
    this.set4fv('uLights', this.lightData);
    this.set3fv('uLightColors', this.colorData);
    this.set1f('uLightCount', this.lightCount);
    this.set3f('uAmbient', AMBIENT_COLOR[0], AMBIENT_COLOR[1], AMBIENT_COLOR[2]);
    this.set1f('uMaxLight', MAX_LIGHT);
    this.set1f('uSaturation', SATURATION);
    this.set1f('uVignette', VIGNETTE_STRENGTH);
    this.set1f('uBands', LIGHT_BANDS);
    this.bindAndDraw(renderTarget);
  }
}
