// Test de fumée : lance le serveur de jeu (avec latence simulée) et le serveur de dev Vite,
// puis joue dans Chrome sans fenêtre :
//   1. un entraînement passant par toutes les actions du chevalier ;
//   2. un duel complet entre deux navigateurs réunis par le combat rapide : une parade, puis
//      des combos jusqu'à la victoire, avec un Embrasement une fois la jauge remplie.
// Usage : npm run smoke [-- dossier_de_sortie]   (captures dans .smoke/ par défaut)
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] ?? path.join(root, '.smoke'));
const GAME_PORT = 2598;
/** Aller-retour simulé entre clients et serveur, pour exercer la prédiction. */
const LATENCY_MS = 80;
const chromePath = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((candidate) => candidate && existsSync(candidate));

if (!chromePath) {
  console.error('Chrome introuvable : indiquer son chemin dans la variable CHROME_PATH.');
  process.exit(1);
}

const REQUIRED_ACTIONS = [
  'idle',
  'run',
  'turn',
  'jump',
  'fall',
  'crouchDown',
  'attack1',
  'attack2',
  'crouchAttack',
  'airAttack',
  'parry',
  'blaze',
  'roll',
  'dash',
  'slide',
  'hurt',
  'dead',
];

await mkdir(outDir, { recursive: true });
process.env.COLYSEUS_LATENCY = String(LATENCY_MS);
const { createGameServer } = await import('../server/src/app.ts');
const gameServer = createGameServer();
await gameServer.listen(GAME_PORT);

const vite = await createServer({
  root: path.join(root, 'client'),
  configFile: path.join(root, 'client/vite.config.ts'),
  logLevel: 'warn',
  server: { port: 5199 },
});
await vite.listen();
const url = `${vite.resolvedUrls?.local[0]}?server=${encodeURIComponent(`http://localhost:${GAME_PORT}`)}`;

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const problems = [];
const warnings = [];
let exitCode = 0;

