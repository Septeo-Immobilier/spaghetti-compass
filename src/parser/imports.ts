/**
 * Extraction des imports et exports depuis l'AST TypeScript
 */

import ts from 'typescript';
import type { ImportInfo, ExportInfo, EdgeType, FunctionCallInfo } from '../types/index.js';

/**
 * Vérifie si un noeud est un import dynamique
 */
export function isDynamicImport(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
  );
}

/**
 * Extrait les imports d'un fichier source
 */
export function extractImports(sourceFile: ts.SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];

  function visit(node: ts.Node): void {
    // Import declarations: import x from 'y', import { a, b } from 'y'
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importInfo: ImportInfo = {
          moduleSpecifier: moduleSpecifier.text,
          importedNames: [],
          type: 'import-static' as EdgeType,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          resolved: true,
        };

        // Extraire les noms importés
        if (node.importClause) {
          // Default import
          if (node.importClause.name) {
            importInfo.importedNames.push(node.importClause.name.text);
          }
          // Named imports
          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              for (const element of node.importClause.namedBindings.elements) {
                importInfo.importedNames.push(element.name.text);
              }
            } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              // import * as ns from 'module'
              importInfo.importedNames.push(`* as ${node.importClause.namedBindings.name.text}`);
            }
          }
        }

        imports.push(importInfo);
      }
    }

    // Dynamic imports: import('module')
    if (isDynamicImport(node)) {
      const callExpr = node as ts.CallExpression;
      const arg = callExpr.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        imports.push({
          moduleSpecifier: arg.text,
          importedNames: [],
          type: 'import-dynamic' as EdgeType,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          resolved: false, // Les imports dynamiques sont toujours non résolus
        });
      } else {
        // Import dynamique avec expression (non résolvable)
        imports.push({
          moduleSpecifier: '<dynamic>',
          importedNames: [],
          type: 'import-dynamic' as EdgeType,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          resolved: false,
        });
      }
    }

    // CommonJS require: const x = require('y')
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        imports.push({
          moduleSpecifier: arg.text,
          importedNames: [],
          type: 'require' as EdgeType,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          resolved: true,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

/**
 * Extrait les exports d'un fichier source
 */
export function extractExports(sourceFile: ts.SourceFile): ExportInfo[] {
  const exports: ExportInfo[] = [];

  function visit(node: ts.Node): void {
    // Export declarations: export { a, b }
    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        // Re-export: export { x } from 'module'
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            exports.push({
              name: element.name.text,
              kind: 're-export',
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
              fromModule: node.moduleSpecifier.text,
            });
          }
        } else {
          // export * from 'module'
          exports.push({
            name: '*',
            kind: 're-export',
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            fromModule: node.moduleSpecifier.text,
          });
        }
      } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        // export { a, b }
        for (const element of node.exportClause.elements) {
          exports.push({
            name: element.name.text,
            kind: 'variable',
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
        }
      }
    }

    // Export assignment: export default x
    if (ts.isExportAssignment(node)) {
      exports.push({
        name: 'default',
        kind: 'default',
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }

    // Exported function: export function foo() {}
    if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
      const name = node.name?.text || 'anonymous';
      exports.push({
        name,
        kind: 'function',
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }

    // Exported class: export class Foo {}
    if (ts.isClassDeclaration(node) && hasExportModifier(node)) {
      const name = node.name?.text || 'anonymous';
      exports.push({
        name,
        kind: 'class',
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }

    // Exported variable: export const x = ...
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          exports.push({
            name: declaration.name.text,
            kind: 'variable',
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
        }
      }
    }

    // Exported type/interface
    if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
      exports.push({
        name: node.name.text,
        kind: 'type',
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }

    if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
      exports.push({
        name: node.name.text,
        kind: 'type',
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

/**
 * Vérifie si un noeud a le modifier export
 */
function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/**
 * Extrait les appels de fonction dans une fonction
 */
export function extractFunctionCalls(
  functionBody: ts.Block | ts.Expression,
  sourceFile: ts.SourceFile,
  importedNames: Map<string, string> // name -> module
): FunctionCallInfo[] {
  const calls: FunctionCallInfo[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      let callName: string | undefined;
      let fromModule: string | undefined;

      if (ts.isIdentifier(node.expression)) {
        callName = node.expression.text;
        fromModule = importedNames.get(callName);
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        // obj.method()
        const objName = ts.isIdentifier(node.expression.expression)
          ? node.expression.expression.text
          : undefined;
        const methodName = node.expression.name.text;
        callName = objName ? `${objName}.${methodName}` : methodName;
        if (objName) {
          fromModule = importedNames.get(objName);
        }
      }

      if (callName) {
        calls.push({
          name: callName,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          fromModule,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(functionBody);
  return calls;
}
