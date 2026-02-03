# Feature Specification: Clickable Navigation in Markdown Output

**Feature Branch**: `3-md-clickable-navigation`  
**Created**: 2026-02-02  
**Status**: Draft  
**Input**: User description: "Lorsque je fais ctrl + click sur un item dans le mode md, je voudrais que mon ide (vscode / cursor) ouvre le bon fichier, en étant sur la bonne méthode / fonction."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigation vers un fichier depuis l'output (Priority: P1)

En tant qu'utilisateur, lorsque j'analyse les relations de code avec spaghetti-compass en mode markdown, je veux pouvoir ctrl+click sur n'importe quel chemin de fichier affiché pour que mon IDE (VSCode/Cursor) ouvre directement ce fichier.

**Why this priority**: C'est le cas d'usage principal demandé. Sans cette fonctionnalité de base, les autres ne peuvent pas fonctionner. Cela améliore drastiquement le workflow de navigation dans le code analysé.

**Independent Test**: Peut être testé en exécutant spaghetti-compass avec l'option markdown, puis en ctrl+cliquant sur un chemin de fichier dans le terminal intégré de VSCode/Cursor.

**Acceptance Scenarios**:

1. **Given** j'exécute `spaghetti-compass analyze src/ --format md` dans le terminal VSCode, **When** je ctrl+click sur un chemin de fichier affiché (ex: `src/core/analyzer.ts`), **Then** VSCode ouvre ce fichier dans un nouvel onglet éditeur.

2. **Given** l'output markdown contient plusieurs fichiers listés, **When** je ctrl+click sur n'importe lequel de ces chemins, **Then** le fichier correspondant s'ouvre sans erreur.

3. **Given** le chemin de fichier contient des caractères spéciaux ou espaces, **When** je ctrl+click sur ce chemin, **Then** le fichier s'ouvre correctement.

---

### User Story 2 - Navigation vers une ligne spécifique (Priority: P1)

En tant qu'utilisateur, je veux que le ctrl+click m'emmène directement à la ligne où se trouve l'import ou l'élément analysé, pas seulement au début du fichier.

**Why this priority**: La navigation vers la bonne ligne est essentielle pour l'utilité de la fonctionnalité. Ouvrir un fichier au début sans contexte n'apporte qu'une valeur limitée.

**Independent Test**: Peut être testé en vérifiant que le curseur se positionne à la ligne attendue après le ctrl+click.

**Acceptance Scenarios**:

1. **Given** l'output affiche une relation d'import avec un numéro de ligne (ex: `src/cli/index.ts:15`), **When** je ctrl+click sur cette référence, **Then** VSCode ouvre le fichier ET positionne le curseur à la ligne 15.

2. **Given** une fonction est référencée avec sa position (ex: `src/core/analyzer.ts:42 → analyzeFile()`), **When** je ctrl+click, **Then** l'éditeur s'ouvre avec la ligne 42 visible et le curseur positionné dessus.

---

### User Story 3 - Navigation vers une fonction/méthode spécifique (Priority: P2)

En tant qu'utilisateur, je veux que les noms de fonctions, classes et méthodes soient également cliquables pour naviguer directement vers leur définition.

**Why this priority**: Cette fonctionnalité étend la navigation au-delà des simples fichiers, mais nécessite que les stories P1 soient implémentées d'abord. Elle apporte une valeur ajoutée significative pour l'exploration du code.

**Independent Test**: Peut être testé en vérifiant que le clic sur un nom de fonction ouvre le fichier à la ligne de définition de cette fonction.

**Acceptance Scenarios**:

1. **Given** l'output affiche une référence à une fonction `analyzeFile`, **When** je ctrl+click sur ce nom de fonction, **Then** VSCode ouvre le fichier contenant cette fonction et positionne le curseur sur sa définition.

2. **Given** l'output montre une classe `GraphBuilder` avec ses méthodes, **When** je ctrl+click sur le nom de la classe, **Then** VSCode ouvre le fichier à la ligne de déclaration de la classe.

---

### User Story 4 - Compatibilité multi-terminal (Priority: P3)

En tant qu'utilisateur, je veux que la navigation fonctionne aussi bien dans le terminal intégré de VSCode/Cursor que dans un terminal externe où j'utilise la commande.

**Why this priority**: La majorité des utilisateurs utilisent le terminal intégré, mais supporter les terminaux externes augmente l'accessibilité. C'est une amélioration "nice to have".

**Independent Test**: Peut être testé en exécutant la commande dans différents contextes de terminal.

**Acceptance Scenarios**:

1. **Given** j'exécute spaghetti-compass dans le terminal intégré VSCode, **When** je ctrl+click sur un lien, **Then** le fichier s'ouvre dans VSCode.

