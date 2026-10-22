import { Callbacks, Predict, type Reconciler } from '@colyseus/sdk';
import {
  ARENA,
  KNIGHT_STATE_FIELDS,
  OPPONENT_TARGET,
  ATTACKS,
  activeHitbox,
  hasHitOpponent,
  intersection,
  isAttackId,
  isCounterable,
  isParrying,
  seenBox,
  seenNow,
  staticLevel,
  stepKnight,
  swordsCross,
  updateKnight,
  type DummyState,
  type InputFrame,
  type KnightHit,
  type KnightState,
  type Point,
  type WorldEvent,
} from '@cendres/shared';
import {
  EVENT_MESSAGE,
  InputSchema,
  type DuelMessage,
  type KnightSchema,
} from '@cendres/shared/net';
import type { DuelRoomHandle } from '../net/connection.ts';
import { RemoteKnight } from './RemoteKnight.ts';
import type { DisplayedKnight, DuelStatus, Session, SessionStatus } from './Session.ts';

/**
 * L'adversaire est affiché avec ce retard, pour toujours avoir deux états à interpoler.
 * Le serveur rembobine à ce même instant pour juger nos coups : un seul réglage pour les deux.
 */
const REMOTE_DELAY_MS = 60;
/** Durée d'effacement d'une correction de prédiction. */
const CORRECTION_SMOOTH_MS = 50;
/** Au-delà de cet écart (en pixels), la correction est immédiate : retour en place, recul. */
const CORRECTION_SNAP_PX = 40;
/** Écart persistant à partir duquel le SDK signale une simulation qui diverge vraiment. */
const DIVERGENCE_WARNING_PX = 24;
/** Un coup trop ancien ou trop en avance est joué tout de suite. */
const MAX_EFFECT_WAIT_MS = 1000;
/** En duel, on ne frappe que l'adversaire : pas de mannequin. */
const LEVEL = { ...staticLevel(ARENA), targets: [] };

type LocalPrediction = Reconciler<KnightSchema>;

/**
 * Duel en ligne. Le serveur fait autorité ; ce navigateur prédit son propre chevalier avec la
 * même fonction `stepKnight`, puis se corrige à chaque état reçu (Colyseus rejoue les entrées
 * pas encore confirmées). L'adversaire est interpolé un peu dans le passé.
 *
 * Nos coups sont annoncés : quand notre hitbox croise l'adversaire tel qu'on le voit, l'entrée
 * du tick porte `strike`. Prédiction et serveur appliquent alors le même verdict à notre
 * chevalier, et le serveur vérifie le coup sur l'adversaire rembobiné avant les dégâts.
 */
export class OnlineSession implements Session {
  readonly mode = 'duel';
  readonly debugActions = null;
  private readonly room: DuelRoomHandle;
  private readonly predict: Predict;
  private readonly input;
  private readonly remotes = new Map<string, RemoteKnight>();
  private self: { source: KnightSchema; prediction: LocalPrediction } | null = null;
  private displayed: DisplayedKnight[] = [];
  /** L'adversaire tel qu'il est affiché : c'est sur lui que nos coups sont annoncés. */
  private opponentView: { id: string; state: KnightState } | null = null;
  /** Point d'impact de notre dernier coup annoncé, pour placer l'étincelle. */
  private strikeContact: Point | null = null;
  /**
   * Notre dernier coup annoncé risque d'être paré ou de croiser la lame adverse : ses effets
   * attendent le verdict du serveur au lieu d'être joués dès la prédiction.
   */
  private strikeUncertain = false;
  /** Heures (horloge locale) de nos coups dont les effets attendent le verdict du serveur. */
  private awaitingVerdicts: number[] = [];
  private events: WorldEvent[] = [];
  /** Événements vus de loin, en attente du moment où le chevalier affiché frappe. */
  private delayedEvents: DuelMessage[] = [];
  private pingMs: number | null = null;
  private endListeners: ((reason: string) => void)[] = [];
  private leaving = false;

