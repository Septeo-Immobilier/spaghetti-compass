# Quickstart: PHP Links Target Definition

## Scénarios de Validation

### Scénario 1: Projet PSR-4 Simple

**Setup**:
```bash
# Créer un projet PHP minimal avec PSR-4
mkdir -p /tmp/test-php-psr4/src/Models
cd /tmp/test-php-psr4

# composer.json
cat > composer.json << 'EOF'
{
  "autoload": {
    "psr-4": {
      "App\\": "src/"
    }
  }
}
EOF

# src/Models/User.php
cat > src/Models/User.php << 'EOF'
<?php
namespace App\Models;

class User {
    public function getName(): string {
        return 'John';
    }
}
EOF

# src/Services/UserService.php
mkdir -p src/Services
cat > src/Services/UserService.php << 'EOF'
<?php
namespace App\Services;

use App\Models\User;

class UserService {
    public function getUser(): User {
        return new User();
    }
}
EOF
```

**Test**:
```bash
spaghetti-compass explore src/Services/UserService.php
```

**Expected Output**:
```
═════════════════════════════════════════════════════════════════
📍 Entry Point: src/Services/UserService.php:1:1
📁 Context: /tmp/test-php-psr4
📊 Stats: 1 internal, 0 external, 0 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

src/Services/UserService.php:1:1
└── 📦 INTERNAL
    └── User: src/Models/User.php:5:1
```

**Critères de Succès**:
- [ ] Le lien vers `User` pointe vers `src/Models/User.php` ligne 5 (pas ligne 5 du use statement)
- [ ] L'import est classifié comme "internal" (pas "unresolved")
- [ ] Le chemin affiché est relatif au projet

---

### Scénario 2: Projet avec Vendor (Third-Party)

**Setup**:
```bash
# Ajouter une dépendance Symfony
cat > src/Controllers/HomeController.php << 'EOF'
<?php
namespace App\Controllers;

use Symfony\Component\HttpFoundation\Response;

class HomeController {
    public function index(): Response {
        return new Response('Hello');
    }
}
EOF
```

**Test**:
```bash
spaghetti-compass explore src/Controllers/HomeController.php
```

**Expected Output**:
```
└── 📦 THIRD-PARTY
    └── Response: Symfony\Component\HttpFoundation\Response
```

**Critères de Succès**:
- [ ] `Response` est classifié comme "third-party" (pas "unresolved")
- [ ] Le namespace complet est affiché

---

### Scénario 3: Namespace avec Alias

**Setup**:
```bash
cat > src/Services/AliasService.php << 'EOF'
<?php
namespace App\Services;

use App\Models\User as UserModel;

class AliasService {
    public function getUser(): UserModel {
        return new UserModel();
    }
}
EOF
```

**Test**:
```bash
spaghetti-compass explore src/Services/AliasService.php
```

**Expected Output**:
```
└── 📦 INTERNAL
    └── UserModel (alias of User): src/Models/User.php:5:1
```

**Critères de Succès**:
- [ ] L'alias `UserModel` est reconnu
- [ ] Le lien pointe vers la définition de `User`

---

### Scénario 4: Mode Dégradé (Sans LSP)

**Test**:
```bash
# Désactiver Intelephense temporairement
npm uninstall -g intelephense 2>/dev/null || true
spaghetti-compass explore src/Services/UserService.php
```

**Expected Output**:
```
└── 📦 INTERNAL (via composer.json)
    └── User: src/Models/User.php
```

**Critères de Succès**:
- [ ] La résolution fonctionne via `composer.json` même sans LSP
- [ ] Pas d'erreur fatale

---

### Scénario 5: Analyse de Fonction avec Appels

**Test**:
```bash
spaghetti-compass explore src/Services/UserService.php:UserService:getUser
```

**Expected Output**:
```
═════════════════════════════════════════════════════════════════
📍 Function: UserService.getUser
📁 File: src/Services/UserService.php:8:1
📊 Stats: 0 internal calls, 1 external calls
═════════════════════════════════════════════════════════════════

🔹 UserService.getUser
   src/Services/UserService.php:8:1 (UserService.getUser)

├── 📦 EXTERNAL (flat)
│   └── User: src/Models/User.php:5:1
```

**Critères de Succès**:
- [ ] L'appel `new User()` est détecté
- [ ] Le lien pointe vers la ligne de définition de la classe `User`

## Commandes de Debug

```bash
# Vérifier que composer.json est détecté
spaghetti-compass explore --debug src/Services/UserService.php 2>&1 | grep -i composer

# Vérifier la résolution LSP
spaghetti-compass explore --debug src/Services/UserService.php 2>&1 | grep -i intelephense
```
