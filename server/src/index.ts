import { existsSync } from 'node:fs';
import { SERVER_PORT } from '@cendres/shared/net';
import { CLIENT_DIST, createGameServer } from './app.ts';
import { lanHosts } from './network.ts';

const port = Number(process.env['PORT'] ?? SERVER_PORT);
const server = createGameServer();
await server.listen(port);

console.log(`[serveur] L'Ordre des Cendres écoute sur le port ${port}.`);
if (existsSync(CLIENT_DIST)) {
  console.log(`[serveur] Jeu servi sur http://localhost:${port}`);
  for (const host of lanHosts())
    console.log(`[serveur] Depuis un autre PC : http://${host}:${port}`);
} else {
  console.log(
    '[serveur] Client non construit : lancer « npm run build », ou jouer via « npm run dev ».',
  );
}
