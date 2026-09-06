// Keep this explicit iframe marker even after source simplification.
(() => {})();

function diagnosticAssert(condition, explanation) {
  if (!condition) throw new Error(explanation);
}

function diagnosticBindingProbe(descriptiveInput) {
  const { amount: descriptiveAmount } = { amount: descriptiveInput };
  const [descriptiveFirst, ...descriptiveRest] = [descriptiveAmount, 2, 3];
  function nestedProbe(descriptiveInput) { return descriptiveInput + descriptiveAmount; }
  return nestedProbe(4) + descriptiveFirst + descriptiveRest.length;
}

function diagnosticNameProbe() {
  const shorthandValue = 7;
  const publicObject = { shorthandValue, "publicKey": 9 };
  const descriptiveCallback = () => publicObject.publicKey;
  const descriptiveClass = class {};
  return Object.keys(publicObject).join(',') + ':' + descriptiveCallback.name + ':' + descriptiveClass.name;
}

let diagnosticRunning = false;
let diagnosticClicks = 0;
document.querySelector('[data-event]').addEventListener('click', function diagnosticClickHandler() {
  diagnosticClicks += 1;
  document.querySelector('[data-event-count]').textContent = diagnosticClicks + ' clicks observed';
});

function diagnosticVisualSummary() {
  const checkedObservations = document.querySelectorAll('[data-visual]:checked').length;
  document.querySelector('[data-visual-summary]').textContent = checkedObservations + ' / 4 visual observations confirmed';
}
document.querySelectorAll('[data-visual]').forEach(function registerVisualInput(visualInput) {
  visualInput.addEventListener('change', diagnosticVisualSummary);
});

