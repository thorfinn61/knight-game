import { Client, type Room } from '@colyseus/sdk';
import {
  ROOM_NAME,
  SERVER_PORT,
  type JoinOptions,
  type RoomStateSchema,
  type ServerInfo,
} from '@cendres/shared/net';

export type DuelRoomHandle = Room<RoomStateSchema>;

/**
 * Adresse du serveur de jeu : paramètre `?server=` de l'URL, sinon variable VITE_SERVER_URL.
 * En développement, le serveur tourne à côté de Vite sur son propre port ; une fois construit,
 * le jeu est servi par le serveur lui-même, donc à la même adresse que la page.
 */
export function serverEndpoint(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('server');
  if (fromUrl) return fromUrl;
  const fromEnv = import.meta.env['VITE_SERVER_URL'] as string | undefined;
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV)
    return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}`;
  return window.location.origin;
}

/** Combat rapide : rejoint le premier duel qui attend un adversaire, sinon en ouvre un. */
export function quickMatch(name: string): Promise<DuelRoomHandle> {
  const options: JoinOptions = { name };
  return new Client(serverEndpoint()).joinOrCreate(ROOM_NAME, options);
}

/** Duel privé : seul celui qui connaît le code peut le rejoindre. */
export function createPrivateDuel(name: string): Promise<DuelRoomHandle> {
  const options: JoinOptions = { name, private: true };
  return new Client(serverEndpoint()).create(ROOM_NAME, options);
}

export function joinDuel(code: string, name: string): Promise<DuelRoomHandle> {
  const options: JoinOptions = { name };
  return new Client(serverEndpoint()).joinById(code, options);
}

/** Adresses de ce serveur sur le réseau local, ou null s'il est injoignable. */
export async function fetchServerInfo(): Promise<ServerInfo | null> {
  try {
    const response = await fetch(`${serverEndpoint()}/info`);
    if (!response.ok) return null;
    return (await response.json()) as ServerInfo;
  } catch {
    return null;
  }
}

/** Adresse à donner à un autre joueur du réseau local : même port que cette page. */
export function shareUrl(host: string): string {
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${host}${port}`;
}

/** Message d'erreur de connexion lisible par le joueur. */
export function describeConnectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/locked|full/i.test(message)) return 'Ce duel est complet.';
  if (/not found|no rooms|invalid|unknown/i.test(message)) return 'Aucun duel ne porte ce code.';
  if (/fetch|network|ECONNREFUSED|Failed/i.test(message))
    return 'Serveur injoignable. Est-il lancé ?';
  return `Connexion impossible : ${message}`;
}
