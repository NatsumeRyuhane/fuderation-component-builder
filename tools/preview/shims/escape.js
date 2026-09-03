// Stands in for the app's fontAwesomeLoader chunk.
//
// The component runtime imports exactly one thing from it — the HTML-escape
// helper, exported as `e`. The real chunk also lazy-loads FontAwesome brand CSS
// and therefore imports the whole Pinia global store, which we do not want in a
// preview bundle. This is a byte-for-byte equivalent of that one function.
export function e(v = '') {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
