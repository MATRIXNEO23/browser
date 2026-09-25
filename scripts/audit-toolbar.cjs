// Exercise the exact toolbar attributes and native controller source.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'apply-fork-overlay.py'), 'utf8');
const controller = source.split('helper = r"""')[1]?.split('"""')[0];
assert.ok(controller, 'native controller must be present');
const markup = source.split('button = """')[1]?.split('"""')[0];
assert.ok(markup, 'toolbar markup must be present');
const clickHandler = markup.match(/onclick="([^"]+)"/)?.[1];
const commandHandler = markup.match(/oncommand="([^"]+)"/)?.[1];
assert.ok(clickHandler && commandHandler, 'toolbar activation must live on the button');
let currentButton = null; // Toolbar creation may happen after the load handler.
let now = 1000;
const context = vm.createContext({
  document: {
    getElementById(id) { return id === 'filum-sidebar-button' ? currentButton : null; },
  },
  window: { addEventListener() {} },
  Date: { now() { return now; } },
  console
});
vm.runInContext(controller, context);
assert.equal(context.FilumPanel.bindButton(), true);
assert.equal(context.window.FilumPanel, context.FilumPanel);
let toggles = 0;
context.FilumPanel.toggle = () => { toggles++; };
currentButton = { id: 'filum-sidebar-button' };
vm.runInContext(clickHandler, vm.createContext({window: context.window, event: {button: 0}}));
assert.equal(toggles, 1, 'button inserted after binding must work');
currentButton = { id: 'filum-sidebar-button' }; // Simulate UI replacement after startup.
now += 600;
vm.runInContext(clickHandler, vm.createContext({window: context.window, event: {button: 0}}));
vm.runInContext(commandHandler, vm.createContext({window: context.window, event: {}}));
assert.equal(toggles, 2, 'click-generated command must not immediately close the sidebar');
now += 600;
vm.runInContext(commandHandler, vm.createContext({window: context.window, event: {}}));
assert.equal(toggles, 3, 'keyboard command must still toggle the sidebar');
vm.runInContext(clickHandler, vm.createContext({window: context.window, event: {button: 1}}));
assert.equal(toggles, 3, 'non-primary click must be ignored');
console.log('Native toolbar replacement/click/keyboard gate: PASS');
