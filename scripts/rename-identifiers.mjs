import { parse } from 'acorn';
import { minify } from 'terser';

const PARSE_OPTIONS = { ecmaVersion: 'latest', sourceType: 'script' };
const POSITION_KEYS = new Set(['start', 'end', 'raw']);
const FUNCTION_VALUES = new Set(['ArrowFunctionExpression', 'FunctionExpression', 'ClassExpression']);

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node.type) return;
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

// Never introduce '$': Fuderation scans pairs of dollars before executing JS.
// Terser still handles scopes, collisions and reserved words for these names.
export function shortName(index) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let name = '';
  do {
    name = alphabet[index % alphabet.length] + name;
    index = Math.floor(index / alphabet.length) - 1;
  } while (index >= 0);
  return name;
}

function reservedIdentifiers(ast, reservedNames) {
  const reserved = new Set(reservedNames);
  walk(ast, (node) => {
    if (node.type === 'Identifier' && (node.name.includes('$') || node.name.length === 1)) {
      reserved.add(node.name);
    }
    // Keep shorthand keys/bindings intact instead of expanding object syntax.
    if (node.type === 'Property' && node.shorthand) reserved.add(node.key.name);
    if (/^(?:Function|Class)(?:Declaration|Expression)$/.test(node.type) && node.id) {
      reserved.add(node.id.name);
    }
    // keep_fnames/keep_classnames do not cover every inferred .name, including
    // assignments, default parameters and variables holding anonymous classes.
    const target = node.type === 'VariableDeclarator' ? node.id : node.left;
    const value = node.type === 'VariableDeclarator' ? node.init : node.right;
    if (['VariableDeclarator', 'AssignmentExpression', 'AssignmentPattern'].includes(node.type) &&
        target?.type === 'Identifier' && FUNCTION_VALUES.has(value?.type)) {
      reserved.add(target.name);
    }
  });
  return reserved;
}

function isPropertyName(parent, key) {
  return !parent?.computed && (
    (parent?.type === 'MemberExpression' && key === 'property') ||
    (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent?.type) && key === 'key')
  );
}

// Compare public ESTree ASTs rather than depending on Terser's internal AST.
// Only Identifier names may differ. Literal spellings and all other source
// text are retained from the input; even mangle-only printers remove '\$'.
function collectEdits(before, after, reserved, edits, parent, key) {
  if (before === null || typeof before !== 'object') return Object.is(before, after);
  if (after === null || typeof after !== 'object') return false;
  if (Array.isArray(before)) {
    return Array.isArray(after) && before.length === after.length &&
      before.every((node, index) => collectEdits(node, after[index], reserved, edits, parent, key));
  }
  if (before.type !== after.type) return false;
  // Labels and private properties have separate namespaces. Terser shortens
  // them too, but this pass preserves their declarations and every reference.
  if (before.type === 'PrivateIdentifier' || key === 'label') return true;
  if (before.type === 'Identifier') {
    if (before.name === after.name) return true;
    if (reserved.has(before.name) || isPropertyName(parent, key)) return false;
    edits.push({ start: before.start, end: before.end, name: after.name });
    return true;
  }
  const keys = (node) => Object.keys(node).filter((field) =>
    !POSITION_KEYS.has(field) && !(node.type === 'Property' && field === 'shorthand'));
  const beforeKeys = keys(before);
  const afterKeys = keys(after);
  return beforeKeys.length === afterKeys.length && beforeKeys.every((field) =>
    Object.hasOwn(after, field) && collectEdits(before[field], after[field], reserved, edits, before, field));
}

export async function renameJavaScriptIdentifiers(source, { reservedNames = [] } = {}) {
  const ast = parse(source, PARSE_OPTIONS);
  const reserved = reservedIdentifiers(ast, reservedNames);
  const result = await minify(source, {
    compress: false,
    mangle: {
      toplevel: false,
      properties: false,
      eval: false,
      reserved: [...reserved],
      nth_identifier: { get: shortName },
    },
    keep_fnames: true,
    keep_classnames: true,
    format: { comments: false, ascii_only: false, keep_quoted_props: true },
  });
  const renamedAst = parse(result.code, PARSE_OPTIONS);
  const edits = [];
  // An optimization is optional. If a printer changes the AST beyond names,
  // retain the source instead of applying a partial, potentially unsafe map.
  if (!collectEdits(ast, renamedAst, reserved, edits)) return source;

  let cursor = 0;
  let renamed = '';
  for (const { start, end, name } of edits.sort((a, b) => a.start - b.start)) {
    if (start < cursor) return source;
    renamed += source.slice(cursor, start) + name;
    cursor = end;
  }
  renamed += source.slice(cursor);
  // Reparse the edited original to catch any lexical ambiguity at a boundary.
  // Labels/private names are deliberately ignored by the comparison above.
  const remainingEdits = [];
  if (renamed.length >= source.length ||
      !collectEdits(parse(renamed, PARSE_OPTIONS), renamedAst, new Set(), remainingEdits) ||
      remainingEdits.length) return source;
  return renamed;
}

export function readRenameOptions(build = {}) {
  if (!build || typeof build !== 'object' || Array.isArray(build)) {
    throw new Error('meta.json "build" must be an object');
  }
  const { renameIdentifiers = true, reservedNames = [] } = build;
  if (typeof renameIdentifiers !== 'boolean') {
    throw new Error('meta.json "build.renameIdentifiers" must be a boolean');
  }
  if (!Array.isArray(reservedNames) || reservedNames.some((name) => typeof name !== 'string' || !name)) {
    throw new Error('meta.json "build.reservedNames" must be an array of nonempty strings');
  }
  return { renameIdentifiers, reservedNames };
}
