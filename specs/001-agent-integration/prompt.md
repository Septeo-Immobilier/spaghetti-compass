# Requête Originale

Pour transformer ce CLI en commande VSCode, il y a plusieurs approches possibles :

## Option 1 : Extension VSCode (recommandée)

C'est la solution la plus intégrée. Tu créerais une extension VSCode qui :

1. **Enregistre des commandes** dans la palette de commandes (`Ctrl+Shift+P`)
2. **Appelle le CLI** en interne ou intègre directement le code TypeScript
3. **Affiche les résultats** dans un panneau dédié (Webview, TreeView, ou Output Channel)

**Structure typique** :
```
vscode-spaghetti-compass/
├── package.json          # Manifest de l'extension (contributes.commands)
├── src/
│   └── extension.ts      # Point d'entrée, activation, commandes
└── ...
```

**Avantages** :
- Intégration native (menus contextuels, raccourcis clavier)
- Accès direct à l'API VSCode (ouvrir fichiers, navigation, TreeView)
- Pas besoin d'installer le CLI séparément

---

## Option 2 : Task VSCode

Plus simple, tu définis une tâche dans `.vscode/tasks.json` :

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Explore dependencies",
      "type": "shell",
      "command": "npx spaghetti-compass explore ${file}",
      "problemMatcher": []
    }
  ]
}
```

**Avantages** : Rapide à mettre en place
**Inconvénients** : Moins intégré, pas de UI riche

---

## Option 3 : Extension avec Webview (pour le graphe)

Pour afficher le graphe Mermaid directement dans VSCode :

1. Créer une extension avec une **Webview**
2. Générer le HTML Mermaid et l'afficher dans un panneau
3. Les clics sur les nœuds utilisent l'API `vscode.open` pour naviguer

---

## Ce qu'il faudrait faire concrètement

Pour l'**Option 1** (extension complète) :

1. **Créer un nouveau projet** avec `yo code` (générateur Yeoman)
2. **Réutiliser le code existant** : `src/core/analyzer.ts`, `src/parser/`, etc.
3. **Ajouter des commandes** :
   - `spaghetti-compass.exploreFile` - Explorer le fichier actif
   - `spaghetti-compass.exploreFunction` - Explorer une fonction
   - `spaghetti-compass.showGraph` - Afficher le graphe dans une Webview
4. **Créer une TreeView** pour afficher l'arbre de dépendances
5. **Publier sur le Marketplace** (optionnel)

---

**Mon objectif principal est qu'un agent puisse utiliser l'outil, en particulier Cursor. Quelle est la meilleure approche pour cela ? Peut-être juste une publication sur npm ?**
