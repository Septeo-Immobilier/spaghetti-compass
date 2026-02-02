# Requirements Checklist - TSConfig Path Aliases

**Feature**: 2-tsconfig-path-aliases  
**Date**: 2026-02-02

## Critères de Qualité de la Spec

### Complétude
- [x] Toutes les user stories ont des acceptance scenarios
- [x] Les edge cases sont identifiés et documentés
- [x] Les requirements fonctionnels sont testables
- [x] Les critères de succès sont mesurables

### Clarté
- [x] Pas d'ambiguïté dans les requirements
- [x] Terminologie cohérente (alias, paths, tsconfig)
- [x] Distinction claire entre alias projet et packages npm scoped

### Faisabilité
- [x] Scope réaliste pour une itération
- [x] Dépendances techniques identifiées (parser JSON, fs)
- [x] Pas de blockers techniques identifiés

## Points d'Attention

### Différenciation alias vs packages npm scoped
Le système doit distinguer :
- `@/core/service` → alias projet (défini dans paths)
- `@nestjs/common` → package npm scoped (dans node_modules)

**Règle de priorité** : Si un pattern match dans `paths`, c'est un alias. Sinon, c'est un package npm.

### Performance
La lecture et le parsing du tsconfig doivent être mis en cache pour éviter de relire le fichier à chaque import.

### Héritage tsconfig
L'ordre de résolution pour `extends` :
1. Lire le tsconfig demandé
2. Si `extends` est présent, résoudre récursivement
3. Merger les paths (les valeurs enfant écrasent les parents)

## Prêt pour Implémentation

- [x] Spec validée
- [ ] Questions clarifiées (aucune question en suspens)
- [ ] Plan d'implémentation créé

## Prochaine Étape

Exécuter `/speckit.plan` pour générer le plan d'implémentation technique.