async function runDiagnosticChecks() {
  if (diagnosticRunning) return;
  diagnosticRunning = true;
  const runButton = document.querySelector('[data-run]');
  const summaryElement = document.querySelector('[data-summary]');
  const rootElement = document.querySelector('.lab');
  runButton.disabled = true;
  rootElement.dataset.result = 'running';
  summaryElement.textContent = 'RUNNING · assertions inspect actual results';
  document.querySelectorAll('[data-check]').forEach(function resetCheck(checkRow) {
    checkRow.dataset.state = 'pending';
    checkRow.textContent = 'PENDING · ' + checkRow.dataset.check;
  });
  let passedChecks = 0;
  let failedChecks = 0;

  async function checkDiagnostic(checkId, checkLabel, checkOperation) {
    const checkRow = document.querySelector('[data-check="' + checkId + '"]');
    let timeoutHandle;
    try {
      await Promise.race([
        Promise.resolve().then(checkOperation),
        new Promise(function timeoutCheck(resolve, reject) {
          timeoutHandle = setTimeout(function reportTimeout() { reject(new Error('Timed out after 7 seconds')); }, 7000);
        }),
      ]);
      passedChecks += 1;
      checkRow.dataset.state = 'pass';
      checkRow.textContent = 'PASS · ' + checkLabel;
    } catch (diagnosticError) {
      failedChecks += 1;
      checkRow.dataset.state = 'fail';
      checkRow.textContent = 'FAIL · ' + checkLabel + ' — ' + diagnosticError.message;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  await checkDiagnostic('bindings', 'closures, shadowing and destructuring', function checkBindings() {
    diagnosticAssert(diagnosticBindingProbe(3) === 12, 'Expected nested calculation 12');
  });
  await checkDiagnostic('names', 'public keys and function/class names', function checkNames() {
    diagnosticAssert(diagnosticNameProbe() === 'shorthandValue,publicKey:descriptiveCallback:descriptiveClass', 'Observable names changed');
  });
  await checkDiagnostic('literals', 'Unicode, slashes and escaped tag literals', function checkLiterals() {
    const descriptiveLiteral = 'https://example.com/a/*literal*/ // 欢迎';
    const literalPattern = new RegExp('/\\*literal\\*/');
    const escapedTag = '<\$DiagnosticEcho\$>';
    const expectedTag = '<' + String.fromCharCode(36) + 'DiagnosticEcho' + String.fromCharCode(36) + '>';
    diagnosticAssert(document.querySelector('[data-literal]').textContent === descriptiveLiteral, 'Literal text changed');
    diagnosticAssert(literalPattern.test(descriptiveLiteral), 'Regular expression changed');
    diagnosticAssert(escapedTag === expectedTag, 'Escaped component tag changed');
  });
  await checkDiagnostic('values', 'text and input bridges', function checkValues() {
    document.querySelector('[data-text]').textContent = 'RESET';
    document.querySelector('[data-value]').value = 'RESET';
    setText('[data-text]', '欢迎 / bridge text');
    setValue('[data-value]', '  IFRAME READY  ');
    diagnosticAssert(document.querySelector('[data-text]').textContent === '欢迎 / bridge text', 'setText did not write text');
    diagnosticAssert(document.querySelector('[data-value]').value === '  IFRAME READY  ', 'setValue changed spaces or did not write');
  });
  await checkDiagnostic('guard', 'equality true and false results', function checkGuard() {
    diagnosticAssert(requireInputEquals('[data-value]', '  IFRAME READY  ', 'Unexpected equality failure', false) === true, 'Expected true on equal input');
    diagnosticAssert(requireInputEquals('[data-value]', 'WRONG', 'EXPECTED iframe diagnostic rejection', false) === false, 'Expected false on mismatching input');
  });
  await checkDiagnostic('classes', 'class add and remove', function checkClasses() {
    const classProbe = document.querySelector('[data-class]');
    classProbe.className = 'remove-me';
    addClass('[data-class]', 'added-by-bridge');
    removeClass('[data-class]', 'remove-me');
    diagnosticAssert(classProbe.classList.contains('added-by-bridge') && !classProbe.classList.contains('remove-me'), 'Class mutations did not match');
  });
  await checkDiagnostic('styles', 'visibility and style bridges', function checkStyles() {
    const visibleProbe = document.querySelector('[data-visible]');
    const hiddenProbe = document.querySelector('[data-hidden]');
    const styleProbe = document.querySelector('[data-swatch]');
    visibleProbe.style.display = 'none';
    hiddenProbe.style.display = 'block';
    styleProbe.style.backgroundColor = '#bfdbfe';
    show('[data-visible]');
    hide('[data-hidden]');
    setStyle('[data-swatch]', 'background-color', '#bbf7d0');
    diagnosticAssert(getComputedStyle(visibleProbe).display !== 'none', 'show did not reveal the probe');
    diagnosticAssert(getComputedStyle(hiddenProbe).display === 'none', 'hide did not hide the probe');
    diagnosticAssert(styleProbe.style.backgroundColor === 'rgb(187, 247, 208)', 'setStyle did not turn the swatch green');
  });
  await checkDiagnostic('storage', 'awaited storage reset and round trip', async function checkStorage() {
    const diagnosticStorageKey = 'fcb.diagnostics.iframe.v1';
    await saveToLocal(diagnosticStorageKey, 'RESET');
    diagnosticAssert(await readFromLocal(diagnosticStorageKey) === 'RESET', 'Storage reset failed');
    await saveToLocal(diagnosticStorageKey, 'ROUNDTRIP');
    diagnosticAssert(await readFromLocal(diagnosticStorageKey) === 'ROUNDTRIP', 'Storage round trip failed');
  });
  await checkDiagnostic('flow', 'wait and progress completion', async function checkFlow() {
    const waitStartedAt = performance.now();
    await wait(60);
    diagnosticAssert(performance.now() - waitStartedAt >= 45, 'wait returned too early');
    document.querySelector('[data-percent]').textContent = '0%';
    document.querySelector('[data-bar]').style.width = '0%';
    await progress('[data-bar]', '[data-percent]', 300);
    diagnosticAssert(document.querySelector('[data-percent]').textContent === '100%', 'progress did not complete before returning');
    diagnosticAssert(document.querySelector('[data-bar]').style.width === '100%', 'Progress bar is not full');
  });
  await checkDiagnostic('events', 'registered click handler', function checkEvents() {
    const clicksBefore = diagnosticClicks;
    document.querySelector('[data-event]').click();
    diagnosticAssert(diagnosticClicks === clicksBefore + 1, 'Click handler did not run exactly once');
    diagnosticAssert(document.querySelector('[data-event-count]').textContent === diagnosticClicks + ' clicks observed', 'Click counter did not update');
  });

  rootElement.dataset.result = failedChecks ? 'fail' : 'pass';
  summaryElement.textContent = (failedChecks ? 'FAIL' : 'PASS') + ' · ' + passedChecks + '/10 automatic checks passed, ' + failedChecks + ' failed. Visual checks are separate.';
  runButton.disabled = false;
  diagnosticRunning = false;
}

document.querySelector('[data-run]').addEventListener('click', runDiagnosticChecks);
runDiagnosticChecks();
