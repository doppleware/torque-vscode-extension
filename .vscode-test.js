const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
	files: 'out/test/**/*.test.js',
	workspaceFolder: './test-workspace',
	mocha: {
		ui: 'tdd',
		timeout: 20000
	},
	// CI-specific configuration for headless execution
	launchArgs: process.env.CI ? [
		'--no-sandbox',
		'--disable-dev-shm-usage',
		'--disable-gpu',
		'--disable-extensions',
		'--disable-workspace-trust'
	] : []
});