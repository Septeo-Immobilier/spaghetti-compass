/**
 * Cursor workflow: file artifacts (relativePath + content) to write.
 */

export type FileArtifact = { relativePath: string; content: string };

const RULE_SPAGHETTI_COMPASS = `# Exploration de code avec Spaghetti Compass

## Quand utiliser cette règle

Utilise le CLI **spaghetti-compass** pour toute tâche d'**exploration de dépendances** ou de **refactoring** sur du code complexe (TypeScript/JavaScript, Python, PHP) :

- Avant de modifier un fichier : voir qui en dépend et ce qu'il importe/appelle
- Refactoring (renommer, déplacer, extraire) : identifier l'impact et les cycles
- Comprendre un module : graphe d'appels à partir d'une fonction ou d'un fichier
- Vérifier l'absence de dépendances circulaires après un changement

## Pourquoi Spaghetti Compass (LSP) plutôt que grep ?

| Critère | Grep / recherche texte | Spaghetti Compass (LSP + parsers) |
|--------|------------------------|-----------------------------------|
| **Sémantique** | Recherche de chaînes → faux positifs (commentaires, strings, autres symboles) | Résolution de définitions et d'appels (go to definition, résolution d'imports) |
| **Graphe** | Pas de vue dépendances/appels | Graphe fichiers + fonctions, transitif, avec profondeur |
| **Cycles** | Non détectés | Détection et liste des cycles |
| **Contexte** | Aucun | Classification internal / external / third-party |
| **Fonctions** | Difficile (nom seul) | Point d'entrée fichier **ou** \`fichier:fonction\` / \`fichier:Classe.méthode\` |

En résumé : pour le refactoring et l'exploration, privilégier **spaghetti-compass** pour une vue fiable des dépendances et du graphe d'appels ; utiliser grep pour des recherches textuelles ciblées (nom de variable, message, etc.).

## Exécution

**Priorité** : si **spaghetti-compass** est installé sur la machine hôte (global ou \`npx\`), l’utiliser directement. Le projet peut avoir un **LSP** (TypeScript, Intelephense, Pyright) déjà configuré au niveau du projet, ce qui améliore la résolution des définitions et des appels. **Sinon** (CLI non disponible ou règle projet imposant Docker), utiliser Docker.

**Sur l’hôte** (recommandé si le CLI est installé) :

\`\`\`bash
spaghetti-compass explore <entry> [options]
# ou
npx spaghetti-compass explore <entry> [options]
\`\`\`

**Fallback Docker** (si le CLI n’est pas installé ou si la règle docker-execution s’applique) :

\`\`\`bash
docker run --rm --user $(id -u):$(id -g) -v "$(pwd)":/app -w /app node:20 npx spaghetti-compass explore <entry> [options]
\`\`\`

Depuis la racine du projet, \`<entry>\` en chemin relatif au répertoire courant (ex. \`src/core/analyzer.ts\`).

## Commandes utiles pour l'agent

\`\`\`bash
# Sur l'hôte (avec LSP du projet si présent)
spaghetti-compass explore src/main.ts -c src/ --json
# Fallback Docker
docker run --rm --user $(id -u):$(id -g) -v "$(pwd)":/app -w /app node:20 npx spaghetti-compass explore src/main.ts -c src/ --json

# Explorer une fonction (graphe d'appels)
spaghetti-compass explore src/services/auth.ts:login -c src/ --json

# Dépendances directes uniquement
spaghetti-compass explore src/main.ts -c src/ --no-transitive --json

# Vérifier les cycles
spaghetti-compass explore src/index.ts -c src/ --json
# Puis : jq '.stats.circularDependencies' sur la sortie
\`\`\`

## Format d'entrée \`<entry>\`

- \`chemin/vers/fichier.ts\` — exploration au niveau fichier
- \`chemin/vers/fichier.ts:nomFonction\` — fonction ou méthode (ex. \`auth.ts:login\`, \`service.ts:UserService.getUser\`)

Langages supportés : \`.ts\`, \`.tsx\`, \`.js\`, \`.jsx\`, \`.mjs\`, \`.cjs\`, \`.py\`, \`.pyi\`, \`.php\`.

## Exploitation du JSON

- **Fichiers impactés** : \`nodes\` (type \`file\` ou \`function\`) + \`edges\`
- **Cycles** : \`stats.circularDependencies\`
- **Périmètre** : \`context.rootPath\`, \`context.includePatterns\` / \`excludePatterns\`
- **Entrée** : \`entryPoint\`

Utiliser \`-c\` / \`--context\` pour définir le répertoire « interne » (ex. \`src/\`) pour une classification cohérente.
`;

