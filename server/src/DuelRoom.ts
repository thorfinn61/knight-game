import { Room, type Client } from 'colyseus';
import {
  ARENA,
  DUEL_PLAYERS,
  OPPONENT_TARGET,
  StrikeReferee,
  TICK_RATE,
  advanceDuel,
  createDuelState,
  createKnight,
  generateRoomCode,
  revokeOpponentHit,
  sanitizeName,
  spawnPoint,
  staticLevel,
  stepKnight,
  vulnerableHeight,
  type SeenTarget,
  type WorldEvent,
} from '@cendres/shared';
import {
  EVENT_MESSAGE,
  InputSchema,
  KnightSchema,
  PATCH_RATE_MS,
  RoomStateSchema,
  type DuelMessage,
  type JoinOptions,
} from '@cendres/shared/net';

/** Canal de présence où sont réservés les codes des salons ouverts. */
const CODES_CHANNEL = '$cendres:codes';
/** L'arène sans le mannequin : en duel, on ne frappe que son adversaire. */
const LEVEL = { ...staticLevel(ARENA), targets: [] };

/**
 * Un duel 1 contre 1. Le serveur fait autorité : il applique chaque entrée reçue avec la même
 * fonction `stepKnight` que la prédiction du client, juge les coups annoncés sur l'adversaire
 * rembobiné tel que l'attaquant le voyait, et mène les manches.
 */
export class DuelRoom extends Room<{ state: RoomStateSchema; input: InputSchema }> {
  override maxClients = DUEL_PLAYERS;
  override patchRate = PATCH_RATE_MS;
  override state = new RoomStateSchema();

  /** Entrées des joueurs, mises en tampon par Colyseus ; moveX est ramené dans [-1, 1]. */
  override inputs = this.defineInput(InputSchema, {
    bufferMaxSize: 64,
    sanitize: { moveX: [-1, 1] },
  });
  /** Historique des positions, pour revoir l'arène telle qu'un joueur la voyait. */
  rewind = this.allowRewindState({ maxRewindMs: 500 });
  /** Arbitre des coups : il laisse à l'adversaire le temps de parer avant d'appliquer un coup. */
  private readonly referee = new StrikeReferee();
  private tick = 0;

  override async onCreate(options?: Partial<JoinOptions>): Promise<void> {
    const code = await this.reserveCode();
    this.roomId = code;
    Object.assign(this.state, createDuelState(), { code });
    // Un duel privé ne se rejoint que par son code ; les autres servent au combat rapide.
    if (options?.private) await this.setPrivate(true);
    this.rewind.attachAll(this.state.knights, { fields: ['x', 'y'] });
    this.rewind.attachAll(this.state.knights, {
      fields: ['vulnerableHeight'],
      interpolate: 'step',
    });
    this.setFixedTimestep(() => this.simulate(), TICK_RATE);
  }

  override onJoin(client: Client, options?: Partial<JoinOptions>): void {
    const taken = new Set(Array.from(this.state.knights.values(), (k) => k.skin));
    const place = taken.has(0) ? 1 : 0;
    const spawn = spawnPoint(ARENA, place);
    const knight = Object.assign(
      new KnightSchema(),
      createKnight(client.sessionId, spawn, spawn.facing),
      {
        name: sanitizeName(options?.name),
        skin: place,
        wins: 0,
      },
    );
    knight.vulnerableHeight = vulnerableHeight(knight);
    this.state.knights.set(client.sessionId, knight);
  }

  override onLeave(client: Client): void {
    this.state.knights.delete(client.sessionId);
  }

  override async onDispose(): Promise<void> {
    await this.presence.srem(CODES_CHANNEL, this.roomId);
  }

  /** Un pas fixe : chaque entrée reçue fait avancer son chevalier d'un tick. */
  private simulate(): void {
    this.tick++;
    const phase = this.state.phase;
    const events: WorldEvent[] = [];
    for (const [sessionId, knight] of this.state.knights) {
      for (const input of this.inputs.get(sessionId)) {
        for (const hit of stepKnight(knight, input, LEVEL)) {
          if (hit.targetIndex !== OPPONENT_TARGET) continue;
          const defender = this.opponentOf(sessionId);
          if (!defender) {
            revokeOpponentHit(knight);
            continue;
          }
          const seen = this.seenBy(sessionId, defender);
          events.push(...this.referee.claim(knight, defender, hit, phase, this.tick, seen));
        }
      }
    }
    events.push(...this.referee.resolve((id) => this.state.knights.get(id), phase, this.tick));
    advanceDuel(this.state, this.duelists(), ARENA, this.clock.elapsedTime);
    for (const knight of this.state.knights.values()) {
      knight.vulnerableHeight = vulnerableHeight(knight);
    }
    for (const event of events) {
      const message: DuelMessage = { ...event, time: this.clock.elapsedTime };
      this.broadcast(EVENT_MESSAGE, message);
    }
  }

  /** Les combattants rangés par place : à gauche, puis à droite. */
  private duelists(): KnightSchema[] {
    return Array.from(this.state.knights.values()).sort((a, b) => a.skin - b.skin);
  }

  private opponentOf(sessionId: string): KnightSchema | undefined {
    for (const [id, knight] of this.state.knights) if (id !== sessionId) return knight;
    return undefined;
  }

  /** L'adversaire tel que le joueur `sessionId` le voyait quand il a frappé. */
  private seenBy(sessionId: string, defender: KnightSchema): SeenTarget {
    const view = this.rewind.lastSeenBy(sessionId);
    return {
      x: view.value(defender, 'x'),
      y: view.value(defender, 'y'),
      height: view.value(defender, 'vulnerableHeight'),
    };
  }

  /** Tire un code libre et le réserve dans la présence, pour qu'aucun autre salon ne le prenne. */
  private async reserveCode(): Promise<string> {
    const taken = new Set(await this.presence.smembers(CODES_CHANNEL));
    let code = generateRoomCode(Math.random);
    while (taken.has(code)) code = generateRoomCode(Math.random);
    await this.presence.sadd(CODES_CHANNEL, code);
    return code;
  }
}
