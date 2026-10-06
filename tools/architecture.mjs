import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const forbidden = [
  /^(?:@aws-sdk\/|aws-sdk(?:\/|$))/, 
  /^(?:@kivro\/)?(?:infrastructure-aws|infrastructure-netsons)(?:\/|$)/,
  /(?:^|\/)(?:infrastructure\/aws|infrastructure\/netsons|cloud-aws|cloud-netsons)(?:\/|$)/,
];

export function forbiddenImports(source) {
  const file = ts.createSourceFile('check.ts', source, ts.ScriptTarget.Latest, true);
  const specifiers = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      specifiers.push(node.argument.literal.text);
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        specifiers.push(node.arguments[0].text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return specifiers.filter((specifier) => forbidden.some((pattern) => pattern.test(specifier)));
}

function sourceFiles(directory) {
  const files = [];
  for (const item of readdirSync(directory)) {
    const path = join(directory, item);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(item)) files.push(path);
  }
  return files;
}

export function architectureViolations(root) {
  const packages = join(root, 'packages');
  const violations = [];
  for (const file of sourceFiles(packages)) {
    if (file.includes(`${join('packages', 'infrastructure', 'aws')}/`) ||
        file.includes(`${join('packages', 'infrastructure', 'netsons')}/`)) continue;
    for (const specifier of forbiddenImports(readFileSync(file, 'utf8'))) {
      violations.push(`${relative(root, file)} imports ${specifier}`);
    }
  }
  return violations;
}
