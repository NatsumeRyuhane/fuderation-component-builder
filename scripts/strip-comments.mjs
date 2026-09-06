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
  // Collapse adjacent comments so a long neighboring token is inspected only
  // once for the run, not once for every comment in it.
  const units = [];
  const ranges = [];
  for (const token of tokens) {
    if (token[0] !== TokenType.Comment) units.push(token);
    else if (units.at(-1)?.[0] === TokenType.Comment) ranges.at(-1).end = token[3] + 1;
    else {
      ranges.push({ start: token[2], end: token[3] + 1, index: units.length });
      units.push([TokenType.Comment, '/**/']);
    }
  }
  if (!ranges.length) return source;

  const expected = cssSignature(tokens);
  const replacements = ranges.map(() => '');
  const stripped = replaceRanges(source, ranges, replacements);
  const equivalent = (css) => cssSignature(tokenize({ css })) === expected;
  if (equivalent(stripped)) return stripped;

  // Rare fallback: e.g. `1/* note */px` must not become the dimension `1px`.
  // Whitespace is not an equivalent separator in CSS (it can be a combinator).
  // Keep only empty comments whose removal would change the token stream.
  // Token joins can involve four delimiter characters (e.g. <!--).
  // Eight units cover four tokens even with intervening comment boundaries.
  // Each complete token participates in at most 17 windows, bounding total
  // tokenization work even for very long strings, identifiers and comments.
  for (const [rangeIndex, { index }] of ranges.entries()) {
    const window = units.slice(Math.max(0, index - 8), index + 9);
    units[index][1] = '';
    if (cssSignature(tokenize({ css: window.map((token) => token[1]).join('') })) !== cssSignature(window)) {
      units[index][1] = replacements[rangeIndex] = '/**/';
    }
  }
  const result = replaceRanges(source, ranges, replacements);
  // A whole-source check covers malformed input/context beyond local windows.
  // Conservatively retain empty separators if it fails, with no per-range retry.
  return equivalent(result) ? result : replaceRanges(source, ranges, ranges.map(() => '/**/'));
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
  let cursor = 0;
  let tail = '';
  for (let index = 0; index < ranges.length; index++) {
    const { start, end } = ranges[index];
    tail += source.slice(cursor, start);
    cursor = end;
    // A following comment still supplies the boundary; decide at the last one.
    if (ranges[index + 1]?.start === end) continue;
    const nextStart = ranges[index + 1]?.start;
    const rightEnd = Math.min(end + 64, nextStart ?? source.length);
    // Include the next still-present boundary: a newly formed `</` can consume
    // that comment as a bogus end tag before any following text is reached.
    const right = source.slice(end, rightEnd) + (rightEnd === nextStart ? '<!---->' : '');
    // Numeric references can be arbitrarily long. Any additional digit (or a
    // semicolon after digits) would be consumed instead of remaining text.
    const numeric = tail.match(/&#(x[\da-f]*|\d*)$/i)?.[1];
    const hex = numeric?.[0]?.toLowerCase() === 'x';
    const digits = numeric?.slice(hex ? 1 : 0);
    let required = numeric !== undefined && (
      (hex ? /^[\da-f]/i : /^\d/).test(right) || (digits.length > 0 && right.startsWith(';'))
    );
    // Named references are shorter than 64 characters. Only a trailing
    // reference, tag opener or CR can interact with text across an HTML comment.
    tail = tail.slice(-64);
    const boundary = tail.match(/(?:&[\da-z#]*|<\/?|\r)$/i)?.[0];
    if (!required && boundary) {
      const before = await inspectHtml(boundary + '<!---->' + right);
      const after = await inspectHtml(boundary + right);
      required = before.signature !== after.signature;
    }
    if (required) {
      replacements[index] = '<!---->';
      tail = '';
    }
  }
  const result = replaceRanges(source, ranges, replacements);
  return (await inspectHtml(result)).signature === signature
    ? result : replaceRanges(source, ranges, ranges.map(() => '<!---->'));
}
