/**
 * Point d'entrée CLI - spaghetti-compass
 */

import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ContextInfo, AnalyzeOptions } from '../types/index.js';
import { Analyzer } from '../core/analyzer.js';
import { formatText } from '../output/text.js';
import { formatJson } from '../output/json.js';
import { TsConfigResolver } from '../core/tsconfig.js';

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_FILE_NOT_FOUND = 1;
const EXIT_CONTEXT_NOT_FOUND = 2;
const EXIT_PARSE_ERROR = 3;
const EXIT_FUNCTION_NOT_FOUND = 4;

// Version depuis package.json
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

/**
 * Parse l'entrée pour extraire fichier et fonction optionnelle
 * Formats supportés:
 *   - path/to/file.ts                     → fichier entier
 *   - path/to/file.ts:functionName        → fonction simple
 *   - path/to/file.ts:ClassName.method    → méthode de classe (format standard)
 *   - path/to/file.ts:ClassName/method    → méthode de classe (format alternatif)
 *   - path/to/file.ts:ClassName:method    → méthode de classe (format alternatif)
 */
function parseEntry(entry: string): { file: string; functionName?: string } {
  // Trouver l'extension du fichier pour savoir où commence la partie fonction
  const extMatch = entry.match(/\.(ts|tsx|js|jsx|mjs|cjs|py|pyi|php)(?::|\/|$)/i);

  if (!extMatch) {
    // Pas d'extension reconnue, traiter comme un chemin simple
    return { file: entry };
  }

  const extEnd = (extMatch.index || 0) + extMatch[0].length - 1;
  const afterExt = entry.substring(extEnd);

  // Si rien après l'extension, c'est juste un fichier
  if (!afterExt || afterExt === '') {
    return { file: entry };
  }

  // Extraire le fichier
  const file = entry.substring(0, extEnd);

  // Parser la partie fonction (après le premier séparateur : ou /)
  const funcPart = afterExt.substring(1);

  if (!funcPart) {
    return { file };
  }

  // Normaliser les différents formats vers ClassName.method
  // Format: ClassName/method ou ClassName:method → ClassName.method
  let functionName = funcPart;

  // Si c'est le format ClassName/method
  if (funcPart.includes('/')) {
    functionName = funcPart.replace('/', '.');
  }
  // Si c'est le format ClassName:method (et pas juste :method)
  else if (funcPart.includes(':')) {
    functionName = funcPart.replace(':', '.');
  }

  return { file, functionName };
}

/**
 * Crée le contexte d'analyse
 */
function createContext(
  contextPath: string,
  include: string[],
  exclude: string[]
): ContextInfo {
  return {
    rootPath: path.resolve(contextPath),
    includePatterns: include.length > 0 ? include : ['**/*.ts', '**/*.js'],
    excludePatterns: exclude.length > 0 ? exclude : ['**/node_modules/**'],
  };
}

/**
 * Programme principal
 */
const program = new Command();

program
  .name('spaghetti-compass')
  .description('Explore and visualize code dependency relations')
  .version(VERSION, '-v, --version', 'Output the version number');

