import * as vscode from 'vscode';
import { registerNavigationCommands } from './commands/navigation';
import { debugLog, registerConfigChangeListener } from './utils/config';

export function activate(context: vscode.ExtensionContext) {
	debugLog('Activating Symfony UX Twig Component extension');
	
	const commandAndProviderDisposables: Set<vscode.Disposable> = new Set();
	
	function registerCommandsAndProviders() {
		commandAndProviderDisposables.forEach(disposable => {
			disposable.dispose();
			
			const index = context.subscriptions.indexOf(disposable);
			if (index >= 0) {
				context.subscriptions.splice(index, 1);
			}
		});
		
		commandAndProviderDisposables.clear();
		
		const navigationCommands = registerNavigationCommands(context);
		navigationCommands.forEach(cmd => {
			commandAndProviderDisposables.add(cmd);
			context.subscriptions.push(cmd);
		});
		
		debugLog(`Registered ${commandAndProviderDisposables.size} commands and providers`);
	}
	
	registerCommandsAndProviders();
	
	const configListener = registerConfigChangeListener(() => {
		debugLog('Configuration changed, re-registering providers and commands');
		registerCommandsAndProviders();
	});
	
	context.subscriptions.push(configListener);
	
	debugLog('Symfony UX Twig Component extension activated');
}

export function deactivate() {
	debugLog('Symfony UX Twig Component extension deactivated');
}