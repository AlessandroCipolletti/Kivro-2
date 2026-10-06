import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const forbidden = [
  /^(?:@aws-sdk\/|aws-sdk(?:\/|$))/, 
  /^(?:@kivro\/)?(?:infrastructure-aws|infrastructure-netsons|storage-s3)(?:\/|$)/,
  /(?:^|\/)(?:infrastructure\/(?:aws|netsons|s3)|cloud-aws|cloud-netsons)(?:\/|$)/,
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
    if (['node_modules', '.next', 'dist', 'test-results', '.git'].includes(item)) continue;
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
        file.includes(`${join('packages', 'infrastructure', 'netsons')}/`) ||
        file.includes(`${join('packages', 'infrastructure', 's3')}/`)) continue;
    for (const specifier of forbiddenImports(readFileSync(file, 'utf8'))) {
      violations.push(`${relative(root, file)} imports ${specifier}`);
    }
  }
  return violations;
}

/** OpenClaw remains an installed external runtime; only its adapter may access its APIs. */
export function openClawBoundaryViolations(root) {
  const violations = [];
  for (const workspace of ['apps', 'packages']) {
    for (const file of sourceFiles(join(root, workspace))) {
      const relativePath = relative(root, file);
      if (relativePath.startsWith('packages/openclaw-adapter/')) continue;
      const source = readFileSync(file, 'utf8');
      if (/(?:from\s*|import\s*\(|require\s*\()\s*['"](?:openclaw|@openclaw\/)/.test(source) ||
          /(?:spawn|execFile|fork)\s*\(\s*['"]openclaw['"]/.test(source)) {
        violations.push(relativePath);
      }
    }
  }
  for (const workspace of ['.', 'apps/web', 'apps/worker', 'packages/openclaw-adapter']) {
    const packagePath = join(root, workspace, 'package.json');
    if (!existsFile(packagePath)) continue;
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    for (const group of ['dependencies', 'devDependencies']) {
      for (const name of Object.keys(packageJson[group] ?? {})) {
        if (name === 'openclaw' || name.startsWith('@openclaw/')) violations.push(`${workspace}/package.json:${name}`);
      }
    }
  }
  return violations;
}

function existsFile(path) {
  try { return statSync(path).isFile(); }
  catch { return false; }
}
