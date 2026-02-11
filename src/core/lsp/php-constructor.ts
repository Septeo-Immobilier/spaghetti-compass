/**
 * Helper partagé pour trouver la ligne du constructeur d'une classe PHP.
 * Utilisé par PhpLspProvider et Analyzer (fallback sans LSP).
 */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Trouve la ligne du constructeur d'une classe PHP dans le contenu d'un fichier.
 * Cherche __construct ou une méthode homonyme de la classe (style PHP 4).
 * @param content Contenu du fichier PHP
 * @param className Nom de la classe
 * @returns Ligne 1-indexed ou null si pas de constructeur
 */
export function findPhpConstructorLine(content: string, className: string): number | null {
  const lines = content.split('\n');
  const escapedName = escapeRegex(className);

  const classPattern = new RegExp(
    `^\\s*(?:abstract\\s+)?(?:final\\s+)?(?:readonly\\s+)?class\\s+${escapedName}\\b`
  );
  const constructorPatterns = [
    new RegExp(
      `^\\s*(?:public|private|protected)\\s+(?:static\\s+)?function\\s+__construct\\s*\\(`
    ),
    new RegExp(
      `^\\s*(?:public|private|protected)\\s+(?:static\\s+)?function\\s+${escapedName}\\s*\\(`
    ),
  ];

  let classStartIndex = -1;
  let braceDepth = 0;
  let insideClass = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (classStartIndex < 0 && classPattern.test(line)) {
      classStartIndex = i;
      const openBraces = (line.match(/\{/g) ?? []).length;
      const closeBraces = (line.match(/\}/g) ?? []).length;
      braceDepth = openBraces - closeBraces;
      insideClass = braceDepth > 0;
      continue;
    }

    if (classStartIndex >= 0 && !insideClass) {
      const openBraces = (line.match(/\{/g) ?? []).length;
      const closeBraces = (line.match(/\}/g) ?? []).length;
      braceDepth += openBraces - closeBraces;
      insideClass = braceDepth > 0;
    }

    if (classStartIndex >= 0 && insideClass) {
      for (const pattern of constructorPatterns) {
        if (pattern.test(line)) {
          return i + 1; // 1-indexed
        }
      }
      const openBraces = (line.match(/\{/g) ?? []).length;
      const closeBraces = (line.match(/\}/g) ?? []).length;
      braceDepth += openBraces - closeBraces;
      if (braceDepth <= 0) {
        break;
      }
    }
  }

  return null;
}
