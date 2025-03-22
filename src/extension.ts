import * as vscode from 'vscode';
import { registerNavigationCommands } from './commands/navigation';
import { TwigComponentCompletionProvider } from './providers/completion';
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

		// Register completion provider with trigger on any character
		const completionProvider = vscode.languages.registerCompletionItemProvider(
			{ language: 'twig' },
			new TwigComponentCompletionProvider(),
			'<', // Trigger on < to catch <twig:
			':', // Trigger on : to catch namespace:component
			'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
			'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
			'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
			'_'
		);
		commandAndProviderDisposables.add(completionProvider);
		context.subscriptions.push(completionProvider);
		
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