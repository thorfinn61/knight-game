import { DUEL_PLAYERS } from '@cendres/shared';
import type { SessionStatus } from '../session/Session.ts';
import { requireElement } from './dom.ts';

/** Bandeau du coin supérieur droit : code du salon, nombre de joueurs, latence. */
export class Hud {
  private readonly element = requireElement('hud');
  private text = '';

  show(): void {
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
    this.text = '';
  }

  update(status: SessionStatus): void {
    const parts =
      status.mode === 'training'
        ? ['Entraînement']
        : [
            `Duel ${status.code ?? '…'}`,
            `${status.players} / ${DUEL_PLAYERS}`,
            status.pingMs === null ? '' : `${Math.round(status.pingMs)} ms`,
          ];
    const text = [...parts.filter(Boolean), 'Échap : menu'].join('  ·  ');
    if (text !== this.text) {
      this.element.textContent = text;
      this.text = text;
    }
  }
}
