import { registerHooks } from 'node:module';
import path from 'node:path';

// Resolve the application's TypeScript alias in Node regression tests.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) {
            const target = new URL(`../src/${specifier.slice(2)}`, import.meta.url);
            if (!path.extname(target.pathname)) target.pathname += '.ts';
            return nextResolve(target.href, context);
        }
        return nextResolve(specifier, context);
    }
});
