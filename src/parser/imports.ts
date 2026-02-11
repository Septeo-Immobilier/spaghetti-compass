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
 * Détecte aussi les callbacks et les assignations de fonctions à des variables
 */
export function extractFunctionCalls(
  functionBody: ts.Block | ts.Expression,
  sourceFile: ts.SourceFile,
  importedNames: Map<string, string> // name -> module
): FunctionCallInfo[] {
  const calls: FunctionCallInfo[] = [];
  const seen = new Set<string>();

  // Map des variables qui contiennent des références à des fonctions
  // variable name -> function reference (ex: "handler" -> "this.processData")
  const functionVariables = new Map<string, { name: string; fromModule?: string; isThisCall?: boolean }>();

  // Première passe : collecter les assignations de fonctions à des variables
  function collectFunctionVariables(node: ts.Node): void {
    // const handler = this.processData;
    // const fn = someImportedFunction;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const varName = node.name.text;

      // this.method ou this['method']
      if (ts.isPropertyAccessExpression(node.initializer)) {
        if (node.initializer.expression.kind === ts.SyntaxKind.ThisKeyword) {
          functionVariables.set(varName, {
            name: node.initializer.name.text,
            isThisCall: true,
          });
        } else if (ts.isIdentifier(node.initializer.expression)) {
          const objName = node.initializer.expression.text;
          const methodName = node.initializer.name.text;
          functionVariables.set(varName, {
            name: `${objName}.${methodName}`,
            fromModule: importedNames.get(objName),
          });
        }
      }
      // Direct function reference: const fn = importedFunction;
      else if (ts.isIdentifier(node.initializer)) {
        const refName = node.initializer.text;
        if (importedNames.has(refName)) {
          functionVariables.set(varName, {
            name: refName,
            fromModule: importedNames.get(refName),
          });
        }
      }
    }
    ts.forEachChild(node, collectFunctionVariables);
  }

  // Deuxième passe : collecter les appels (y compris new ClassName() → cible le constructeur)
  function visit(node: ts.Node): void {
    // new ClassName() : traiter comme un appel vers le constructeur de la classe
    if (ts.isNewExpression(node)) {
      let callName: string | undefined;
      let fromModule: string | undefined;
      if (ts.isIdentifier(node.expression)) {
        callName = node.expression.text;
        fromModule = importedNames.get(callName);
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;
        if (ts.isIdentifier(node.expression.expression)) {
          const objName = node.expression.expression.text;
          callName = `${objName}.${methodName}`;
          fromModule = importedNames.get(objName);
        }
      }
      if (callName) {
        const key = `new:${callName}:${fromModule || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          calls.push({
            name: callName,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            fromModule,
            isThisCall: false,
          });
        }
      }
      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isCallExpression(node)) {
      let callName: string | undefined;
      let fromModule: string | undefined;
      let isThisCall = false;

      if (ts.isIdentifier(node.expression)) {
        callName = node.expression.text;
        fromModule = importedNames.get(callName);
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;

        // this.method() - appel direct sur this
        if (node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
          callName = methodName;
          isThisCall = true;
        }
        // this.property.method() - appel sur une propriété de this (ex: this.userService.getAll())
        else if (ts.isPropertyAccessExpression(node.expression.expression)) {
          const innerExpr = node.expression.expression;
          if (innerExpr.expression.kind === ts.SyntaxKind.ThisKeyword) {
            // C'est this.property.method()
            const propertyName = innerExpr.name.text;
            callName = `${propertyName}.${methodName}`;
            isThisCall = true; // C'est un appel via this, même si indirect
          } else if (ts.isIdentifier(innerExpr.expression)) {
            // C'est obj.property.method()
            const objName = innerExpr.expression.text;
            const propertyName = innerExpr.name.text;
            callName = `${objName}.${propertyName}.${methodName}`;
            fromModule = importedNames.get(objName);
          }
        }
        // obj.method() - appel sur un objet importé
        else if (ts.isIdentifier(node.expression.expression)) {
          const objName = node.expression.expression.text;
          callName = `${objName}.${methodName}`;
          fromModule = importedNames.get(objName);
        }
      }

      if (callName) {
        const key = `${callName}:${fromModule || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          calls.push({
            name: callName,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            fromModule,
            isThisCall,
          });
        }
      }

      // Détecter les callbacks passés en argument
      // Ex: promise.then(this.handler), array.map(processItem)
      for (const arg of node.arguments) {
        let callbackInfo: { name: string; fromModule?: string; isThisCall?: boolean } | undefined;

        // Direct function reference: fn(callback)
        if (ts.isIdentifier(arg)) {
          const argName = arg.text;
          // Vérifier si c'est une variable qui contient une référence à une fonction
          if (functionVariables.has(argName)) {
            callbackInfo = functionVariables.get(argName);
          }
          // Vérifier si c'est une fonction importée
          else if (importedNames.has(argName)) {
            callbackInfo = { name: argName, fromModule: importedNames.get(argName) };
          }
        }
        // this.method as callback: fn(this.handler)
        else if (ts.isPropertyAccessExpression(arg)) {
          if (arg.expression.kind === ts.SyntaxKind.ThisKeyword) {
            callbackInfo = { name: arg.name.text, isThisCall: true };
          } else if (ts.isIdentifier(arg.expression)) {
            const objName = arg.expression.text;
            const methodName = arg.name.text;
            callbackInfo = {
              name: `${objName}.${methodName}`,
              fromModule: importedNames.get(objName),
            };
          }
        }
        // Arrow function with single call: fn(() => this.handler())
        // ou fn((x) => process(x))
        else if (ts.isArrowFunction(arg)) {
          // Si le corps est un appel direct
          if (ts.isCallExpression(arg.body)) {
            // Le visit récursif va le capturer
          }
          // Si le corps est un bloc, le visit récursif va le capturer
        }

        if (callbackInfo) {
          const key = `${callbackInfo.name}:${callbackInfo.fromModule || ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            calls.push({
              name: callbackInfo.name,
              line: sourceFile.getLineAndCharacterOfPosition(arg.getStart()).line + 1,
              fromModule: callbackInfo.fromModule,
              isThisCall: callbackInfo.isThisCall,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  // Exécuter les deux passes
  collectFunctionVariables(functionBody);
  visit(functionBody);

  return calls;
}