2. **Given** j'exécute spaghetti-compass dans un terminal externe (bash, PowerShell, iTerm, Windows Terminal), **When** l'output est généré, **Then** les chemins au format `chemin:ligne:colonne` sont reconnus comme liens cliquables par le terminal.

---

### Edge Cases

- **Fichier inexistant** : Best effort — le lien est affiché normalement. Si le fichier n'existe plus, le terminal/IDE affichera une erreur standard.
- **Chemins relatifs vs absolus** : Par défaut chemins relatifs depuis le cwd. Si l'utilisateur exécute depuis un autre répertoire, il peut utiliser `--absolute-paths` pour garantir le fonctionnement.
- **Fichiers hors workspace** : Les fichiers externes (node_modules, packages) affichent `package@version:chemin/interne` au lieu du chemin absolu. Le lien reste cliquable si le fichier est accessible.
- **Lignes modifiées** : Best effort — le lien pointe vers la ligne enregistrée lors de l'analyse. Si le contenu a changé, l'utilisateur navigue quand même vers cette ligne.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT formater les chemins de fichiers dans l'output markdown de manière à ce qu'ils soient reconnus comme cliquables par le terminal VSCode/Cursor.

- **FR-002**: Le système DOIT inclure le numéro de ligne dans le format du chemin pour permettre la navigation directe (format `chemin:ligne`).

- **FR-003**: Le système DOIT supporter le format de lien reconnu nativement par les terminaux VSCode/Cursor (format `chemin:ligne:colonne`).

- **FR-004**: Le système DOIT utiliser des chemins qui fonctionnent depuis le répertoire courant d'exécution de la commande.

- **FR-005**: Le système DOIT préserver la lisibilité de l'output markdown tout en ajoutant les informations de navigation.

- **FR-006**: Le système DOIT supporter les options CLI : `--absolute-paths` (chemins absolus) et `--no-links` (désactiver la navigation cliquable).

- **FR-007**: Les chemins DOIVENT être correctement échappés pour gérer les espaces et caractères spéciaux.

- **FR-008**: Le système DOIT détecter la racine du projet via le `package.json` le plus proche et traiter différemment les fichiers internes vs externes.

- **FR-009**: Pour les fichiers externes (node_modules, packages), le système DOIT afficher le format `package@version:chemin/relatif` tout en préservant la navigation cliquable.

### Key Entities

- **FileReference**: Représente une référence à un fichier avec son chemin, numéro de ligne optionnel, et numéro de colonne optionnel.

- **SymbolReference**: Représente une référence à un symbole (fonction, classe, méthode) avec son fichier source et sa position de définition.

- **ClickableLink**: Format de sortie d'une référence transformée en lien cliquable compatible terminal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% des chemins de fichiers dans l'output markdown doivent être cliquables dans le terminal intégré VSCode/Cursor.

- **SC-002**: Le ctrl+click sur un chemin avec numéro de ligne doit ouvrir le fichier ET positionner le curseur sur la bonne ligne dans 100% des cas (fichier existant et non modifié).

- **SC-003**: Le temps d'ouverture du fichier après ctrl+click doit être perçu comme instantané (< 500ms) par l'utilisateur.

- **SC-004**: L'output markdown doit rester lisible et compréhensible même sans la fonctionnalité de clic (dégradation gracieuse si copié/collé ailleurs).

- **SC-005**: La fonctionnalité ne doit pas augmenter le temps de génération de l'output de plus de 10%.

## Clarifications

### Session 2026-02-02

- **Q**: Comment distinguer les fichiers internes au projet des fichiers externes (node_modules, packages) ? → **A**: Le projet est délimité par le `package.json` le plus proche de la racine. Les fichiers externes affichent le nom du package + chemin relatif interne au package.
- **Q**: Quel format de lien utiliser et pour quels environnements ? → **A**: Format unique `chemin:ligne:colonne` — standard universel fonctionnant dans bash, PowerShell, et terminaux VSCode/Cursor sans détection de contexte.
- **Q**: Chemins relatifs ou absolus dans l'output ? → **A**: Chemins relatifs par défaut (depuis le cwd), avec option `--absolute-paths` disponible pour forcer les chemins absolus.
- **Q**: Comportement pour les fichiers inexistants ou lignes modifiées ? → **A**: Best effort — afficher tous les liens normalement, l'utilisateur gère si le fichier/ligne n'existe plus.
- **Q**: Quelle ligne afficher pour les imports ? → **A**: La ligne de **définition** du symbole importé dans le fichier cible (pas la ligne de l'import dans le fichier source). Cela permet de naviguer directement vers la définition.