program
  .command('explore')
  .description('Explore dependencies from an entry point')
  .argument('<entry>', 'Entry point (file or file:function)')
  .option('-c, --context <dir>', 'Context directory for internal/external classification', '.')
  .option('-j, --json', 'Output as JSON', false)
  .option('-i, --include <glob...>', 'Include patterns (default: **/*.ts, **/*.js)')
  .option('-e, --exclude <glob...>', 'Exclude patterns (default: **/node_modules/**)')
  .option('--no-transitive', 'Show only direct dependencies')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json (default: auto-discover)')
  .option('-r, --root <path>', 'Project root directory (default: auto-discover from package.json)')
  .option('--no-tsconfig', 'Disable TypeScript alias resolution')
  .option('--hyperlinks', 'Enable clickable hyperlinks in terminal output (OSC 8 format)', false)
  .option('--absolute-paths', 'Use absolute paths instead of relative paths', false)
  .option('--no-links', 'Disable clickable path:line:column format')
  .option('-d, --depth <n>', 'Max depth for recursive function exploration (default: 5)', '5')
  .option('--same-file-only', 'Only explore functions in the same file', false)
  .action(async (entry: string, options) => {
    try {
      // Parser l'entrée
      const { file, functionName } = parseEntry(entry);
      const entryPath = path.resolve(file);

      // Vérifier que le fichier existe
      if (!fs.existsSync(entryPath)) {
        console.error(`Error: File not found: ${entryPath}`);
        process.exit(EXIT_FILE_NOT_FOUND);
      }

      // Vérifier que le contexte existe
      const contextPath = path.resolve(options.context);
      if (!fs.existsSync(contextPath)) {
        console.error(`Error: Context directory not found: ${contextPath}`);
        process.exit(EXIT_CONTEXT_NOT_FOUND);
      }

      if (!fs.statSync(contextPath).isDirectory()) {
        console.error(`Error: Context must be a directory: ${contextPath}`);
        process.exit(EXIT_CONTEXT_NOT_FOUND);
      }

      // Créer le contexte
      const context = createContext(
        contextPath,
        options.include || [],
        options.exclude || []
      );

      // Gérer les options tsconfig
      let tsConfigPath: string | undefined;
      let projectRoot: string | undefined;

      if (options.noTsconfig) {
        // Désactiver la résolution d'alias
        tsConfigPath = undefined;
      } else if (options.tsconfig) {
        // Utiliser le tsconfig spécifié
        const customTsConfig = path.resolve(options.tsconfig);
        if (!fs.existsSync(customTsConfig)) {
          console.error(`Error: TSConfig file not found: ${customTsConfig}`);
          process.exit(EXIT_FILE_NOT_FOUND);
        }
        tsConfigPath = customTsConfig;
      } else {
        // Auto-découverte depuis le fichier d'entrée
        const discoveredTsConfig = TsConfigResolver.findTsConfig(entryPath);
        if (discoveredTsConfig) {
          tsConfigPath = discoveredTsConfig;
        } else {
          console.log('ℹ️  No tsconfig.json found, alias resolution disabled');
        }
      }

      // Gérer l'option --root
      if (options.root) {
        const customRoot = path.resolve(options.root);
        if (!fs.existsSync(customRoot)) {
          console.error(`Error: Root directory not found: ${customRoot}`);
          process.exit(EXIT_CONTEXT_NOT_FOUND);
        }
        if (!fs.statSync(customRoot).isDirectory()) {
          console.error(`Error: Root must be a directory: ${customRoot}`);
          process.exit(EXIT_CONTEXT_NOT_FOUND);
        }
        projectRoot = customRoot;
      } else {
        // Auto-découverte depuis le fichier d'entrée
        const discoveredPackageJson = TsConfigResolver.findPackageJson(entryPath);
        if (discoveredPackageJson) {
          projectRoot = path.dirname(discoveredPackageJson);
        } else if (tsConfigPath) {
          // Fallback sur le dossier du tsconfig
          projectRoot = path.dirname(tsConfigPath);
        }
      }

      // Enrichir le contexte avec tsconfig et projectRoot
      if (tsConfigPath) {
        context.tsConfigPath = tsConfigPath;
      }
      if (projectRoot) {
        context.projectRoot = projectRoot;
      }

      // Options d'analyse
      const analyzeOptions: AnalyzeOptions = {
        context,
        transitive: options.transitive !== false,
        json: options.json,
      };

      // Options de formatage
      const formatOptions = {
        hyperlinks: options.hyperlinks,
        absolutePaths: options.absolutePaths,
        noLinks: options.links === false, // --no-links sets options.links to false
      };

      // Analyser
      const analyzer = new Analyzer(context);
      const maxDepth = parseInt(options.depth, 10) || 5;
      const graph = await analyzer.analyze(entryPath, {
        transitive: analyzeOptions.transitive,
        functionName,
        maxDepth,
        sameFileOnly: options.sameFileOnly,
      });

      // Vérifier si une fonction a été demandée mais non trouvée
      if (functionName && !graph.nodes.some((n) => n.name === functionName && n.type === 'function')) {
        console.error(`Error: Function not found: ${functionName}`);
        process.exit(EXIT_FUNCTION_NOT_FOUND);
      }

      // Vérifier les erreurs de parsing
      if (graph.stats.totalNodes === 0) {
        console.error(`Error: Failed to parse entry file`);
        process.exit(EXIT_PARSE_ERROR);
      }

      // Formater et afficher
      if (options.json) {
        console.log(formatJson(graph));
      } else {
        console.log(formatText(graph, formatOptions));
      }

      process.exit(EXIT_SUCCESS);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(EXIT_PARSE_ERROR);
    }
  });

// Parser les arguments
program.parse();
