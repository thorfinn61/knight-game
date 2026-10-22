import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { ARENA, ATTACKS, ROOM_CODE_LENGTH } from '@cendres/shared';
import { PARRY_STAGGER_TICKS } from '@cendres/shared';
import {
  EVENT_MESSAGE,
  InputSchema,
  ROOM_NAME,
  type DuelMessage,
  type RoomStateSchema,
} from '@cendres/shared/net';
import { createGameServer } from '../src/app.ts';

const PORT = 2597;
const server = createGameServer();
const endpoint = `http://localhost:${PORT}`;

beforeAll(async () => {
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

function stateOf(room: Room): RoomStateSchema {
  return room.state as RoomStateSchema;
}

async function waitFor(condition: () => boolean, timeoutMs = 6000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('condition non atteinte à temps');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function quickMatch(name: string): Promise<Room> {
  return new Client(endpoint).joinOrCreate(ROOM_NAME, { name });
}

/** Envoie des entrées au rythme de la simulation, par paquets de 6 toutes les 100 ms. */
async function sendInputs(room: Room, frames: Partial<InputSchema>[]): Promise<void> {
  const input = room.input({ type: InputSchema });
  for (let i = 0; i < frames.length; i++) {
    Object.assign(input.data, {
      moveX: 0,
      crouch: false,
      jumpHeld: false,
      jumpPressed: false,
      attackPressed: false,
      dodgePressed: false,
      parryPressed: false,
      blazePressed: false,
      strike: false,
      ...frames[i],
    });
    input.send();
    if (i % 6 === 5) await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('salon de duel', () => {
  it('le combat rapide réunit deux joueurs, un troisième ouvre un autre duel', async () => {
    const aldric = await quickMatch('Aldric');
    const brune = await quickMatch('Brune');
    expect(brune.roomId).toBe(aldric.roomId);
    expect(aldric.roomId).toMatch(new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`));
    const third = await quickMatch('Cyprien');
    expect(third.roomId).not.toBe(aldric.roomId);
    await waitFor(() => stateOf(third).phase === 'waiting');
    for (const room of [aldric, brune, third]) await room.leave();
  });

  it('un duel privé ne se rejoint que par son code', async () => {
    const host = await new Client(endpoint).create(ROOM_NAME, { name: 'Hôte', private: true });
    const stranger = await quickMatch('Passant');
    expect(stranger.roomId).not.toBe(host.roomId);
    const friend = await new Client(endpoint).joinById(host.roomId, { name: 'Ami' });
    await waitFor(() => stateOf(host).knights?.size === 2);
    for (const room of [host, stranger, friend]) await room.leave();
  });

  it('refuse un code inconnu', async () => {
    await expect(new Client(endpoint).joinById('ZZZZ', { name: 'Perdu' })).rejects.toThrow();
  });

  it('mène une manche : compte à rebours, puis les coups annoncés portent', async () => {
    const left = await quickMatch('Gauche');
    const right = await quickMatch('Droite');
    const hits: DuelMessage[] = [];
    right.onMessage(EVENT_MESSAGE, (message: DuelMessage) => hits.push(message));
    left.onMessage(EVENT_MESSAGE, () => undefined);

    await waitFor(() => stateOf(left).phase === 'countdown');
    const state = stateOf(left);
    const me = state.knights.get(left.sessionId);
    const foe = state.knights.get(right.sessionId);
    expect(me?.x).toBe(ARENA.spawns[0]?.x);
    expect(foe?.x).toBe(ARENA.spawns[1]?.x);
    expect(me?.locked).toBe(true);
    await waitFor(() => stateOf(left).phase === 'fighting', 5000);

    // Gauche s'approche puis frappe en annonçant le coup ; Droite ne bouge pas.
    await sendInputs(
      left,
      Array.from({ length: 66 }, () => ({ moveX: 1 as const })),
    );
    await sendInputs(left, [
      { attackPressed: true },
      ...Array.from({ length: 24 }, () => ({ strike: true })),
    ]);
    await waitFor(() => hits.length > 0);
    expect(hits[0]?.attackerId).toBe(left.sessionId);
    expect(hits[0]?.targetId).toBe(right.sessionId);
    await waitFor(() => (stateOf(right).knights.get(right.sessionId)?.hp ?? 100) < 100);
    expect(stateOf(right).knights.get(right.sessionId)?.hp).toBe(100 - ATTACKS.attack1.damage);

    // Une annonce sans adversaire à portée ne fait rien.
    await sendInputs(
      left,
      Array.from({ length: 40 }, () => ({ moveX: -1 as const })),
    );
    await sendInputs(left, [
      { attackPressed: true },
      ...Array.from({ length: 24 }, () => ({ strike: true })),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(hits).toHaveLength(1);

    await right.leave();
    await waitFor(() => stateOf(left).phase === 'waiting');
    await left.leave();
  }, 20000);

  it('une parade envoyée à temps renvoie le coup à travers le réseau', async () => {
    const left = await quickMatch('Assaillant');
    const right = await quickMatch('Pareur');
    const events: DuelMessage[] = [];
    right.onMessage(EVENT_MESSAGE, (message: DuelMessage) => events.push(message));
    left.onMessage(EVENT_MESSAGE, () => undefined);
    await waitFor(() => stateOf(left).phase === 'fighting', 8000);

    await sendInputs(
      left,
      Array.from({ length: 66 }, () => ({ moveX: 1 as const })),
    );
    // L'armé dure 9 ticks : le second paquet contient la frame active, la parade part avec.
    await sendInputs(left, [
      { attackPressed: true },
      ...Array.from({ length: 5 }, () => ({ strike: true })),
    ]);
    const rest = sendInputs(
      left,
      Array.from({ length: 18 }, () => ({ strike: true })),
    );
    await sendInputs(right, [{ parryPressed: true }, ...Array.from({ length: 11 }, () => ({}))]);
    await rest;
    await waitFor(() => events.length > 0);

    expect(events[0]?.type).toBe('parry');
    const state = stateOf(right);
    expect(state.knights.get(right.sessionId)?.hp).toBe(100);
    await waitFor(() => stateOf(right).knights.get(left.sessionId)?.action === 'hurt');
    expect(stateOf(right).knights.get(left.sessionId)?.stun).toBe(PARRY_STAGGER_TICKS);

    await right.leave();
    await left.leave();
  }, 20000);
});