  constructor(room: DuelRoomHandle) {
    this.room = room;
    this.predict = Predict.get(room, { mode: 'lerp', delay: REMOTE_DELAY_MS });
    this.input = room.input({ type: InputSchema });
    if (this.input.tickRate === undefined) {
      throw new Error("le serveur n'annonce pas de cadence de simulation fixe");
    }

    const callbacks = Callbacks.get(room);
    callbacks.onAdd('knights', (knight: KnightSchema, sessionId: string) => {
      if (sessionId === room.sessionId) this.attachSelf(knight);
      else this.remotes.set(sessionId, new RemoteKnight(knight));
    });
    callbacks.onRemove('knights', (_knight: KnightSchema, sessionId: string) => {
      this.remotes.delete(sessionId);
    });
    room.onStateChange(() => {
      const serverTime = room.clock.lastServerTime();
      for (const remote of this.remotes.values()) remote.record(serverTime);
    });
    room.onMessage(EVENT_MESSAGE, (message: DuelMessage) => this.onServerEvent(message));
    room.onLeave((code: number) => {
      if (this.leaving) return;
      const reason = code === 1000 ? 'Le duel a été fermé.' : 'Connexion au serveur perdue.';
      for (const listener of this.endListeners) listener(reason);
    });
  }

  update(timeMs: number, _deltaMs: number, sample: () => InputFrame): void {
    // Une entrée par pas fixe dû, envoyée avant toute lecture (contrat de la prédiction).
    const steps = this.predict.tick(timeMs);
    for (let i = 0; i < steps; i++) {
      const frame = sample();
      Object.assign(this.input.data, frame, { strike: this.claimStrike(frame) });
      this.input.send();
    }

    const renderTime = this.room.clock.renderNow() - REMOTE_DELAY_MS;
    this.releaseDelayedEvents(renderTime);
    this.pingMs = this.room.clock.smoothedRtt() || this.room.clock.rtt() || null;

    const displayed: DisplayedKnight[] = [];
    if (this.self) {
      const { source, prediction } = this.self;
      const exact = prediction.state as KnightState;
      displayed.push({
        id: this.room.sessionId,
        name: source.name,
        skin: source.skin,
        local: true,
        state: { ...exact, x: prediction.value('x'), y: prediction.value('y') },
      });
    }
    this.opponentView = null;
    for (const [id, remote] of this.remotes) {
      const state = remote.at(renderTime);
      displayed.push({
        id,
        name: remote.source.name,
        skin: remote.source.skin,
        local: false,
        state,
      });
      this.opponentView ??= { id, state };
    }
    this.displayed = displayed;
  }

  knights(): readonly DisplayedKnight[] {
    return this.displayed;
  }

  dummies(): readonly DummyState[] {
    return [];
  }

  localKnight(): KnightState | null {
    return this.self ? (this.self.prediction.state as KnightState) : null;
  }

  drainEvents(): WorldEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  status(): SessionStatus {
    const state = this.room.state;
    const duel = this.duelStatus();
    return {
      mode: 'duel',
      code: state.code || this.room.roomId,
      players: state.knights?.size ?? 1,
      pingMs: this.pingMs,
      driftPx: this.self ? this.self.prediction.drift.ema : null,
      duel,
      self: duel?.fighters.find((f) => f.local) ?? null,
    };
  }

  onEnded(listener: (reason: string) => void): void {
    this.endListeners.push(listener);
  }

  destroy(): void {
    this.leaving = true;
    this.endListeners = [];
    this.predict.dispose();
    void this.room.leave();
  }

  private duelStatus(): DuelStatus | null {
    const state = this.room.state;
    if (!state.phase) return null;
    const predicted = this.self ? (this.self.prediction.state as KnightState) : null;
    const fighters = Array.from(state.knights?.values() ?? [], (k) => {
      // Notre chevalier est affiché prédit : sa vie et sa jauge aussi.
      const shown = k.id === this.room.sessionId && predicted ? predicted : k;
      return {
        id: k.id,
        name: k.name,
        skin: k.skin,
        hp: shown.hp,
        maxHp: k.maxHp,
        wins: k.wins,
        ash: shown.ash,
        local: k.id === this.room.sessionId,
      };
    }).sort((a, b) => a.skin - b.skin);
    return {
      phase: state.phase,
      remainingMs: Math.max(0, state.phaseEndsAt - this.room.clock.serverNow()),
      round: state.round,
      roundWinner: state.roundWinner,
      matchWinner: state.matchWinner,
      fighters,
    };
  }

