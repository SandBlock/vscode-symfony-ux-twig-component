import * as vscode from 'vscode';
import { CONFIG_KEYS, CONFIG_SECTION, DEFAULT_COMPONENT_PATHS } from './constants';

/**
 * Get the extension configuration
 */
export function getConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
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
 * Register a listener for configuration changes
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
	// Get configuration from both new and old formats
	const newConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
	const oldConfig = vscode.workspace.getConfiguration('symfonyUxTwigComponent');
	
	// Enable debug logging to see what's happening
	console.log('Getting configured paths...');
	
	// Get the componentPaths configuration
	const componentPathsConfig = newConfig.get<any>('componentPaths', []);
	console.log('Component paths config (raw):', JSON.stringify(componentPathsConfig));
	
	// Check if componentPaths is an object with our expected properties
	const isComponentPathsObject = typeof componentPathsConfig === 'object' && 
		!Array.isArray(componentPathsConfig) && 
		componentPathsConfig !== null;
	
	// PHP base paths
	let phpBasePaths: string[] = [];
	
	// First try to get from componentPaths object if it's properly formatted
	if (isComponentPathsObject && Array.isArray(componentPathsConfig.phpBasePaths)) {
		phpBasePaths = componentPathsConfig.phpBasePaths;
		console.log('Using phpBasePaths from componentPaths object:', phpBasePaths);
	}
	// Then try to get from direct configuration
	else if (newConfig.get<string[]>('phpBasePaths', []).length > 0) {
		phpBasePaths = newConfig.get<string[]>('phpBasePaths', []);
		console.log('Using phpBasePaths from direct config:', phpBasePaths);
	}
	// Then try to get from old format
	else if (oldConfig.get<string[]>('phpBasePaths', []).length > 0) {
		phpBasePaths = oldConfig.get<string[]>('phpBasePaths', []);
		console.log('Using phpBasePaths from old config:', phpBasePaths);
	}
	// If not found, use default
	else {
		phpBasePaths = ['src'];
		console.log('Using default phpBasePaths:', phpBasePaths);
	}

	// PHP component paths
	let phpComponentPaths: string[] = [];
	
	// First try to get from componentPaths object if it's properly formatted
	if (isComponentPathsObject && Array.isArray(componentPathsConfig.phpComponentPaths)) {
		phpComponentPaths = componentPathsConfig.phpComponentPaths;
		console.log('Using phpComponentPaths from componentPaths object:', phpComponentPaths);
	}
	// Then try to get from direct configuration
	else if (newConfig.get<string[]>('phpComponentPaths', []).length > 0) {
		phpComponentPaths = newConfig.get<string[]>('phpComponentPaths', []);
		console.log('Using phpComponentPaths from direct config:', phpComponentPaths);
	}
	// Then try to get from old format
	else if (oldConfig.get<string[]>('phpComponentPaths', []).length > 0) {
		phpComponentPaths = oldConfig.get<string[]>('phpComponentPaths', []);
		console.log('Using phpComponentPaths from old config:', phpComponentPaths);
	}
	// If not found, use default
	else {
		phpComponentPaths = [
			'Twig/Component/${namespace}/${componentName}.php',
			'Components/${namespace}/${componentName}.php',
			'Twig/Components/${namespace}/${componentName}.php'
		];
		console.log('Using default phpComponentPaths:', phpComponentPaths);
	}

	// Twig base paths
	let twigBasePaths: string[] = [];
	
	// First try to get from componentPaths object if it's properly formatted
	if (isComponentPathsObject && Array.isArray(componentPathsConfig.twigBasePaths)) {
		twigBasePaths = componentPathsConfig.twigBasePaths;
		console.log('Using twigBasePaths from componentPaths object:', twigBasePaths);
	}
	// Then try to get from direct configuration
	else if (newConfig.get<string[]>('twigBasePaths', []).length > 0) {
		twigBasePaths = newConfig.get<string[]>('twigBasePaths', []);
		console.log('Using twigBasePaths from direct config:', twigBasePaths);
	}
	// Then try to get from old format
	else if (oldConfig.get<string[]>('twigBasePaths', []).length > 0) {
		twigBasePaths = oldConfig.get<string[]>('twigBasePaths', []);
		console.log('Using twigBasePaths from old config:', twigBasePaths);
	}
	// If not found, use default
	else {
		twigBasePaths = ['templates'];
		console.log('Using default twigBasePaths:', twigBasePaths);
	}

	// Twig template paths
	let twigTemplatePaths: string[] = [];
	
	// First try to get from componentPaths object if it's properly formatted
	if (isComponentPathsObject && Array.isArray(componentPathsConfig.twigTemplatePaths)) {
		twigTemplatePaths = componentPathsConfig.twigTemplatePaths;
		console.log('Using twigTemplatePaths from componentPaths object:', twigTemplatePaths);
	}
	// Then try to get from direct configuration
	else if (newConfig.get<string[]>('twigTemplatePaths', []).length > 0) {
		twigTemplatePaths = newConfig.get<string[]>('twigTemplatePaths', []);
		console.log('Using twigTemplatePaths from direct config:', twigTemplatePaths);
	}
	// Then try to get from old format
	else if (oldConfig.get<string[]>('twigTemplatePaths', []).length > 0) {
		twigTemplatePaths = oldConfig.get<string[]>('twigTemplatePaths', []);
		console.log('Using twigTemplatePaths from old config:', twigTemplatePaths);
	}
	// If not found, use default
	else {
		twigTemplatePaths = [
			'components/${namespace}/${componentName}.html.twig',
			'twig/components/${namespace}/${componentName}.html.twig',
			'${namespace}/${componentName}.html.twig'
		];
		console.log('Using default twigTemplatePaths:', twigTemplatePaths);
	}

	// Excluded directory names
	let excludedDirectoryNames: string[] = [];
	
	// First try to get from componentPaths object if it's properly formatted
	if (isComponentPathsObject && Array.isArray(componentPathsConfig.excludedDirectoryNames)) {
		excludedDirectoryNames = componentPathsConfig.excludedDirectoryNames;
		console.log('Using excludedDirectoryNames from componentPaths object:', excludedDirectoryNames);
	}
	// Then try to get from direct configuration
	else if (newConfig.get<string[]>('excludedDirectoryNames', []).length > 0) {
		excludedDirectoryNames = newConfig.get<string[]>('excludedDirectoryNames', []);
		console.log('Using excludedDirectoryNames from direct config:', excludedDirectoryNames);
	}
	// Then try to get from old format
	else if (oldConfig.get<string[]>('excludedDirectoryNames', []).length > 0) {
		excludedDirectoryNames = oldConfig.get<string[]>('excludedDirectoryNames', []);
		console.log('Using excludedDirectoryNames from old config:', excludedDirectoryNames);
	}
	// If not found, use default
	else {
		excludedDirectoryNames = ['src', 'templates', 'components'];
		console.log('Using default excludedDirectoryNames:', excludedDirectoryNames);
	}

	// Fallback template directories
	let fallbackTemplateDirs: string[] = [];
	
	// First try to get from componentPaths object if it's properly formatted
	if (isComponentPathsObject && Array.isArray(componentPathsConfig.fallbackTemplateDirs)) {
		fallbackTemplateDirs = componentPathsConfig.fallbackTemplateDirs;
		console.log('Using fallbackTemplateDirs from componentPaths object:', fallbackTemplateDirs);
	}
	// Then try to get from direct configuration
	else if (newConfig.get<string[]>('fallbackTemplateDirs', []).length > 0) {
		fallbackTemplateDirs = newConfig.get<string[]>('fallbackTemplateDirs', []);
		console.log('Using fallbackTemplateDirs from direct config:', fallbackTemplateDirs);
	}
	// Then try to get from old format
	else if (oldConfig.get<string[]>('fallbackTemplateDirs', []).length > 0) {
		fallbackTemplateDirs = oldConfig.get<string[]>('fallbackTemplateDirs', []);
		console.log('Using fallbackTemplateDirs from old config:', fallbackTemplateDirs);
	}
	// If not found, use default
	else {
		fallbackTemplateDirs = ['templates'];
		console.log('Using default fallbackTemplateDirs:', fallbackTemplateDirs);
	}

	return { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths, excludedDirectoryNames, fallbackTemplateDirs };
} 