const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/BouncingDots.tsx`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount(reduceMotion) {
  const effects = [], animations = [];
  let started = 0, stopped = 0;
  const native = {
    View: 'View', StyleSheet: { create: value => value }, Easing: { sin: 'sin', inOut: value => value },
    AccessibilityInfo: { isReduceMotionEnabled: async () => reduceMotion, addEventListener: () => ({ remove() {} }) },
    Animated: {
      Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }, View: 'Dot',
      delay: duration => ({ delay: duration }), timing: (dot, options) => ({ ...options }),
      sequence: steps => steps, loop: steps => steps,
      parallel: loops => { animations.push(loops); return { start() { started++; }, stop() { stopped++; } }; },
    },
  };
  const result = {};
  vm.runInNewContext(code, { exports: result, require: name => name === 'react-native' ? native : name === 'react' ? {
    useRef: initial => ({ current: initial }), useState: () => [reduceMotion, () => {}], useEffect: effect => effects.push(effect),
  } : { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } });
  const tree = result.default();
  const cleanup = effects.map(effect => effect());
  return { tree, animations, started: () => started, stopped: () => stopped, unmount: () => cleanup.forEach(fn => fn?.()) };
}
test('three dots bounce at staggered offsets on the native driver and stop on unmount', () => {
  const ui = mount(false);
  assert.equal(ui.tree.props.children.length, 3);
  assert.equal(ui.tree.props.accessibilityLabel, 'Agent preparing response');
  assert.equal(ui.started(), 1);
  assert.deepEqual(Array.from(ui.animations[0], loop => loop[0].delay), [0, 120, 240]);
  for (const loop of ui.animations[0]) {
    assert.equal(loop[1].useNativeDriver, true);
    assert.equal(loop[1].isInteraction, false);
  }
  ui.unmount();
  assert.equal(ui.stopped(), 1);
});
test('reduced motion keeps the dots visible without starting animation', () => {
  const ui = mount(true);
  assert.equal(ui.tree.props.children.length, 3);
  assert.equal(ui.started(), 0);
  ui.unmount();
});
