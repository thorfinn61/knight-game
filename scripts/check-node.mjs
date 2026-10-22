// Vérifie la version de Node avant de lancer le jeu : le serveur exécute son TypeScript
// directement, ce que seul Node 24 sait faire. Sans cette vérification, il plante en silence.
const REQUIRED_MAJOR = 24;
const major = Number(process.versions.node.split('.')[0]);

if (major < REQUIRED_MAJOR) {
  console.error(
    `\n  L'Ordre des Cendres demande Node ${REQUIRED_MAJOR} : tu utilises Node ${process.versions.node}.\n` +
      `  Lance d'abord « nvm use » dans le dossier du projet, puis recommence.\n`,
  );
  process.exit(1);
}
