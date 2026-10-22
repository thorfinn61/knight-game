import { ASH_MAX, isInvulnerable } from '@cendres/shared';
import type { Session } from '../session/Session.ts';

const REFRESH_MS = 100;

const CONTROLS = [
  'Q / D            se déplacer',
  'Z ou Espace      sauter (maintenir = plus haut)',
  'S                s’accroupir',
  'J ou clic gauche attaquer, rappuyer pour le combo',
  'L ou clic droit  parer : renvoie un coup reçu au bon moment',
  'E ou I           Embrasement, jauge des Cendres pleine',
  'Maj ou K         esquive : roulade au sol, dash en l’air',
  'S + esquive      glissade',
  'Échap            retour au menu',
];

/** Panneau texte du mode debug, en HTML pour rester net quel que soit le zoom. */
export class DebugPanel {
  private readonly element: HTMLElement;
  private visible = false;
  private lastRefresh = -Infinity;

  constructor() {
    const element = document.getElementById('debug');
    if (!element) throw new Error('élément #debug introuvable');
    this.element = element;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  toggle(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.element.style.display = visible ? 'block' : 'none';
    this.lastRefresh = -Infinity;
  }

  update(timeMs: number, session: Session, fps: number): void {
    if (!this.visible || timeMs - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = timeMs;
    const k = session.localKnight();
    const d = session.dummies()[0];
    const status = session.status();
    const yesNo = (value: boolean) => (value ? 'oui' : 'non');
    const lines = ['L’Ordre des Cendres · debug (F1)', ''];
    if (status.mode === 'duel') {
      const ping = status.pingMs === null ? '…' : `${Math.round(status.pingMs)} ms`;
      const drift = status.driftPx === null ? '…' : `${status.driftPx.toFixed(2)} px`;
      lines.push(
        `duel        ${status.code} · ${status.players} joueur(s) · ping ${ping} · dérive ${drift}`,
      );
      if (status.duel) {
        const { phase, round, remainingMs } = status.duel;
        lines.push(`phase       ${phase} · manche ${round} · ${(remainingMs / 1000).toFixed(1)} s`);
      }
    }
    if (k) {
      lines.push(
        `action      ${k.action} · tick ${k.actionTick}`,
        `position    ${k.x.toFixed(1)}, ${k.y.toFixed(1)}`,
        `vitesse     ${k.vx.toFixed(0)}, ${k.vy.toFixed(0)}`,
        `au sol      ${yesNo(k.grounded)} · gel ${k.hitstop} · invulnérable ${yesNo(isInvulnerable(k))}`,
        `vie         ${k.hp} / ${k.maxHp} · cendres ${k.ash} / ${ASH_MAX}`,
      );
    }
    if (d) {
      lines.push(
        `mannequin   ${d.hitsTaken} coups · dernier ${d.lastDamage} · total ${d.totalDamage}`,
      );
    }
    lines.push(`images/s    ${fps.toFixed(0)}`, '', ...CONTROLS);
    lines.push(
      session.debugActions
        ? 'H / M / C        tester coup reçu / mort / jauge pleine'
        : 'H / M            désactivés en duel (le serveur fait autorité)',
    );
    this.element.textContent = lines.join('\n');
  }
}
