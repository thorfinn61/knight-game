import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config.ts';
import { computeZoom } from './display.ts';
import {
  createPrivateDuel,
  describeConnectionError,
  joinDuel,
  quickMatch,
  type DuelRoomHandle,
} from './net/connection.ts';
import { ArenaScene, type ArenaData } from './scenes/ArenaScene.ts';
import { ASSETS_READY, BootScene } from './scenes/BootScene.ts';
import { DebugOverlayScene } from './scenes/DebugOverlayScene.ts';
import { OnlineSession } from './session/OnlineSession.ts';
import type { Session } from './session/Session.ts';
import { SoloSession } from './session/SoloSession.ts';
import { Menu } from './ui/Menu.ts';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, zoom: computeZoom() },
  audio: { noAudio: true },
  // Le clavier est lu directement (par position physique), pas par Phaser.
  input: { keyboard: false, gamepad: false },
  scene: [BootScene, ArenaScene, DebugOverlayScene],
});

window.addEventListener('resize', () => game.scale.setZoom(computeZoom()));

const assetsReady = new Promise<void>((resolve) => {
  if (game.registry.get(ASSETS_READY)) resolve();
  else game.events.once(ASSETS_READY, () => resolve());
});

/** Lance l'arène avec une session, une fois les textures chargées. */
async function play(session: Session): Promise<void> {
  await assetsReady;
  menu.hide();
  const data: ArenaData = { session, invite: menu.shareAddress, exit: backToMenu };
  game.scene.start('Arena', data);
}

function backToMenu(message?: string): void {
  game.scene.stop('Arena');
  menu.show(message);
}

/** Les erreurs de connexion sont traduites en messages lisibles, affichés par le menu. */
async function connect(open: () => Promise<DuelRoomHandle>): Promise<void> {
  let session: Session;
  try {
    session = new OnlineSession(await open());
  } catch (error) {
    throw new Error(describeConnectionError(error));
  }
  await play(session);
}

const menu = new Menu({
  quickMatch: (name) => connect(() => quickMatch(name)),
  createPrivate: (name) => connect(() => createPrivateDuel(name)),
  join: (code, name) => connect(() => joinDuel(code, name)),
  training: (name) => play(new SoloSession(name)),
});
menu.show();
