import { parse } from 'acorn';
import { tokenize, TokenType } from '@csstools/css-tokenizer';
import { SAXParser } from 'parse5-sax-parser';
import { finished } from 'node:stream/promises';

// Edit source ranges rather than printing an AST: quoting, placeholders,
// indentation and (especially) separate DSL statements must survive unchanged.
function replaceRanges(source, ranges, replacements) {
  let cursor = 0;
  let result = '';
  ranges.forEach(({ start, end }, index) => {
    result += source.slice(cursor, start) + replacements[index];
    cursor = end;
  });
  return result + source.slice(cursor);
}

export function stripJavaScriptComments(source) {
  const comments = [];
  parse(source, { ecmaVersion: 'latest', sourceType: 'script', onComment: comments });
  return replaceRanges(source, comments, comments.map(({ start, end }) => {
    // A newline in a block comment affects automatic semicolon insertion.
    // A space prevents `return/* note */value` or `+/* note */+` joining tokens.
    const newlines = source.slice(start, end).replace(/[^\r\n\u2028\u2029]/g, '');
    if (newlines) return newlines;
    return start > 0 && end < source.length &&
      !/\s/.test(source[start - 1]) && !/\s/.test(source[end]) ? ' ' : '';
  }));
}

function cssSignature(tokens) {
  const signature = [];
  for (const [type, text] of tokens) {
    if (type === TokenType.Comment || type === TokenType.EOF) continue;
    const previous = signature.at(-1);
    if (type === TokenType.Whitespace && previous?.[0] === type) previous[1] += text;
    else signature.push([type, text]);
  }
  return JSON.stringify(signature);
}

export function stripCssComments(source) {
  const tokens = tokenize({ css: source });
  const ranges = tokens.filter(([type]) => type === TokenType.Comment)
    .map(([, , start, end]) => ({ start, end: end + 1 }));
  if (!ranges.length) return source;

  const expected = cssSignature(tokens);
  const replacements = ranges.map(() => '');
  const stripped = replaceRanges(source, ranges, replacements);
  const equivalent = (css) => cssSignature(tokenize({ css })) === expected;
  if (equivalent(stripped)) return stripped;

  // Rare fallback: e.g. `1/* note */px` must not become the dimension `1px`.
  // Whitespace is not an equivalent separator in CSS (it can be a combinator).
  // Keep only empty comments whose removal would change the token stream.
  replacements.fill('/**/');
  ranges.forEach((_, index) => {
    replacements[index] = '';
    if (!equivalent(replaceRanges(source, ranges, replacements))) replacements[index] = '/**/';
  });
  return replaceRanges(source, ranges, replacements);
}

async function inspectHtml(source) {
  const parser = new SAXParser({ sourceCodeLocationInfo: true });
  const ranges = [];
  const signature = [];
  parser.on('comment', ({ sourceCodeLocation: { startOffset, endOffset } }) => {
    ranges.push({ start: startOffset, end: endOffset });
  });
  parser.on('text', ({ text }) => {
    const previous = signature.at(-1);
    if (previous?.[0] === 'text') previous[1] += text;
    else signature.push(['text', text]);
  });
  for (const event of ['startTag', 'endTag', 'doctype']) {
    parser.on(event, ({ sourceCodeLocation, ...token }) => signature.push([event, token]));
  }
  const completion = finished(parser);
  parser.end(source);
  await completion;
  return { ranges, signature: JSON.stringify(signature) };
}

export async function stripHtmlComments(source) {
  const { ranges, signature } = await inspectHtml(source);
  if (!ranges.length) return source;
  const replacements = ranges.map(() => '');
  const stripped = replaceRanges(source, ranges, replacements);
  if ((await inspectHtml(stripped)).signature === signature) return stripped;

  // Removing comments must not create markup or character references:
  // `&am<!-- note -->p;` is literal text, whereas `&amp;` is an ampersand.
  replacements.fill('<!---->');
  for (let index = 0; index < ranges.length; index++) {
    replacements[index] = '';
    if ((await inspectHtml(replaceRanges(source, ranges, replacements))).signature !== signature) {
      replacements[index] = '<!---->';
    }
  }
  return replaceRanges(source, ranges, replacements);
}
