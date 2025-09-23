import * as assert from 'assert';
import * as vscode from 'vscode';
import { SettingsManager } from '../../SettingsManager';

suite('SettingsManager Test Suite', () => {
	let context: vscode.ExtensionContext;
	let settingsManager: SettingsManager;

	setup(async () => {
		const ext = vscode.extensions.getExtension('Quali.torque');
		assert.ok(ext);
		await ext.activate();
		
		// Create a mock extension context for testing
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
		context = {
			extension: ext,
			extensionPath: ext.extensionPath,
			extensionUri: ext.extensionUri,
			asAbsolutePath: (relativePath: string) => ext.extensionPath + '/' + relativePath,
			storagePath: '/tmp/storage',
			globalStoragePath: '/tmp/globalStorage',
			logPath: '/tmp/logs',
			globalState: { 
				get: () => undefined, 
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				update: async () => {}, 
				keys: () => [],
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				setKeysForSync: () => {}
			},
			workspaceState: { 
				get: () => undefined, 
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				update: async () => {}, 
				keys: () => [],
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				setKeysForSync: () => {}
			},
			secrets: { 
				// eslint-disable-next-line @typescript-eslint/require-await
				get: async () => undefined, 
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				store: async () => {}, 
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				delete: async () => {} 
			},
			subscriptions: [],
			globalStorageUri: vscode.Uri.file('/tmp'),
			logUri: vscode.Uri.file('/tmp'),
			storageUri: vscode.Uri.file('/tmp'),
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
			environmentVariableCollection: {} as any,
			extensionMode: vscode.ExtensionMode.Test,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
			languageModelAccessInformation: {} as any
		} as unknown as vscode.ExtensionContext;
		
		settingsManager = new SettingsManager(context);
	});

	test('Should initialize SettingsManager', () => {
		assert.ok(settingsManager);
	});

	test('Should handle unknown setting gracefully', async () => {
		try {
			await settingsManager.getSetting('unknownSetting');
			assert.fail('Should have thrown an error');
		} catch (error: unknown) {
			assert.ok(error instanceof Error);
			assert.strictEqual(error.message, 'Unknown setting: unknownSetting');
		}
	});

	test('Should get default URL setting', async () => {
		const url = await settingsManager.getSetting<string>('url');
		// Should return the default value or undefined if not configured
		assert.ok(url === undefined || typeof url === 'string');
	});

	test('Should detect configuration scope changes', () => {
		// Test detectChangedScope with empty array (should not throw)
		const scope = settingsManager.detectChangedScope([]);
		assert.ok(scope === undefined || typeof scope === 'number');
	});
});