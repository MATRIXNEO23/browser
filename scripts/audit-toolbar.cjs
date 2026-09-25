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
  let panelBrowser = null;
  const button = {
    addEventListener(type, callback) {
      assert.equal(type, 'command');
      listeners.push(callback);
    },
    click() { listeners.forEach(callback => callback()); }
  };
  const window = {addEventListener() {}};
  const context = vm.createContext({
    document: {getElementById(id) {
      if (id === 'filum-sidebar-button') return button;
      if (id === 'filum-panel-browser') return panelBrowser;
      return null;
    }},
    window,
    Services: {prefs: {getBoolPref() { return false; }}},
    setTimeout,
    console
  });
  vm.runInContext(controller, context);
  assert.equal(context.FilumPanel.bindButton(), true);
  assert.equal(listeners.length, 1);
  assert.equal(window.FilumPanel, context.FilumPanel);
  return {button, panel: context.FilumPanel, setBrowser(value) { panelBrowser = value; }};
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
setTimeout(() => first.setBrowser({
  currentURI: {spec: 'moz-extension://test/sidebar.html?selftest=1'},
  addEventListener() {}
}), 20);
first.panel.waitForPanelLoad('moz-extension://test/sidebar.html').then(uri => {
  assert.match(uri, /sidebar\.html/);
  console.log('Native toolbar command and asynchronous panel gate: PASS');
}).catch(error => { console.error(error); process.exitCode = 1; });
