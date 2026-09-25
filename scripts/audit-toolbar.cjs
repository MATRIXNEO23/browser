// Exercise the native toolbar command in two browser windows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'apply-fork-overlay.py'), 'utf8');
const controller = source.split('helper = r"""')[1]?.split('"""')[0];
assert.ok(controller, 'native controller must be present');
assert.match(source, /id="filum-sidebar-button"[\s\S]*?removable="false" overflows="false"/);
assert.match(source, /button \+ anchor/);

function makeWindow() {
  const listeners = [];
  const button = {
    addEventListener(type, callback) {
      assert.equal(type, 'command');
      listeners.push(callback);
    },
    click() { listeners.forEach(callback => callback()); }
  };
  const window = {addEventListener() {}};
  const context = vm.createContext({
    document: {getElementById(id) { return id === 'filum-sidebar-button' ? button : null; }},
    window,
    Services: {prefs: {getBoolPref() { return false; }}},
    console
  });
  vm.runInContext(controller, context);
  assert.equal(context.FilumPanel.bindButton(), true);
  assert.equal(listeners.length, 1);
  assert.equal(window.FilumPanel, context.FilumPanel);
  return {button, panel: context.FilumPanel};
}

const first = makeWindow();
const second = makeWindow();
let firstToggles = 0;
let secondToggles = 0;
first.panel.toggle = () => { firstToggles++; };
second.panel.toggle = () => { secondToggles++; };
first.button.click();
second.button.click();
assert.equal(firstToggles, 1);
assert.equal(secondToggles, 1);
assert.equal(first.panel.bindButton(), true);
console.log('Native toolbar command gate: PASS');