/** Ouvre le jeu dans un nouvel onglet isolé et surveille ses erreurs. */
async function openGame(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`${label} console : ${msg.text()}`);
    else if (msg.type() === 'warning') warnings.push(`${label} : ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`${label} exception : ${error.message}`));
  page.on('requestfailed', (request) =>
    problems.push(`${label} requête échouée : ${request.url()}`),
  );
  page.on('response', (response) => {
    if (response.status() >= 400)
      problems.push(`${label} HTTP ${response.status()} : ${response.url()}`);
  });
  await page.goto(url);
  return page;
}

function helpers(page) {
  const wait = (ms) => page.waitForTimeout(ms);
  return {
    wait,
    shot: (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) }),
    tap: async (key, ms = 60) => {
      await page.keyboard.down(key);
      await wait(ms);
      await page.keyboard.up(key);
    },
    /** Résumé de l'état vu par cette page. */
    state: () =>
      page.evaluate(() => {
        const { session } = window.__cendres;
        const k = session.localKnight();
        const status = session.status();
        return {
          x: k?.x ?? null,
          action: k?.action ?? null,
          ash: k?.ash ?? 0,
          ashShown: document.getElementById('fighter-left').classList.contains('ash-full'),
          hits: session.dummies()[0]?.hitsTaken ?? 0,
          knights: session.knights().map((knight) => ({
            name: knight.name,
            x: Math.round(knight.state.x),
            local: knight.local,
          })),
          names: Array.from(document.querySelectorAll('.nameplate'), (el) => el.textContent),
          banner: document.getElementById('banner').hidden
            ? ''
            : document.getElementById('banner-title').textContent,
          subtitle: document.getElementById('banner-subtitle').textContent,
          status,
        };
      }),
  };
}

/** Note les textes d'impact (« Contre ! », « Parade ! ») qui apparaissent dans la page. */
const trackTexts = (page) =>
  page.evaluate(() => {
    window.__texts = [];
    new MutationObserver((mutations) => {
      for (const mutation of mutations)
        for (const node of mutation.addedNodes)
          if (node instanceof HTMLElement && node.classList.contains('hit-text'))
            window.__texts.push(node.textContent);
    }).observe(document.body, { childList: true, subtree: true });
  });
const textsOf = (page) => page.evaluate(() => window.__texts ?? []);

/** Choisit un nom puis clique sur un bouton du menu, et attend l'arène. */
async function enterFromMenu(page, name, button, code) {
  await page.fill('#menu-name', name);
  if (code) await page.fill('#menu-code', code);
  await page.click(button);
  await page.waitForFunction(() => window.__cendres?.ready === true, null, { timeout: 20000 });
}

const phaseOf = (page) =>
  page.evaluate(() => window.__cendres?.session.status().duel?.phase ?? null);
const waitPhase = (page, phase, timeout = 15000) =>
  page.waitForFunction((p) => window.__cendres?.session.status().duel?.phase === p, phase, {
    timeout,
  });

try {
  // ---------------------------------------------------------------------------- 1. Entraînement
  const solo = await openGame('entraînement');
  const s = helpers(solo);
  await enterFromMenu(solo, 'Solitaire', '#menu-training');
  await solo.evaluate(() => {
    window.__seen = new Set();
    const record = () => {
      const k = window.__cendres?.session.localKnight();
      if (k) window.__seen.add(k.action);
      requestAnimationFrame(record);
    };
    record();
  });
  const kb = solo.keyboard;
  await s.wait(700);
  await s.shot('01-entrainement');

  await kb.down('KeyD');
  await s.wait(550);
  await kb.up('KeyD');
  await s.wait(150);
  await s.tap('KeyJ');
  await s.wait(170);
  await s.tap('KeyJ');
  await s.wait(110);
  await s.shot('02-entrainement-combo');
  await s.wait(500);
  const afterCombo = await s.state();

  const canvas = await solo.locator('canvas').boundingBox();
  await solo.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await s.wait(500);
  const afterClick = await s.state();

  // Parade à la touche L, puis au clic droit, une fois l'attaque au clic finie : on ne pare
  // pas depuis la récupération d'un coup.
  await s.wait(300);
  await s.tap('KeyL');
  await s.wait(40);
  const parryKey = await s.state();
  await s.shot('02b-entrainement-parade');
  await s.wait(600);
  await solo.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, {
    button: 'right',
  });
  await s.wait(40);
  const parryClick = await s.state();
  await s.wait(600);

  await kb.down('KeyS');
  await s.wait(150);
  await s.tap('KeyJ');
  await s.wait(400);
  await kb.up('KeyS');
  await s.wait(300);
  await kb.down('Space');
  await s.wait(90);
  await s.tap('KeyJ');
  await s.wait(150);
  await kb.up('Space');
  await s.wait(800);
  const afterAttacks = await s.state();

  // Roulade à travers le mannequin, demi-tour en pleine course, glissade, saut et dash.
  await kb.down('KeyD');
  await s.wait(80);
  await s.tap('ShiftLeft');
  await s.wait(700);
  await kb.up('KeyD');
  await kb.down('KeyA');
  await s.wait(350);
  await kb.down('KeyS');
  await s.tap('ShiftLeft');
  await s.wait(600);
  await kb.up('KeyS');
  await kb.up('KeyA');
  await s.wait(300);
  await kb.down('KeyW');
  await s.wait(150);
  await s.tap('ShiftLeft');
  await kb.up('KeyW');
  await s.wait(900);

  await s.tap('F1');
  await s.wait(250);
  await s.shot('03-entrainement-debug');
  await s.tap('KeyH');
  await s.wait(600);
  await s.tap('KeyM');
  await s.wait(3000);
  // Jauge des Cendres remplie par le mode debug, puis Embrasement.
  await s.tap('KeyC');
  await s.wait(150);
  const ashFull = await s.state();
  await s.tap('KeyE');
  await s.wait(260);
  await s.shot('03b-entrainement-embrasement');
  const afterBlaze = await s.state();
  await s.wait(900);
  await s.tap('F1');
  await s.wait(200);
  const seen = await solo.evaluate(() => [...window.__seen]);
  const missing = REQUIRED_ACTIONS.filter((action) => !seen.includes(action));
  const trainingEnd = await s.state();
  await s.tap('Escape');
  await s.wait(300);
  const backToMenu = await solo.evaluate(() => !document.getElementById('menu').hidden);
  const shareLine = await solo.evaluate(() => document.getElementById('menu-share').textContent);
  await solo.context().close();

  // ---------------------------------------------------------------------------- 2. Duel
  const host = await openGame('Aldric');
  const h = helpers(host);
  await enterFromMenu(host, 'Aldric', '#menu-quick');
  await h.wait(500);
  const waiting = await h.state();
  await h.shot('04-duel-attente');

  const guest = await openGame('Brune');
  const g = helpers(guest);
  await enterFromMenu(guest, 'Brune', '#menu-quick');
  await trackTexts(host);
  await trackTexts(guest);
  await waitPhase(host, 'countdown');
  await h.wait(900);
  await h.shot('05-duel-compte-a-rebours');
  const countdown = await h.state();

  /** Aldric s'approche à portée d'épée. */
  async function approach() {
    const view = await h.state();
    const me = view.knights.find((k) => k.local);
    const foe = view.knights.find((k) => !k.local);
    if (!me || !foe) return false;
    const gap = foe.x - me.x;
    if (gap > 42) {
      await host.keyboard.down('KeyD');
      await h.wait(Math.min(600, ((gap - 32) / 125) * 1000));
      await host.keyboard.up('KeyD');
      return false;
    }
    return true;
  }

  /** Aldric attaque, Brune lève sa garde juste après : le coup doit être paré. */
  async function parryExchange() {
    await waitPhase(host, 'fighting');
    for (let attempt = 0; attempt < 6; attempt++) {
      while (!(await approach())) await h.wait(50);
      await h.wait(200);
      await host.keyboard.press('KeyJ');
      await g.wait(90);
      await guest.keyboard.press('KeyL');
      await h.wait(160);
      await g.shot('05b-duel-parade');
      await h.wait(700);
      if ((await textsOf(guest)).includes('Parade !')) break;
    }
    return { host: await textsOf(host), guest: await textsOf(guest) };
  }

  /** Aldric lance un seul Embrasement dans le duel, dès que sa jauge est pleine. */
  let blazeUsed = false;

  /** Aldric va au contact et enchaîne les combos, jusqu'à la fin de la manche. */
  async function fightRound(label) {
    await waitPhase(host, 'fighting');
    const deadline = Date.now() + 20000;
    let shotTaken = false;
    while (Date.now() < deadline && (await phaseOf(host)) === 'fighting') {
      if (!(await approach())) continue;
      if (!blazeUsed && (await h.state()).ash >= 100) {
        blazeUsed = true;
        await h.tap('KeyE');
        await h.wait(300);
        await h.shot('07b-duel-embrasement-hote');
        await g.shot('07c-duel-embrasement-invite');
        await h.wait(700);
        continue;
      }
      await h.tap('KeyJ');
      await h.wait(170);
      await h.tap('KeyJ');
      if (!shotTaken) {
        await h.wait(120);
        await h.shot(`06-${label}-hote`);
        await g.shot(`07-${label}-invite`);
        shotTaken = true;
      }
      await h.wait(380);
    }
    await waitPhase(host, 'roundOver', 5000);
    await h.wait(400);
    await h.shot(`08-${label}-ko`);
    return { host: await h.state(), guest: await g.state() };
  }

  const parried = await parryExchange();
  const round1 = await fightRound('manche-1');
  const round2 = await fightRound('manche-2');
  await waitPhase(host, 'matchOver', 8000);
  await h.wait(300);
  const victory = await h.state();
  const guestVictory = await g.state();
  const duelTexts = { host: await textsOf(host), guest: await textsOf(guest) };
  await h.shot('09-duel-victoire');

  await g.tap('Escape');
  await waitPhase(host, 'waiting', 8000);
  await h.wait(300);
  const alone = await h.state();

  const hostSees = (state, name) => state.knights.some((k) => k.name === name);
  const checks = [
    ['entraînement : combo de deux coups', afterCombo.hits >= 2],
    ['entraînement : clic gauche frappe', afterClick.hits > afterCombo.hits],
    ['entraînement : attaque accroupie et aérienne', afterAttacks.hits > afterClick.hits],
    ['entraînement : L lève la garde', parryKey.action === 'parry'],
    ['entraînement : clic droit lève la garde', parryClick.action === 'parry'],
    ['entraînement : jauge pleine affichée', ashFull.ash === 100 && ashFull.ashShown],
    [
      'entraînement : E lance l’Embrasement et vide la jauge',
      afterBlaze.action === 'blaze' && afterBlaze.ash === 0,
    ],
    ['entraînement : toutes les actions vues', missing.length === 0],
    ['entraînement : nom affiché', trainingEnd.names.includes('Solitaire')],
    ['entraînement : Échap ramène au menu', backToMenu],
    ['menu : adresse à partager affichée', /^Depuis un autre PC : http:\/\//.test(shareLine)],
    [
      'duel : seul, on attend un adversaire',
      waiting.banner.startsWith('En attente') && waiting.subtitle.includes('Code du duel'),
    ],
    [
      'duel : le combat rapide réunit les deux joueurs',
      countdown.status.players === 2 && hostSees(countdown, 'Brune'),
    ],
    ['duel : compte à rebours affiché', /^[123]$/.test(countdown.banner)],
    [
      'duel : une parade vue des deux côtés',
      parried.guest.includes('Parade !') && parried.host.includes('Parade !'),
    ],
    [
      'duel : chacun voit les deux noms',
      ['Aldric', 'Brune'].every(
        (n) => round1.host.names.includes(n) && round1.guest.names.includes(n),
      ),
    ],
    [
      'duel : manche 1 gagnée par K.O. par Aldric',
      round1.host.banner === 'K.O.' && round1.host.subtitle === 'Aldric remporte la manche',
    ],
    ['duel : l’invité voit aussi le K.O.', round1.guest.banner === 'K.O.'],
    ['duel : manche 2 gagnée par Aldric', round2.host.subtitle === 'Aldric remporte la manche'],
    [
      'duel : victoire annoncée des deux côtés',
      victory.banner === 'Aldric remporte le duel !' &&
        guestVictory.banner === 'Aldric remporte le duel !',
    ],
    [
      'duel : Embrasement lancé, vu des deux côtés',
      blazeUsed &&
        duelTexts.host.includes('Embrasement !') &&
        duelTexts.guest.includes('Embrasement !'),
    ],
    [
      'duel : manches comptées',
      victory.status.duel.fighters.find((f) => f.name === 'Aldric')?.wins === 2,
    ],
    [
      'duel : départ de l’adversaire, retour en attente',
      alone.status.duel.phase === 'waiting' && alone.knights.length === 1,
    ],
    ['aucune erreur', problems.length === 0],
    ['aucun avertissement de divergence', !warnings.some((w) => /diverg/i.test(w))],
  ];
  const report = {
    url,
    afterCombo,
    afterClick,
    parryKey,
    parryClick,
    ashFull,
    afterBlaze,
    afterAttacks,
    seen,
    missing,
    shareLine,
    waiting,
    countdown,
    parried,
    round1,
    round2,
    victory,
    guestVictory,
    duelTexts,
    alone,
    warnings,
    problems,
    checks,
  };
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  for (const [label, ok] of checks) console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${label}`);
  if (missing.length) console.log(`Actions jamais vues : ${missing.join(', ')}`);
  for (const problem of problems) console.log(`ERREUR ${problem}`);
  for (const warning of warnings) console.log(`avertissement ${warning}`);
  console.log(`Captures et rapport : ${outDir}`);
  if (checks.some(([, ok]) => !ok)) exitCode = 1;
} catch (error) {
  console.error(error);
  for (const problem of problems) console.log(`ERREUR ${problem}`);
  exitCode = 1;
} finally {
  await browser.close();
  await vite.close();
  await gameServer.gracefullyShutdown(false);
}
process.exit(exitCode);
