import * as vscode from 'vscode';
import { CONFIG_SECTION, CONFIG_KEYS, DEFAULT_COMPONENT_PATHS, FORMATTING_STYLES } from './constants';

/**
 * Get the extension configuration
 */
export function getConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

/**
 * Get formatting configuration
 */
export function getFormattingConfig() {
	const config = getConfig();
	
	return {
		enabled: config.get<boolean>(CONFIG_KEYS.ENABLED, true),
		formattingStyle: config.get<string>(CONFIG_KEYS.FORMATTING_STYLE, FORMATTING_STYLES.MULTILINE),
		runLast: config.get<boolean>(CONFIG_KEYS.RUN_LAST, true),
		timeout: config.get<number>(CONFIG_KEYS.TIMEOUT, 300)
	};
}

/**
 * Get component paths configuration
 */
export function getComponentPaths(): string[] {
	const config = getConfig();
	return config.get<string[]>(CONFIG_KEYS.COMPONENT_PATHS, DEFAULT_COMPONENT_PATHS);
}

/**
 * Get debug mode configuration
 */
export function isDebugEnabled(): boolean {
	const config = getConfig();
	return config.get<boolean>(CONFIG_KEYS.DEBUG, false);
}

/**
 * Log debug message if debug mode is enabled
 */
export function debugLog(message: string, ...args: any[]): void {
	if (isDebugEnabled()) {
		console.log(`[Symfony UX Twig Component] ${message}`, ...args);
	}
}

/**
 * Update a configuration setting
 */
export async function updateConfig<T>(key: string, value: T): Promise<void> {
	const config = getConfig();
	await config.update(key, value, vscode.ConfigurationTarget.Global);
}

/**
 * Register configuration change listener
 */
export function registerConfigChangeListener(callback: () => void): vscode.Disposable {
	return vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration(CONFIG_SECTION)) {
			callback();
		}
	});
}

// Get configured paths
export function getConfiguredPaths(): {
	phpBasePaths: string[],
	phpComponentPaths: string[],
	twigBasePaths: string[],
	twigTemplatePaths: string[],
	excludedDirectoryNames: string[],
	fallbackTemplateDirs: string[]
} {
	const config = vscode.workspace.getConfiguration('symfonyUxTwigComponent');

	const phpBasePaths = config.get<string[]>('phpBasePaths', [
		'src'
	]);

	const phpComponentPaths = config.get<string[]>('phpComponentPaths', [
		'Twig/Component/${namespace}/${componentName}.php',
		'Components/${namespace}/${componentName}.php',
		'Twig/Components/${namespace}/${componentName}.php'
	]);

	const twigBasePaths = config.get<string[]>('twigBasePaths', [
		'templates'
	]);

	const twigTemplatePaths = config.get<string[]>('twigTemplatePaths', [
		'components/${namespace}/${componentName}.html.twig',
		'twig/components/${namespace}/${componentName}.html.twig',
		'${namespace}/${componentName}.html.twig'
	]);

	// Get excluded directory names for namespace parsing
	const excludedDirectoryNames = config.get<string[]>('excludedDirectoryNames', [
		'src', 'templates', 'components'
	]);

	// Get fallback template directories for aggressive search
	const fallbackTemplateDirs = config.get<string[]>('fallbackTemplateDirs', [
		'templates'
	]);

	return { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths, excludedDirectoryNames, fallbackTemplateDirs };
} 