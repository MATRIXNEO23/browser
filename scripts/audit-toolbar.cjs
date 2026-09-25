// Exercise the native widget callback used by the toolbar, including a new window.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'apply-fork-overlay.py'), 'utf8');
const controller = source.split('helper = r"""')[1]?.split('"""')[0];
assert.ok(controller, 'native controller must be present');
let widget;
let button;
const context = vm.createContext({
  document: {getElementById(id) { return id === 'filum-sidebar-button' ? button : null; }},
  window: {addEventListener() {}},
  CustomizableUI: {
    AREA_NAVBAR: 'nav-bar',
    getWidget(id) { return widget?.id === id ? widget : null; },
    createWidget(spec) { widget = spec; button = {id: spec.id, click() { spec.onCommand({target: this}); }}; }
  },
  console
});
vm.runInContext(controller, context);
assert.equal(context.FilumPanel.bindButton(), true);
assert.equal(widget.id, 'filum-sidebar-button');
assert.equal(widget.defaultArea, 'nav-bar');
assert.equal(widget.removable, false);
assert.equal(context.window.FilumPanel, context.FilumPanel);
let firstWindowToggles = 0;
context.FilumPanel.toggle = () => { firstWindowToggles++; };
button.ownerGlobal = context.window;
button.click();
assert.equal(firstWindowToggles, 1, 'widget activation must toggle the initial window');
const secondWindow = {FilumPanel: {toggle() { secondWindow.toggles++; }}, toggles: 0};
widget.onCommand({target: {ownerGlobal: secondWindow}});
assert.equal(secondWindow.toggles, 1, 'widget activation must use the clicked window');
assert.equal(firstWindowToggles, 1, 'another window must not toggle the initial one');
console.log('Native CustomizableUI toolbar command gate: PASS');
