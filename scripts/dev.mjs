// Lance le serveur de jeu et le client ensemble, sorties préfixées. Ctrl+C arrête les deux.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processes = [
  ['serveur', ['run', 'dev', '-w', '@cendres/server']],
  ['client ', ['run', 'dev', '-w', '@cendres/client']],
];
let stopping = false;

const children = processes.map(([label, args]) => {
  const child = spawn(npm, args, { stdio: ['inherit', 'pipe', 'pipe'], env: process.env });
  const prefix = `[${label}] `;
  const forward = (stream, out) =>
    stream.on('data', (chunk) => {
      const lines = chunk
        .toString()
        .split('\n')
        .filter((line) => line.trim().length > 0);
      if (lines.length) out.write(lines.map((line) => prefix + line).join('\n') + '\n');
    });
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (stopping) return;
    stopping = true;
    console.log(`${prefix}arrêté (code ${code}) : arrêt de l'autre processus.`);
    stopAll();
    process.exitCode = code ?? 1;
  });
  return child;
});

function stopAll() {
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    stopAll();
  });
}
