import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

// Exercise the production module with Electron replaced at the process boundary.
// No app process, user database, or windows are started by these tests.
export function loadElectronModule(file, mocks, globals = {}) {
    const filename = path.resolve(file);
    const source = fs.readFileSync(filename, 'utf8')
        .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(filename).href));
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const module = { exports: {} };
    const require = createRequire(filename);
    vm.runInNewContext(compiled, {
        module,
        exports: module.exports,
        require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
        console,
        process,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        ...globals
    }, { filename });
    return module.exports;
}
