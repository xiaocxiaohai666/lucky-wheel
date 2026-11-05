/* 一次性自检：验证落点数学与缓动曲线，不参与运行时 */
const fs = require('fs');
const path = require('path');

global.window = global;

const base = path.join(__dirname, '..');
['src/util.js', 'src/config.js', 'src/wheel.js'].forEach(function (file) {
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(base, file), 'utf8'));
});

const App = global.CuteWheel;
const U = App.util;
const TAU = U.TAU;
const math = App.wheelMath;

let fail = 0;
function check(name, cond, detail) {
  if (!cond) { fail++; console.log('FAIL ' + name + ' :: ' + detail); }
}

/* 1. 落点必须精确落在目标扇区内 */
let maxErr = 0;
for (let i = 0; i < 200000; i++) {
  const count = U.randomInt(2, 12);
  const index = U.randomInt(0, count - 1);
  const rotation = U.randomBetween(-100, 100);
  const turns = U.randomInt(4, 9);
  const jitter = U.randomBetween(-1, 1) * App.CONFIG.spin.jitterRatio;

  const t = math.targetDelta(count, index, rotation, turns, jitter);
  const finalRotation = U.mod(rotation + t.delta, TAU);
  const sweep = TAU / count;

  const pointerLocal = U.mod(-Math.PI / 2 - finalRotation, TAU);
  const sectorStart = U.mod(-Math.PI / 2 + index * sweep, TAU);
  const offset = U.mod(pointerLocal - sectorStart, TAU);

  check('in-sector', offset >= 0 && offset < sweep, 'offset=' + offset + ' sweep=' + sweep);
  const expected = sweep * (0.5 + jitter);
  maxErr = Math.max(maxErr, Math.abs(offset - expected));
}

console.log('sector hit: 200000 samples, max |offset - expected| = ' + maxErr.toExponential(3));

/* 2. 增量必须为正且至少转过 turns 整圈 */
for (let i = 0; i < 50000; i++) {
  const count = U.randomInt(2, 12);
  const rotation = U.randomBetween(0, TAU);
  const t = math.targetDelta(count, U.randomInt(0, count - 1), rotation, 6, 0.1);
  check('delta-positive', t.delta > 0, 'delta=' + t.delta);
  check('delta-turns', t.delta >= 6 * TAU, 'delta=' + t.delta);
  check('need-range', t.need >= 0 && t.need < TAU, 'need=' + t.need);
}
console.log('delta: 50000 samples ok (always > 0, >= turns*TAU, need in [0, TAU))');

/* 3. 缓动必须单调递增、起止点精确 */
function ease(t, power, ramp) {
  let v = 1 - Math.pow(1 - t, power);
  if (t < ramp && ramp > 0) v *= 0.25 + 0.75 * (t / ramp);
  return v;
}
for (let p = 0; p <= 40; p++) {
  const power = App.CONFIG.spin.minPower + (App.CONFIG.spin.maxPower - App.CONFIG.spin.minPower) * (p / 40);
  const ramp = App.CONFIG.spin.rampIn;
  let prev = -1;
  for (let s = 0; s <= 400; s++) {
    const v = ease(s / 400, power, ramp);
    check('ease-monotonic', v >= prev - 1e-12, 'power=' + power + ' t=' + (s / 400));
    prev = v;
  }
  check('ease-start', Math.abs(ease(0, power, ramp)) < 1e-12, 'power=' + power);
  check('ease-end', Math.abs(ease(1, power, ramp) - 1) < 1e-12, 'power=' + power);
}
console.log('ease: monotonic + f(0)=0, f(1)=1 across the configured power range');

/* 4. 默认数据合法 */
check('config-range', App.CONFIG.minItems < App.CONFIG.maxItems, 'min/max');
check('defaults-fit', App.CONFIG.defaults.length <= App.CONFIG.maxItems, 'defaults');
check('palette', App.CONFIG.palette.length >= 2, 'palette');

console.log(fail === 0 ? '\nALL CHECKS PASSED' : '\n' + fail + ' CHECKS FAILED');
process.exit(fail === 0 ? 0 : 1);
