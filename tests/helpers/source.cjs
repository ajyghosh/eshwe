const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function loadSource(name, mocks = {}, globals = {}) {
  const filename = path.resolve(name);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, process, console, setTimeout, clearTimeout, URL, URLSearchParams, ...globals, require(id) {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/')) return loadSource(`src/${id.slice(2)}.ts`, mocks, globals);
    return require(id);
  } }, { filename });
  return module.exports;
}
module.exports = { loadSource };
