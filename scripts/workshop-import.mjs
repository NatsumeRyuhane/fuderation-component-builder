// Model the field comment stripping performed on JSON import by the live
// StoryComponentEditor-BDSa5M3v.js (u/ie/de), verified 2026-09-06.
// This is deliberately NOT our syntax-aware build stripper. The site's scanner
// recognizes quoted strings but not regex literals or template interpolation.
// Source: https://chat.fuderation.com/assets/StoryComponentEditor-BDSa5M3v.js
export function stripWorkshopJavaScript(source = '') {
  const text = String(source);
  let out = '', quote = '', escaped = false, comment = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (comment === 'line') {
      if (char === '\n') { comment = ''; out += char; }
    } else if (comment === 'block') {
      if (char === '*' && next === '/') { comment = ''; i++; }
    } else if (quote) {
      out += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += char;
    } else if (char === '/' && (next === '/' || next === '*')) {
      comment = next === '/' ? 'line' : 'block';
      i++;
    } else out += char;
  }
  return out;
}

export function applyWorkshopFieldStripping(component) {
  return {
    ...component,
    html: String(component.html || '').replace(/<!--[\s\S]*?-->/g, ''),
    css: String(component.css || '').replace(/\/\*[\s\S]*?\*\//g, ''),
    script: stripWorkshopJavaScript(component.script || ''),
  };
}
