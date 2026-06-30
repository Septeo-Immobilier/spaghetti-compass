/**
 * Skill template content for spaghetti-compass exploration.
 */

export const SKILL_DIR_NAME = 'spaghetti-compass-exploration';

export const SKILL_CONTENT = `---
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
