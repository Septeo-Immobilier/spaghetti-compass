/**
 * Point d'entrée CLI - spaghetti-compass
 */

import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ContextInfo, AnalyzeOptions } from '../types/index';
import { Analyzer } from '../core/analyzer';
import { formatText } from '../output/text';
import { formatJson } from '../output/json';

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
 */
function parseEntry(entry: string): { file: string; functionName?: string } {
  // Format: path/to/file.ts:functionName
  const colonIndex = entry.lastIndexOf(':');
  
  // Vérifier si c'est un chemin Windows (C:\...)
  if (colonIndex > 1 && entry[colonIndex - 1] !== '\\') {
    return {
      file: entry.substring(0, colonIndex),
      functionName: entry.substring(colonIndex + 1),
    };
  }
  
  return { file: entry };
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

      // Options d'analyse
      const analyzeOptions: AnalyzeOptions = {
        context,
        transitive: options.transitive !== false,
        json: options.json,
      };

      // Analyser
      const analyzer = new Analyzer(context);
      const graph = await analyzer.analyze(entryPath, {
        transitive: analyzeOptions.transitive,
        functionName,
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
        console.log(formatText(graph));
      }

      process.exit(EXIT_SUCCESS);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(EXIT_PARSE_ERROR);
    }
  });

// Parser les arguments
program.parse();