const COMMAND_SPAGHETTI_COMPASS_EXPLORE = `---
description: Explorer les dépendances d'un fichier ou d'une fonction avec spaghetti-compass avant refactoring ou analyse.
globs:
alwaysApply: false
---

# /spaghetti-compass-explore

## Entrée utilisateur

\`\`\`text
$ARGUMENTS
\`\`\`

Interpréter \`$ARGUMENTS\` comme point d'entrée d'exploration (fichier ou \`fichier:fonction\`). Si vide, demander à l'utilisateur quel fichier ou fonction explorer.

## Objectif

Produire une analyse des **dépendances** (imports + graphe d'appels) en utilisant le CLI **spaghetti-compass**, puis résumer les fichiers impactés, les dépendances circulaires éventuelles et les recommandations pour un refactoring sûr.

## Règles

1. **Exécution** : Si **spaghetti-compass** est installé sur l'hôte, l'utiliser en priorité (\`spaghetti-compass\` ou \`npx spaghetti-compass\`) — le LSP du projet (tsconfig, dépendances) améliore la résolution. Sinon, ou si la règle \`docker-execution\` impose Docker, utiliser la commande Docker.
2. **Commande type** (hôte) : \`spaghetti-compass explore <entry> -c src/ --json\` ; (fallback Docker) : \`docker run --rm --user $(id -u):$(id -g) -v "$(pwd)":/app -w /app node:20 npx spaghetti-compass explore <entry> -c src/ --json\`. Adapter \`<entry>\` d'après \`$ARGUMENTS\` (ex. \`src/main.ts\` ou \`src/auth.ts:login\`) et \`-c\` au contexte du projet (souvent \`src/\` ou \`.\`).
3. **Sortie** : Utiliser \`--json\` pour parser le résultat ; résumer nodes, edges et \`stats.circularDependencies\` de façon lisible.
4. Si le fichier ou la fonction n'existe pas, proposer un chemin valide ou lister les fichiers pertinents.

## Exemple de livrable

- Liste des fichiers/fonctions dépendants (depuis le graphe)
- Présence ou non de cycles
- Suggestion courte : "Fichiers à retester / à modifier si vous changez X"
`;

