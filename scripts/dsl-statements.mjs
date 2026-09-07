// MessageBubble-lB0l6UTk.js es()/ts(), verified 2026-09-06:
// mode validation inspects 32 lines, but execution parses only 12 statements.
export const DSL_EXECUTION_LIMIT = 12;

export function splitDslStatements(source = '') {
  const statements = [];
  let statement = '', quote = '', escaped = false;
  let parens = 0, brackets = 0, braces = 0;
  for (const char of String(source)) {
    if (quote) {
      statement += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') parens++;
    else if (char === ')' && parens) parens--;
    else if (char === '[') brackets++;
    else if (char === ']' && brackets) brackets--;
    else if (char === '{') braces++;
    else if (char === '}' && braces) braces--;
    if (!quote && !parens && !brackets && !braces && /[;\r\n]/.test(char)) {
      if (statement.trim()) statements.push(statement.trim());
      statement = '';
    } else statement += char;
  }
  if (statement.trim()) statements.push(statement.trim());
  return statements;
}
