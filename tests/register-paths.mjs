import { registerHooks } from 'node:module';
import path from 'node:path';

// Match Vite's source alias when running the existing TypeScript tests in Node.
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