const SKILL_SPAGHETTI_COMPASS_EXPLORATION = `---
name: spaghetti-compass-exploration
description: >
  Explorer les dépendances et le graphe d'appels avec le CLI spaghetti-compass
  avant un refactoring ou pour comprendre du code complexe. À utiliser quand
  l'utilisateur demande à "refactorer", "explorer les dépendances", "voir qui
  appelle", "impact d'un changement", ou "dépendances circulaires".
---

# Exploration de code avec Spaghetti Compass

## Quand appliquer ce skill

- L'utilisateur demande un **refactoring** (renommer, déplacer, extraire du code)
- Il veut **explorer les dépendances** d'un fichier ou d'une fonction
- Il demande **qui appelle** une fonction / quels fichiers sont impactés
- Il veut vérifier les **dépendances circulaires**
- Le code cible est **complexe** (multi-fichiers, TS/JS, Python, PHP)

## Pourquoi utiliser le CLI plutôt que grep ?

Spaghetti-compass s'appuie sur des **LSP** (TypeScript, Intelephense, Pyright) et des parsers pour :

1. **Résolution sémantique** : définitions et appels réels, pas seulement le texte (évite commentaires, strings, faux positifs)
2. **Graphe de dépendances** : imports + appels de fonctions, avec transitivité et profondeur
3. **Détection de cycles** : \`stats.circularDependencies\` dans le JSON
4. **Classification** : internal / external / third-party selon un contexte \`--context\`
5. **Niveau fonction** : entrée \`fichier:Classe.méthode\` ou \`fichier:fonction\` pour le graphe d'appels

Grep reste adapté pour des recherches textuelles (nom de variable, message d'erreur, etc.), pas pour "qui dépend de ce fichier" ou "quelle méthode appelle cette autre".

## Ordre des actions recommandé

1. **Identifier le point d'entrée** : fichier (et optionnellement fonction/méthode) concerné par la tâche
2. **Lancer une exploration** avec spaghetti-compass : sur l'hôte si le CLI est installé (le LSP du projet améliore la résolution), sinon via Docker
3. **Parser le JSON** (ou lire la sortie texte) pour lister les fichiers impactés, les cycles, les bords du graphe
4. **Proposer le refactoring** ou la réponse en s'appuyant sur ce graphe

## Exécution

**Priorité hôte** : si **spaghetti-compass** est installé (global ou \`npx\`), l'utiliser sur la machine hôte. Le **LSP** déjà présent au niveau du projet (TypeScript, Intelephense, Pyright, etc.) est alors utilisé pour une meilleure résolution. **Sinon** (CLI absent ou règle docker-execution), utiliser Docker.

**Sur l'hôte** :
\`\`\`bash
spaghetti-compass explore <entry> -c <context> [options]
# ou npx spaghetti-compass explore ...
\`\`\`

**Fallback Docker** :
\`\`\`bash
docker run --rm --user $(id -u):$(id -g) -v "$(pwd)":/app -w /app node:20 npx spaghetti-compass explore <entry> -c <context> [options]
\`\`\`

- \`<entry>\` : chemin relatif au repo, ex. \`src/core/analyzer.ts\` ou \`src/services/auth.ts:login\`
- \`<context>\` : répertoire "interne" (ex. \`src/\` ou \`.\`) pour la classification des dépendances

## Commandes types

\`\`\`bash
# Sur l'hôte (recommandé si CLI installé + LSP du projet)
spaghetti-compass explore src/main.ts -c src/ --json
spaghetti-compass explore src/services/auth.ts:login -c src/ --json
spaghetti-compass explore src/main.ts -c src/ --no-transitive --json
spaghetti-compass explore src/index.ts -c src/ --json
# Puis : jq '.stats.circularDependencies'

# Fallback Docker (si CLI non installé ou règle docker-execution)
docker run --rm --user $(id -u):$(id -g) -v "$(pwd)":/app -w /app node:20 npx spaghetti-compass explore src/main.ts -c src/ --json
\`\`\`

## Format d'entrée

- Fichier seul : \`path/to/file.ts\`
- Fonction / méthode : \`path/to/file.ts:nomFonction\` ou \`path/to/file.ts:ClassName.method\`

Extensions supportées : \`.ts\`, \`.tsx\`, \`.js\`, \`.jsx\`, \`.mjs\`, \`.cjs\`, \`.py\`, \`.pyi\`, \`.php\`.

## Schéma JSON utile

- \`nodes\` : fichiers, fonctions, modules externes (id, type, name, path, location)
- \`edges\` : relations (from, to, type: import-static | import-dynamic | call, resolved)
- \`stats.circularDependencies\` : tableau de cycles (listes de chemins)
- \`entryPoint\` : point d'entrée de l'analyse

Utiliser \`--json\` pour toute exploitation programmatique par l'agent.
`;

export function getCursorArtifacts(): FileArtifact[] {
  return [
    { relativePath: '.cursor/rules/spaghetti-compass-exploration.md', content: RULE_SPAGHETTI_COMPASS },
    { relativePath: '.cursor/commands/spaghetti-compass-explore.md', content: COMMAND_SPAGHETTI_COMPASS_EXPLORE },
    { relativePath: '.agents/skills/spaghetti-compass-exploration/SKILL.md', content: SKILL_SPAGHETTI_COMPASS_EXPLORATION },
  ];
}