  /**
   * Notre coup touche-t-il l'adversaire tel qu'on le voit ? On rejoue d'avance ce tick sur
   * une copie de notre état pour connaître la hitbox, sans rien envoyer ni modifier.
   */
  private claimStrike(frame: InputFrame): boolean {
    this.strikeContact = null;
    this.strikeUncertain = false;
    const opponent = this.opponentView;
    if (!this.self || !opponent) return false;
    const preview = { ...(this.self.prediction.state as KnightState) };
    updateKnight(preview, frame, LEVEL.solids);
    if (preview.hitstop > 0 || hasHitOpponent(preview)) return false;
    const hitbox = activeHitbox(preview);
    const seen = seenNow(opponent.state);
    if (!hitbox || seen.height <= 0 || opponent.state.hp <= 0) return false;
    const contact = intersection(hitbox, seenBox(seen));
    if (!contact) return false;
    this.strikeContact = { x: contact.x + contact.w / 2, y: contact.y + contact.h / 2 };
    // Un coup imparable (Embrasement) ne dépend pas de ce que fait l'adversaire.
    const unparryable = isAttackId(preview.action) && ATTACKS[preview.action].unparryable;
    this.strikeUncertain =
      !unparryable && (isParrying(opponent.state) || swordsCross(preview, opponent.state));
    return true;
  }

  /** Prédiction de notre chevalier : la même fonction que le serveur, rejouée au besoin. */
  private attachSelf(source: KnightSchema): void {
    const prediction = this.predict.reconciler(source, {
      input: this.input,
      fields: KNIGHT_STATE_FIELDS as readonly (keyof KnightSchema & string)[],
      smoothMs: CORRECTION_SMOOTH_MS,
      snap: CORRECTION_SNAP_PX,
      warnOnDivergence: DIVERGENCE_WARNING_PX,
      step: (ctx, state, command) => {
        const hits = stepKnight(state as KnightState, command as InputFrame, LEVEL);
        // Un pas rejoué lors d'une correction ne rejoue pas ses effets.
        if (!ctx.isReplay) for (const hit of hits) this.onPredictedHit(hit);
      },
    });
    this.self = { source, prediction };
  }

  /** Notre coup vient de porter, d'après notre écran : effets immédiats, sans attendre le serveur. */
  private onPredictedHit(hit: KnightHit): void {
    const opponent = this.opponentView;
    if (hit.targetIndex !== OPPONENT_TARGET || !opponent) return;
    if (this.strikeUncertain) {
      this.awaitingVerdicts.push(performance.now());
      return;
    }
    const contact = this.strikeContact ?? { x: hit.x, y: hit.y };
    this.events.push({
      type: 'hit',
      attackerId: this.room.sessionId,
      targetId: opponent.id,
      attack: hit.attack,
      damage: hit.damage,
      heavy: hit.heavy,
      // Le serveur tranche ; on prédit le contre d'après ce que fait l'adversaire à l'écran.
      counter: isCounterable(opponent.state),
      x: contact.x,
      y: contact.y,
      direction: hit.direction,
    });
  }

  /**
   * Verdict du serveur. Nos coups prédits ont déjà été joués, sauf ceux qui attendaient ce
   * verdict. Ce qui nous concerne (coup reçu, parade, choc) est joué aussitôt, notre chevalier
   * étant affiché au présent ; le reste attend l'instant où le chevalier affiché frappe.
   */
  private onServerEvent(message: DuelMessage): void {
    const self = this.room.sessionId;
    if (message.attackerId === self) {
      const awaited = this.takeAwaitedVerdict();
      if (message.type === 'hit' && !awaited) return;
      this.events.push(message);
    } else if (message.targetId === self) {
      this.events.push(message);
    } else {
      this.delayedEvents.push(message);
    }
  }

  /** Retire notre plus ancien coup en attente de verdict ; faux s'il n'y en a pas. */
  private takeAwaitedVerdict(): boolean {
    const now = performance.now();
    this.awaitingVerdicts = this.awaitingVerdicts.filter((t) => now - t <= MAX_EFFECT_WAIT_MS);
    return this.awaitingVerdicts.shift() !== undefined;
  }

  private releaseDelayedEvents(renderTime: number): void {
    const waiting: DuelMessage[] = [];
    for (const event of this.delayedEvents) {
      const due =
        event.time <= renderTime || Math.abs(event.time - renderTime) > MAX_EFFECT_WAIT_MS;
      if (due) this.events.push(event);
      else waiting.push(event);
    }
    this.delayedEvents = waiting;
  }
}
