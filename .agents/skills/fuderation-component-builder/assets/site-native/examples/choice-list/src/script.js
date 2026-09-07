(() => {
  const rows = Array.from(document.querySelectorAll('.sn-option'));
  let n = 0;
  for (const row of rows) {
    const label = row.querySelector('.sn-option-t');
    const text = (label ? label.textContent : '').trim();
    // An unfilled $OptionN$ arrives as an empty span, not as missing markup.
    if (!text) { row.remove(); continue; }
    row.querySelector('.sn-option-idx').textContent = ++n + '.';
    row.addEventListener('click', () => fillInput(text));
  }
})();
