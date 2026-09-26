import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import vm from 'node:vm';

export function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
export const settle = () => new Promise(resolve => setTimeout(resolve, 5));

// Execute the actual hook/provider with deterministic state/effect scheduling.
export function hookHarness(file, mocks = {}, globals = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useContext: () => null,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const { code } = transformSync(readFileSync(file, 'utf8'), { loader: file.endsWith('tsx') ? 'tsx' : 'ts', format: 'cjs', jsx: 'automatic' });
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name in mocks) return mocks[name];
      throw new Error(`Unmocked import: ${name}`);
    },
    console: { error() {}, warn() {}, log() {} }, setTimeout, clearTimeout,
    window: { location: { hash: '' }, addEventListener() {}, removeEventListener() {} },
    structuredClone, setInterval, clearInterval,
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    ...globals,
  }, { filename: file });
  return {
    exports: module.exports,
    render(name, arg = {}) {
      cursor = 0; effects = [];
      const value = module.exports[name](arg);
      effects.forEach(fn => fn());
      return value?.type === 'provider' ? value.props.value : value;
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

export function queryMock(execute) {
  const state = { filters: [], action: 'select' };
  const query = {
    select(columns, options) { state.columns = columns; state.options = options; return query; },
    update(value) { state.action = 'update'; state.value = value; return query; },
    insert(value) { state.action = 'insert'; state.value = value; return query; },
    delete() { state.action = 'delete'; return query; },
    eq(key, value) { state.filters.push([key, value]); return query; },
    order() { return query; }, limit(value) { state.limit = value; return query; },
    single() { state.single = true; return query; }, maybeSingle() { state.single = true; return query; },
    then(resolve, reject) { return Promise.resolve().then(() => execute(state)).then(resolve, reject); },
  };
  return query;
}
