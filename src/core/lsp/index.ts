/**
 * LSP Module - Exports publics
 */

// Types
export type { LspProvider, DefinitionResult, LspConfig, LspProviderStatus } from './types.js';

// JSON-RPC
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  LspPosition,
  LspRange,
  LspLocation,
} from './json-rpc.js';
export { pathToUri, uriToPath } from './json-rpc.js';

// Process Manager
export { LspProcessManager, type ProcessManagerConfig } from './process-manager.js';

// Providers
export { TypeScriptLspProvider } from './typescript.js';
export { PhpLspProvider } from './php.js';
export { PythonLspProvider } from './python.js';
export { GoLspProvider } from './go.js';
export { NullLspProvider } from './null.js';

// Factory
export { LspProviderFactory } from './factory.js';
