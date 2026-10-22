import { GAME_WIDTH } from '../config.ts';
import type { DisplayedKnight } from '../session/Session.ts';
import { requireElement } from './dom.ts';

/** Hauteur du nom au-dessus des pieds, en pixels du jeu : juste au-dessus du casque. */
const NAME_HEIGHT = 46;

/**
 * Noms suspendus au-dessus des têtes, en HTML pour rester nets à tout zoom. Ils restent
 * lisibles dans le noir, comme les noms des joueurs dans un MMO.
 */
export class Nameplates {
  private readonly layer = requireElement('nameplates');
  private readonly plates = new Map<string, HTMLElement>();

  update(
    knights: readonly DisplayedKnight[],
    scrollX: number,
    scrollY: number,
    canvas: HTMLCanvasElement,
  ): void {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / GAME_WIDTH;
    const seen = new Set<string>();
    for (const knight of knights) {
      seen.add(knight.id);
      let plate = this.plates.get(knight.id);
      if (!plate) {
        plate = document.createElement('div');
        plate.className = 'nameplate';
        plate.dataset['id'] = knight.id;
        this.layer.append(plate);
        this.plates.set(knight.id, plate);
      }
      if (plate.textContent !== knight.name) plate.textContent = knight.name;
      plate.classList.toggle('local', knight.local);
      const x = rect.left + (knight.state.x - scrollX) * scale;
      const y = rect.top + (knight.state.y - NAME_HEIGHT - scrollY) * scale;
      plate.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const [id, plate] of this.plates) {
      if (seen.has(id)) continue;
      plate.remove();
      this.plates.delete(id);
    }
  }

  clear(): void {
    for (const plate of this.plates.values()) plate.remove();
    this.plates.clear();
  }
}
