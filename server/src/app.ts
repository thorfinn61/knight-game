import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { defineRoom, defineServer } from 'colyseus';
import { ROOM_NAME, type ServerInfo } from '@cendres/shared/net';
import { DuelRoom } from './DuelRoom.ts';
import { lanHosts } from './network.ts';

/** Build de production du client, servi par ce même serveur : un seul port à ouvrir. */
export const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

/**
 * Configuration du serveur. La latence simulée se règle sans toucher au code, avec la
 * variable d'environnement COLYSEUS_LATENCY (aller-retour en millisecondes).
 */
export function createGameServer() {
  return defineServer({
    rooms: { [ROOM_NAME]: defineRoom(DuelRoom) },
    greet: false,
    express: (app) => {
      app.get('/info', (_request, response) => {
        const info: ServerInfo = { hosts: lanHosts() };
        response.set('Access-Control-Allow-Origin', '*').json(info);
      });
      if (existsSync(CLIENT_DIST)) app.use(express.static(CLIENT_DIST));
    },
  });
}
