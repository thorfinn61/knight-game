import { KNIGHT_STATE_FIELDS, TICK_MS, type KnightState } from '@cendres/shared';
import type { KnightSchema } from '@cendres/shared/net';

/** Nombre d'états conservés : un peu plus d'une seconde à 30 états par seconde. */
const MAX_SNAPSHOTS = 40;
/** Au-delà du dernier état reçu, l'animation continue au plus ce nombre de ticks. */
const MAX_EXTRAPOLATED_TICKS = 6;

interface Snapshot {
  /** Heure serveur de l'état, en millisecondes. */
  time: number;
  state: KnightState;
}

function copyState(source: KnightSchema): KnightState {
  const copy: Record<string, unknown> = {};
  for (const field of KNIGHT_STATE_FIELDS) copy[field] = source[field];
  return copy as unknown as KnightState;
}

/**
 * Chevalier d'un autre joueur : on garde ses derniers états reçus et on l'affiche un peu
 * dans le passé, interpolé entre deux états. Position et animation suivent la même horloge.
 */
export class RemoteKnight {
  readonly source: KnightSchema;
  private readonly snapshots: Snapshot[] = [];

  constructor(source: KnightSchema) {
    this.source = source;
  }

  /** Enregistre l'état courant, reçu avec le dernier patch du serveur. */
  record(serverTime: number): void {
    const last = this.snapshots[this.snapshots.length - 1];
    if (last && last.time >= serverTime) return;
    this.snapshots.push({ time: serverTime, state: copyState(this.source) });
    if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
  }

  /** État à afficher pour l'heure serveur `renderTime`. */
  at(renderTime: number): KnightState {
    const snaps = this.snapshots;
    const first = snaps[0];
    if (!first) return copyState(this.source);
    if (renderTime <= first.time) return { ...first.state };

    for (let i = snaps.length - 1; i >= 0; i--) {
      const a = snaps[i];
      if (!a || a.time > renderTime) continue;
      const b = snaps[i + 1];
      if (!b) return extrapolate(a, renderTime);
      const alpha = (renderTime - a.time) / (b.time - a.time);
      const sameAction =
        a.state.action === b.state.action && b.state.actionTick >= a.state.actionTick;
      return {
        ...a.state,
        x: a.state.x + (b.state.x - a.state.x) * alpha,
        y: a.state.y + (b.state.y - a.state.y) * alpha,
        actionTick: sameAction
          ? Math.floor(a.state.actionTick + (b.state.actionTick - a.state.actionTick) * alpha)
          : advance(a, renderTime),
      };
    }
    return { ...first.state };
  }
}

/** Fait avancer l'animation au-delà d'un état, sauf pendant un gel de coup. */
function advance(snapshot: Snapshot, renderTime: number): number {
  if (snapshot.state.hitstop > 0) return snapshot.state.actionTick;
  const ticks = Math.floor((renderTime - snapshot.time) / TICK_MS);
  return snapshot.state.actionTick + Math.min(ticks, MAX_EXTRAPOLATED_TICKS);
}

function extrapolate(snapshot: Snapshot, renderTime: number): KnightState {
  return { ...snapshot.state, actionTick: advance(snapshot, renderTime) };
}
