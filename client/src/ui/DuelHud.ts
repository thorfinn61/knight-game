import { ASH_MAX, ROUNDS_TO_WIN } from '@cendres/shared';
import type { DuelStatus, FighterStatus } from '../session/Session.ts';
import { requireElement } from './dom.ts';

/** Vitesse à laquelle la traînée de la barre de vie rattrape la vie réelle, par seconde. */
const TRAIL_RATE = 1.6;
/** Durée d'affichage de « Combattez ! » au début de chaque manche. */
const FIGHT_CALL_MS = 900;

interface FighterPanel {
  root: HTMLElement;
  name: HTMLElement;
  fill: HTMLElement;
  trail: HTMLElement;
  pips: HTMLElement;
  ash: HTMLElement;
  ashReady: HTMLElement;
  trailRatio: number;
}

/**
 * Interface du duel, façon jeu de combat : une barre de vie et une jauge des Cendres par
 * combattant, ses manches gagnées, le chronomètre, et les annonces au centre (compte à
 * rebours, K.O., victoire). À l'entraînement, seul le panneau du joueur reste.
 */
export class DuelHud {
  private readonly root = requireElement('duel-hud');
  private readonly timer = requireElement('duel-timer');
  private readonly roundLabel = requireElement('duel-round');
  private readonly banner = requireElement('banner');
  private readonly bannerTitle = requireElement('banner-title');
  private readonly bannerSubtitle = requireElement('banner-subtitle');
  private readonly panels: [FighterPanel, FighterPanel];
  private fightCallUntil = 0;
  private lastPhase = '';

  constructor() {
    this.panels = [this.panel('fighter-left'), this.panel('fighter-right')];
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.root.classList.remove('training');
    this.banner.hidden = true;
    this.lastPhase = '';
  }

  /** Entraînement : le seul panneau du joueur, pour voir sa vie et sa jauge. */
  updateTraining(self: FighterStatus, deltaMs: number): void {
    this.root.classList.add('training');
    this.updatePanel(this.panels[0], self, deltaMs);
  }

  /** `invite` : texte affiché en attendant l'adversaire (code, adresse à partager). */
  update(duel: DuelStatus, timeMs: number, deltaMs: number, invite: string): void {
    const [left, right] = [duel.fighters[0], duel.fighters[1]];
    this.updatePanel(this.panels[0], left, deltaMs);
    this.updatePanel(this.panels[1], right, deltaMs);

    const fighting = duel.phase === 'fighting';
    this.timer.textContent = fighting ? String(Math.ceil(duel.remainingMs / 1000)) : '';
    this.roundLabel.textContent = duel.round > 0 ? `Manche ${duel.round}` : '';

    if (fighting && this.lastPhase === 'countdown') this.fightCallUntil = timeMs + FIGHT_CALL_MS;
    this.lastPhase = duel.phase;
    this.showBanner(...this.bannerText(duel, timeMs, invite));
  }

  private bannerText(duel: DuelStatus, timeMs: number, invite: string): [string, string] {
    const name = (id: string) => duel.fighters.find((f) => f.id === id)?.name ?? '';
    const seconds = Math.ceil(duel.remainingMs / 1000);
    switch (duel.phase) {
      case 'waiting':
        return ['En attente d’un adversaire…', invite];
      case 'countdown':
        return [seconds > 0 ? String(seconds) : '', `Manche ${duel.round}`];
      case 'fighting':
        return timeMs < this.fightCallUntil ? ['Combattez !', ''] : ['', ''];
      case 'roundOver': {
        const knockedOut = duel.fighters.some((f) => f.hp <= 0);
        const title = knockedOut ? 'K.O.' : 'Temps écoulé';
        const winner = name(duel.roundWinner);
        return [title, winner ? `${winner} remporte la manche` : 'Égalité'];
      }
      case 'matchOver':
        return [`${name(duel.matchWinner)} remporte le duel !`, `Nouveau duel dans ${seconds} s`];
    }
  }

  private showBanner(title: string, subtitle: string): void {
    const visible = title.length > 0 || subtitle.length > 0;
    this.banner.hidden = !visible;
    if (this.bannerTitle.textContent !== title) this.bannerTitle.textContent = title;
    if (this.bannerSubtitle.textContent !== subtitle) this.bannerSubtitle.textContent = subtitle;
  }

  private panel(id: string): FighterPanel {
    const root = requireElement(id);
    const get = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`${selector} introuvable dans #${id}`);
      return element;
    };
    return {
      root,
      name: get('.fighter-name'),
      fill: get('.fill'),
      trail: get('.trail'),
      pips: get('.pips'),
      ash: get('.ash-fill'),
      ashReady: get('.ash-ready'),
      trailRatio: 1,
    };
  }

  private updatePanel(
    panel: FighterPanel,
    fighter: FighterStatus | undefined,
    deltaMs: number,
  ): void {
    panel.root.classList.toggle('empty', !fighter);
    panel.root.classList.toggle('local', fighter?.local ?? false);
    const label = fighter ? fighter.name : '—';
    if (panel.name.textContent !== label) panel.name.textContent = label;
    const ratio = fighter ? Math.max(0, fighter.hp / fighter.maxHp) : 0;
    // La traînée rouge descend lentement derrière la vie : on lit les dégâts du dernier échange.
    // Place libre : rien à lire, la barre est vide d'un coup.
    panel.trailRatio =
      !fighter || ratio >= panel.trailRatio
        ? ratio
        : Math.max(ratio, panel.trailRatio - TRAIL_RATE * (deltaMs / 1000));
    panel.fill.style.width = `${(ratio * 100).toFixed(1)}%`;
    panel.trail.style.width = `${(panel.trailRatio * 100).toFixed(1)}%`;
    const pips = Array.from({ length: ROUNDS_TO_WIN }, (_, i) =>
      fighter && i < fighter.wins ? '●' : '○',
    ).join(' ');
    if (panel.pips.textContent !== pips) panel.pips.textContent = pips;

    const ash = fighter ? Math.min(1, fighter.ash / ASH_MAX) : 0;
    const full = ash >= 1;
    panel.ash.style.width = `${(ash * 100).toFixed(1)}%`;
    panel.root.classList.toggle('ash-full', full);
    const ready = !full ? '' : fighter?.local ? 'Embrasement prêt · E' : 'Embrasement prêt';
    if (panel.ashReady.textContent !== ready) panel.ashReady.textContent = ready;
  }
}
