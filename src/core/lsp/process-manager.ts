/**
 * LspProcessManager - Gestionnaire de processus LSP externes
 * Gère le spawn, la communication JSON-RPC, et le cycle de vie
 */

import { spawn, type ChildProcess } from 'node:child_process';
import {
  createRequest,
  createNotification,
  encodeMessage,
  decodeMessage,
  pathToUri,
  type InitializeParams,
  type InitializeResult,
  type DidOpenTextDocumentParams,
  type TextDocumentPositionParams,
  type LspLocation,
  type TextDocumentItem,
} from './json-rpc.js';

/**
 * Configuration du process manager
 */
export interface ProcessManagerConfig {
  /** Timeout pour les requêtes (ms) - default: 5000 */
  timeout?: number;
  /** Activer les logs debug */
  debug?: boolean;
}

/**
 * État d'un processus LSP
 */
interface LspProcess {
  process: ChildProcess;
  initialized: boolean;
  nextId: number;
  pending: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
  buffer: string;
}

/**
 * Gestionnaire de processus LSP externes
 */
export class LspProcessManager {
  /** Processus actifs par clé (ex: "php:/path/to/project") */
  private processes: Map<string, LspProcess> = new Map();
  /** Configuration */
  private config: ProcessManagerConfig;

  constructor(config: ProcessManagerConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 5000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Démarre un processus LSP ou retourne celui existant
   */
  async getOrCreateProcess(
    key: string,
    command: string,
    args: string[],
    projectRoot: string
  ): Promise<LspProcess | null> {
    // Vérifier si le processus existe déjà
    const existing = this.processes.get(key);
    if (existing && !existing.process.killed) {
      return existing;
    }

    // Démarrer un nouveau processus
    try {
      const lspProcess = await this.startProcess(key, command, args, projectRoot);
      return lspProcess;
    } catch (error) {
      if (this.config.debug) {
        console.error(`[LSP] Failed to start ${command}:`, error);
      }
      return null;
    }
  }

  /**
   * Démarre un nouveau processus LSP
   */
  private async startProcess(
    key: string,
    command: string,
    args: string[],
    projectRoot: string
  ): Promise<LspProcess> {
    if (this.config.debug) {
      console.log(`[LSP] Starting ${command} ${args.join(' ')}`);
    }

    const process = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lspProcess: LspProcess = {
      process,
      initialized: false,
      nextId: 1,
      pending: new Map(),
      buffer: '',
    };

    // Gérer les données reçues
    process.stdout?.on('data', (data: Buffer) => {
      this.handleData(lspProcess, data.toString());
    });

    // Gérer les erreurs
    process.stderr?.on('data', (data: Buffer) => {
      if (this.config.debug) {
        console.error(`[LSP] stderr: ${data.toString()}`);
      }
    });

    // Gérer la fermeture
    process.on('close', (code) => {
      if (this.config.debug) {
        console.log(`[LSP] Process exited with code ${code}`);
      }
      this.processes.delete(key);
      // Rejeter toutes les requêtes en attente
      for (const [, pending] of lspProcess.pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`LSP process exited with code ${code}`));
      }
      lspProcess.pending.clear();
    });

    // Enregistrer le processus
    this.processes.set(key, lspProcess);

    // Initialiser le LSP
    await this.initialize(lspProcess, projectRoot);

    return lspProcess;
  }

  /**
   * Gère les données reçues du processus
   */
  private handleData(lspProcess: LspProcess, data: string): void {
    lspProcess.buffer += data;

    // Essayer de décoder les messages
    while (true) {
      const { message, remaining } = decodeMessage(lspProcess.buffer);
      if (!message) {
        break;
      }

      lspProcess.buffer = remaining;

      // Traiter la réponse
      if ('id' in message && message.id !== undefined) {
        const pending = lspProcess.pending.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          lspProcess.pending.delete(message.id);

          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message.result);
          }
        }
      }

      if (this.config.debug) {
        console.log(`[LSP] ← Response:`, JSON.stringify(message).substring(0, 200));
      }
    }
  }

  /**
   * Envoie une requête et attend la réponse
   */
  async request<T>(lspProcess: LspProcess, method: string, params?: unknown): Promise<T> {
    const id = lspProcess.nextId++;
    const request = createRequest(id, method, params);

    if (this.config.debug) {
      console.log(`[LSP] → Request ${method} (id=${id})`);
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        lspProcess.pending.delete(id);
        reject(new Error(`LSP request timeout: ${method}`));
      }, this.config.timeout);

      lspProcess.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      const message = encodeMessage(request);
      lspProcess.process.stdin?.write(message);
    });
  }

  /**
   * Envoie une notification (pas de réponse attendue)
   */
  notify(lspProcess: LspProcess, method: string, params?: unknown): void {
    const notification = createNotification(method, params);

    if (this.config.debug) {
      console.log(`[LSP] → Notification ${method}`);
    }

    const message = encodeMessage(notification);
    lspProcess.process.stdin?.write(message);
  }

  /**
   * Initialise le LSP
   */
  private async initialize(lspProcess: LspProcess, projectRoot: string): Promise<void> {
    const params: InitializeParams = {
      processId: process.pid,
      rootUri: pathToUri(projectRoot),
      capabilities: {
        textDocument: {
          definition: {
            dynamicRegistration: false,
          },
        },
      },
    };

    await this.request<InitializeResult>(lspProcess, 'initialize', params);

    // Envoyer initialized notification
    this.notify(lspProcess, 'initialized', {});

    lspProcess.initialized = true;

    if (this.config.debug) {
      console.log('[LSP] Initialized successfully');
    }
  }

  /**
   * Ouvre un document dans le LSP
   */
  didOpen(lspProcess: LspProcess, filePath: string, content: string, languageId: string): void {
    const textDocument: TextDocumentItem = {
      uri: pathToUri(filePath),
      languageId,
      version: 1,
      text: content,
    };

    const params: DidOpenTextDocumentParams = { textDocument };
    this.notify(lspProcess, 'textDocument/didOpen', params);
  }

  /**
   * Obtient la définition d'un symbole
   */
  async getDefinition(
    lspProcess: LspProcess,
    filePath: string,
    line: number,
    character: number
  ): Promise<LspLocation | LspLocation[] | null> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri: pathToUri(filePath) },
      position: { line, character },
    };

    try {
      const result = await this.request<LspLocation | LspLocation[] | null>(
        lspProcess,
        'textDocument/definition',
        params
      );
      return result;
    } catch (error) {
      if (this.config.debug) {
        console.error('[LSP] getDefinition error:', error);
      }
      return null;
    }
  }

  /**
   * Arrête un processus LSP
   */
  async shutdown(key: string): Promise<void> {
    const lspProcess = this.processes.get(key);
    if (!lspProcess) {
      return;
    }

    try {
      // Envoyer shutdown request
      await this.request(lspProcess, 'shutdown', null);
      // Envoyer exit notification
      this.notify(lspProcess, 'exit', null);
    } catch {
      // Ignorer les erreurs de shutdown
    }

    // Forcer la fermeture si nécessaire
    lspProcess.process.kill();
    this.processes.delete(key);
  }

  /**
   * Arrête tous les processus LSP
   */
  async shutdownAll(): Promise<void> {
    const keys = Array.from(this.processes.keys());
    await Promise.all(keys.map((key) => this.shutdown(key)));
  }
}
