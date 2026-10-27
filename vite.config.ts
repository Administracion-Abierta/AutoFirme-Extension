import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => mode === 'extension' ? {
	root: 'extension',
	base: './',
	// Chrome rejects packaged files whose names start with "_" (e.g. static/_headers)
	// and the extension needs only a few of the web app's public assets.
	publicDir: false,
	plugins: [tailwindcss(), svelte()],
	resolve: { alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) } },
	build: { outDir: '../dist/extension', emptyOutDir: true, target: 'chrome116' }
} : {
	// Default mode only exists for the test runner; the extension is the sole build target.
	plugins: [tailwindcss(), svelte()],
	resolve: {
		alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) },
		// Vitest resolves the browser build of Svelte so components can actually mount.
		...(process.env.VITEST ? { conditions: ['browser'] } : {})
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['src/test-setup.ts'],
		include: ['src/**/*.test.ts'],
		// The crypto here (PBKDF2 with 250k iterations for sealing, WebCrypto key imports) takes
		// seconds when the files run in parallel, which trips the 5s default on a loaded machine.
		// Assertions stay as they are; only the allowance is explicit.
		testTimeout: 20_000,
		hookTimeout: 120_000
	}
});
