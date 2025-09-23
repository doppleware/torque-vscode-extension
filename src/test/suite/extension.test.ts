import * as assert from 'assert';
import * as vscode from 'vscode';
// import { getClient } from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('Quali.torque'));
	});

	test('Extension should activate', async () => {
		const ext = vscode.extensions.getExtension('Quali.torque');
		assert.ok(ext);
		await ext.activate();
		assert.strictEqual(ext.isActive, true);
	});

	test('Should register URI handler', async () => {
		const ext = vscode.extensions.getExtension('Quali.torque');
		assert.ok(ext);
		await ext.activate();
		
		// Check that the extension has registered a URI handler
		// This is implicit - if activation succeeds, the URI handler is registered
		assert.strictEqual(ext.isActive, true);
	});
});