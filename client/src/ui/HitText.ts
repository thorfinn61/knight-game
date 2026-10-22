import { GAME_WIDTH } from '../config.ts';
import { requireElement } from './dom.ts';

/** Durée de vie d'un texte d'impact, à garder égale à l'animation CSS `.hit-text`. */
const LIFETIME_MS = 900;

/** Teinte du texte : braise pour un contre, acier froid pour une parade, pâle pour un choc. */
export type HitTextTone = 'ember' | 'steel' | 'ash';

/** Textes brefs qui jaillissent du point d'impact (« Contre ! »), en HTML pour rester nets. */
export class HitText {
  private readonly layer = requireElement('nameplates');

  spawn(
    text: string,
    tone: HitTextTone,
    worldX: number,
    worldY: number,
    scrollX: number,
    scrollY: number,
    canvas: HTMLCanvasElement,
  ): void {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / GAME_WIDTH;
    const element = document.createElement('div');
    element.className = `hit-text ${tone}`;
    element.textContent = text;
    element.style.left = `${(rect.left + (worldX - scrollX) * scale).toFixed(1)}px`;
    element.style.top = `${(rect.top + (worldY - scrollY) * scale).toFixed(1)}px`;
    this.layer.append(element);
    window.setTimeout(() => element.remove(), LIFETIME_MS);
  }

  clear(): void {
    for (const element of this.layer.querySelectorAll('.hit-text')) element.remove();
  }
}
