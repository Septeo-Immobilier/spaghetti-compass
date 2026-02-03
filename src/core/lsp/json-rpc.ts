/**
 * Types et utilitaires JSON-RPC pour la communication avec les LSP externes
 */

/**
 * Message JSON-RPC de base
 */
interface JsonRpcMessage {
  jsonrpc: '2.0';
}

/**
 * Requête JSON-RPC
 */
export interface JsonRpcRequest extends JsonRpcMessage {
  id: number;
  method: string;
  params?: unknown;
}

/**
 * Notification JSON-RPC (pas de réponse attendue)
 */
export interface JsonRpcNotification extends JsonRpcMessage {
  method: string;
  params?: unknown;
}

/**
 * Erreur JSON-RPC
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Réponse JSON-RPC
 */
export interface JsonRpcResponse<T = unknown> extends JsonRpcMessage {
  id: number;
  result?: T;
  error?: JsonRpcError;
}

/**
 * Codes d'erreur JSON-RPC standard
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // LSP specific
  SERVER_NOT_INITIALIZED: -32002,
  UNKNOWN_ERROR_CODE: -32001,
  REQUEST_CANCELLED: -32800,
} as const;

/**
 * Crée une requête JSON-RPC
 */
export function createRequest(id: number, method: string, params?: unknown): JsonRpcRequest {
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id,
    method,
  };
  if (params !== undefined) {
    request.params = params;
  }
  return request;
}

/**
 * Crée une notification JSON-RPC
 */
export function createNotification(method: string, params?: unknown): JsonRpcNotification {
  const notification: JsonRpcNotification = {
    jsonrpc: '2.0',
    method,
  };
  if (params !== undefined) {
    notification.params = params;
  }
  return notification;
}

/**
 * Encode un message JSON-RPC avec les headers LSP
 * Format: Content-Length: <length>\r\n\r\n<json>
 */
export function encodeMessage(message: JsonRpcRequest | JsonRpcNotification): string {
  const json = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
}

/**
 * Décode un message JSON-RPC depuis un buffer
 * Retourne le message et le reste du buffer
 */
export function decodeMessage(buffer: string): {
  message: JsonRpcResponse | null;
  remaining: string;
} {
  // Chercher le header Content-Length
  const headerEnd = buffer.indexOf('\r\n\r\n');
  if (headerEnd === -1) {
    return { message: null, remaining: buffer };
  }

  const header = buffer.substring(0, headerEnd);
  const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
  if (!lengthMatch) {
    return { message: null, remaining: buffer };
  }

  const contentLength = parseInt(lengthMatch[1], 10);
  const contentStart = headerEnd + 4;
  const contentEnd = contentStart + contentLength;

  if (buffer.length < contentEnd) {
    // Pas assez de données
    return { message: null, remaining: buffer };
  }

  const content = buffer.substring(contentStart, contentEnd);
  const remaining = buffer.substring(contentEnd);

  try {
    const message = JSON.parse(content) as JsonRpcResponse;
    return { message, remaining };
  } catch {
    return { message: null, remaining };
  }
}

// ============================================
// Types LSP Protocol
// ============================================

/**
 * Position dans un document (0-indexed)
 */
export interface LspPosition {
  line: number;
  character: number;
}

/**
 * Range dans un document
 */
export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

/**
 * Location dans un document
 */
export interface LspLocation {
  uri: string;
  range: LspRange;
}

/**
 * Identifiant de document
 */
export interface TextDocumentIdentifier {
  uri: string;
}

/**
 * Item de document avec texte
 */
export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

/**
 * Paramètres pour textDocument/didOpen
 */
export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

/**
 * Paramètres pour textDocument/definition
 */
export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: LspPosition;
}

/**
 * Paramètres pour initialize
 */
export interface InitializeParams {
  processId: number | null;
  rootUri: string | null;
  capabilities: ClientCapabilities;
  initializationOptions?: unknown;
}

/**
 * Capacités du client (minimales)
 */
export interface ClientCapabilities {
  textDocument?: {
    definition?: {
      dynamicRegistration?: boolean;
    };
  };
}

/**
 * Résultat de initialize
 */
export interface InitializeResult {
  capabilities: ServerCapabilities;
}

/**
 * Capacités du serveur (minimales)
 */
export interface ServerCapabilities {
  definitionProvider?: boolean;
  textDocumentSync?: number | TextDocumentSyncOptions;
}

/**
 * Options de synchronisation de document
 */
export interface TextDocumentSyncOptions {
  openClose?: boolean;
  change?: number;
}

/**
 * Convertit un chemin de fichier en URI
 */
export function pathToUri(filePath: string): string {
  // Sur Windows, le chemin doit commencer par /
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (normalizedPath.match(/^[a-zA-Z]:/)) {
    return `file:///${normalizedPath}`;
  }
  return `file://${normalizedPath}`;
}

/**
 * Convertit un URI en chemin de fichier
 */
export function uriToPath(uri: string): string {
  const filePath = uri.replace(/^file:\/\//, '');
  // Sur Windows, enlever le / initial avant la lettre de lecteur
  if (filePath.match(/^\/[a-zA-Z]:/)) {
    return filePath.substring(1);
  }
  return filePath;
}
