import {
  ARENA,
  ASH_MAX,
  TICK_MS,
  createWorld,
  hurtKnight,
  killKnight,
  step,
  type DummyState,
  type Facing,
  type HitEvent,
  type InputFrame,
  type KnightState,
  type World,
} from '@cendres/shared';
import type { DisplayedKnight, Session, SessionStatus } from './Session.ts';

const LOCAL_ID = 'entrainement';
/** Au-delà de ce retard (onglet en arrière-plan), la simulation ne rattrape pas le temps perdu. */
const MAX_CATCH_UP_MS = 250;

/** Entraînement : seul face au mannequin, la simulation tourne dans le navigateur, sans serveur. */
export class SoloSession implements Session {
  readonly mode = 'training';
  readonly debugActions;
  private readonly world: World;
  private readonly name: string;
  private accumulator = 0;
  /** Position avant le dernier tick, pour interpoler l'affichage entre deux ticks. */
  private previous = { x: 0, y: 0 };
  private hits: HitEvent[] = [];
  private displayed: DisplayedKnight[] = [];

  constructor(name: string) {
    this.name = name;
    this.world = createWorld(ARENA, [LOCAL_ID]);
    const k = this.knight;
    this.previous = { x: k.x, y: k.y };
    this.debugActions = {
      hurt: () => hurtKnight(this.knight, (this.knight.facing === 1 ? -1 : 1) as Facing),
      kill: () => killKnight(this.knight),
      fillAsh: () => {
        this.knight.ash = ASH_MAX;
      },
    };
  }

  update(_timeMs: number, deltaMs: number, sample: () => InputFrame): void {
    this.accumulator = Math.min(this.accumulator + deltaMs, MAX_CATCH_UP_MS);
    while (this.accumulator >= TICK_MS) {
      this.previous = { x: this.knight.x, y: this.knight.y };
      this.hits.push(...step(this.world, { [LOCAL_ID]: sample() }));
      this.accumulator -= TICK_MS;
    }
    const k = this.knight;
    const alpha = this.accumulator / TICK_MS;
    this.displayed = [
      {
        id: LOCAL_ID,
        name: this.name,
        skin: 0,
        local: true,
        state: {
          ...k,
          x: this.previous.x + (k.x - this.previous.x) * alpha,
          y: this.previous.y + (k.y - this.previous.y) * alpha,
        },
      },
    ];
  }

  knights(): readonly DisplayedKnight[] {
    return this.displayed;
  }

  dummies(): readonly DummyState[] {
    return this.world.dummies;
  }

  localKnight(): KnightState {
    return this.knight;
  }

  drainEvents(): HitEvent[] {
    const hits = this.hits;
    this.hits = [];
    return hits;
  }

  status(): SessionStatus {
    const k = this.knight;
    return {
      mode: 'training',
      code: null,
      players: 1,
      pingMs: null,
      driftPx: null,
      duel: null,
      self: {
        id: LOCAL_ID,
        name: this.name,
        skin: 0,
        hp: k.hp,
        maxHp: k.maxHp,
        wins: 0,
        ash: k.ash,
        local: true,
      },
    };
  }

  onEnded(): void {
    // Un entraînement ne s'arrête jamais de lui-même.
  }

  destroy(): void {
    this.hits = [];
  }

  private get knight(): KnightState {
    const k = this.world.knights[0];
    if (!k) throw new Error('aucun chevalier dans le monde');
    return k;
  }
}
