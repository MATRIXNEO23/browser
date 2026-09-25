// Exercise the exact native controller source with a replaced toolbar node.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'apply-fork-overlay.py'), 'utf8');
const controller = source.split('helper = r"""')[1]?.split('"""')[0];
assert.ok(controller, 'native controller must be present');
const listeners = new Map();
let currentButton = null; // Toolbar creation may happen after the load handler.
let now = 1000;
const context = vm.createContext({
  document: {
    getElementById(id) { return id === 'filum-sidebar-button' ? currentButton : null; },
    addEventListener(type, handler) { listeners.set(type, handler); }
  },
  window: { addEventListener() {} },
  Date: { now() { return now; } },
  console
});
vm.runInContext(controller, context);
assert.equal(context.FilumPanel.bindButton(), true);
let toggles = 0;
context.FilumPanel.toggle = () => { toggles++; };
currentButton = { id: 'filum-sidebar-button' };
listeners.get('click')({ button: 0, target: currentButton });
assert.equal(toggles, 1, 'button inserted after binding must work');
currentButton = { id: 'filum-sidebar-button' }; // Simulate UI replacement after startup.
now += 600;
const iconInShadowTree = { id: 'filum-button-icon' };
listeners.get('click')({
  button: 0,
  target: iconInShadowTree,
  composedPath() { return [iconInShadowTree, currentButton, context.document]; }
});
listeners.get('command')({ target: currentButton });
assert.equal(toggles, 2, 'click on the internal icon must open only once');
now += 600;
listeners.get('command')({ target: currentButton });
assert.equal(toggles, 3, 'keyboard command must still toggle the sidebar');
listeners.get('click')({ button: 1, target: currentButton });
assert.equal(toggles, 3, 'non-primary click must be ignored');
listeners.get('click')({
  button: 0, target: iconInShadowTree,
  composedPath() { return [iconInShadowTree, context.document]; }
});
assert.equal(toggles, 3, 'unrelated toolbar icons must be ignored');
console.log('Native toolbar replacement/click/keyboard gate: PASS');
