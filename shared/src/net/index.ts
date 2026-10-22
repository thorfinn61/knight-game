/**
 * Protocole réseau, partagé par le client et le serveur. Point d'entrée séparé
 * (`@cendres/shared/net`) : la simulation elle-même ne dépend pas de Colyseus.
 */
import { schema, t, type SchemaType } from '@colyseus/schema';
import type { DuelPhase, DuelState, Duelist } from '../duel.ts';
import type { WorldEvent } from '../events.ts';
import type { Facing } from '../geometry.ts';
import type { Axis, InputFrame } from '../input.ts';
import type { KnightAction, KnightState } from '../knight/state.ts';

export const ROOM_NAME = 'duel';
export const SERVER_PORT = 2567;
/** Cadence d'envoi de l'état aux clients : à chaque pas, pour des duels nerveux. */
export const PATCH_RATE_MS = 1000 / 60;

/** Options envoyées par le client à la connexion. */
export interface JoinOptions {
  name: string;
  /** Salon privé, accessible seulement par son code (création uniquement). */
  private?: boolean;
}

/** Réponse de la route HTTP /info : adresses IP du serveur sur le réseau local. */
export interface ServerInfo {
  hosts: string[];
}

/** Entrée d'un tick, mêmes champs que `InputFrame`. Une entrée par pas fixe. */
export const InputSchema = schema(
  {
    moveX: t.int8<Axis>(),
    crouch: t.boolean(),
    jumpHeld: t.boolean(),
    jumpPressed: t.boolean(),
    attackPressed: t.boolean(),
    dodgePressed: t.boolean(),
    parryPressed: t.boolean(),
    blazePressed: t.boolean(),
    strike: t.boolean(),
  },
  'InputFrame',
);
export type InputSchema = SchemaType<typeof InputSchema>;

/** Chevalier synchronisé : les champs de `KnightState`, plus son nom et son apparence. */
export const KnightSchema = schema(
  {
    id: t.string(),
    x: t.float64(),
    y: t.float64(),
    vx: t.float64(),
    vy: t.float64(),
    facing: t.int8<Facing>(),
    grounded: t.boolean(),
    action: t.string<KnightAction>(),
    actionTick: t.uint32(),
    hitstop: t.uint8(),
    coyote: t.uint8(),
    jumpBuffer: t.uint8(),
    attackBuffer: t.uint8(),
    dodgeBuffer: t.uint8(),
    parryBuffer: t.uint8(),
    blazeBuffer: t.uint8(),
    jumpCut: t.boolean(),
    locked: t.boolean(),
    stun: t.uint8(),
    airPeakY: t.float64(),
    airDashUsed: t.boolean(),
    comboQueued: t.boolean(),
    hitMask: t.uint32(),
    hp: t.int16(),
    maxHp: t.int16(),
    power: t.float64(),
    armor: t.float64(),
    ash: t.uint8(),
    name: t.string(),
    skin: t.uint8(),
    wins: t.uint8(),
    /**
     * Hauteur vulnérable (0 pendant une esquive) : enregistrée par le serveur pour juger un
     * coup sur l'adversaire tel que l'attaquant le voyait. Hors de la prédiction.
     */
    vulnerableHeight: t.uint8(),
  },
  'Knight',
);
export type KnightSchema = SchemaType<typeof KnightSchema>;

/** État d'un salon de duel : ses deux combattants et la phase du duel. */
export const RoomStateSchema = schema(
  {
    code: t.string(),
    phase: t.string<DuelPhase>(),
    phaseEndsAt: t.float64(),
    round: t.uint8(),
    roundWinner: t.string(),
    matchWinner: t.string(),
    knights: t.map(KnightSchema),
  },
  'RoomState',
);
export type RoomStateSchema = SchemaType<typeof RoomStateSchema>;

/** Nom du message qui diffuse les événements du duel : coup porté, parade, choc des lames. */
export const EVENT_MESSAGE = 'event';

/** Événement du duel, horodaté sur l'horloge du salon (ms depuis sa création). */
export type DuelMessage = WorldEvent & { time: number };

// Vérifications à la compilation : le schéma reste compatible avec la simulation.
type Assert<T extends true> = T;
export type KnightSchemaMatchesState = Assert<KnightSchema extends KnightState ? true : false>;
export type KnightSchemaMatchesDuelist = Assert<KnightSchema extends Duelist ? true : false>;
export type RoomStateMatchesDuel = Assert<RoomStateSchema extends DuelState ? true : false>;
export type InputSchemaMatchesFrame = Assert<InputSchema extends InputFrame ? true : false>;
