import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerFormattingCommands } from './commands/formatting';
import { registerNavigationCommands } from './commands/navigation';
import { registerFormattingProviders } from './providers/formattingProvider';
import { debugLog, registerConfigChangeListener } from './utils/config';
import { TWIG_COMPONENT_NAMESPACE_REGEX } from './utils/constants';

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
		
		const formattingProviders = registerFormattingProviders(context);
		formattingProviders.forEach(provider => {
			commandAndProviderDisposables.add(provider);
			context.subscriptions.push(provider);
		});
		
		const formattingCommands = registerFormattingCommands(context);
		formattingCommands.forEach(cmd => {
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

function getConfiguredPaths(): {
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

	const excludedDirectoryNames = config.get<string[]>('excludedDirectoryNames', [
		'components', 'src', 'template', 'templates'
	]);

	const fallbackTemplateDirs = config.get<string[]>('fallbackTemplateDirs', [
		'templates'
	]);

	return { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths, excludedDirectoryNames, fallbackTemplateDirs };
}

/**
 * Converts a base path to a namespace format by filtering out excluded directory names
 * and joining the remaining parts with colons.
 */
function basePathToNamespace(basePath: string, excludedDirectoryNames: string[]): string {
	const cleanBasePath = basePath.replace(/\/+$/, '');
	const basePathParts = cleanBasePath.split('/');
	let basePathNamespace = '';

	for (const part of basePathParts) {
		if (part && !excludedDirectoryNames.includes(part.toLowerCase())) {
			basePathNamespace += (basePathNamespace ? ':' : '') + part;
		}
	}
	return basePathNamespace;
}

/**
 * Attempts to find an exact match between a namespace and a base path namespace.
 * Returns the match result or null if no match is found.
 */
function findExactNamespaceMatch(fullNamespace: string, basePathNamespace: string, cleanBasePath: string): { matchedBasePath: string, remainingNamespace: string } | null {
	// 1. Check for exact match (for cases like templates/components/Content)
	if (basePathNamespace && basePathNamespace === fullNamespace) {
		return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
	}

	// 2. Check if the namespace starts with the base path namespace
	if (basePathNamespace && fullNamespace.startsWith(basePathNamespace + ':')) {
		// Remove the matched part from the namespace
		const remainingNamespace = fullNamespace.substring(basePathNamespace.length + 1);
		return { matchedBasePath: cleanBasePath, remainingNamespace };
	}

	// 3. Check if the base path starts with the namespace (reverse match)
	if (basePathNamespace && basePathNamespace.startsWith(fullNamespace + ':')) {
		return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
	}

	// 4. Check if the base path contains the full namespace
	if (basePathNamespace && basePathNamespace.includes(fullNamespace)) {
		return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
	}

	return null;
}

/**
 * Attempts to find partial matches between namespace parts and base path parts.
 * Returns the match result or null if no match is found.
 */
function findPartialNamespaceMatch(namespaceParts: string[], basePath: string, excludedDirectoryNames: string[]): { matchedBasePath: string, remainingNamespace: string } | null {
	const cleanBasePath = basePath.replace(/\/+$/, '');
	const basePathParts = cleanBasePath.split('/').filter(part => part && !excludedDirectoryNames.includes(part.toLowerCase()));

	// Try to match as many parts as possible from the beginning
	let matchedParts = 0;
	for (let i = 0; i < Math.min(basePathParts.length, namespaceParts.length); i++) {
		if (basePathParts[i].toLowerCase() === namespaceParts[i].toLowerCase()) {
			matchedParts++;
		} else {
			break;
		}
	}

	if (matchedParts > 0) {
		const remainingNamespace = namespaceParts.slice(matchedParts).join(':');
		return { matchedBasePath: cleanBasePath, remainingNamespace };
	}

	return null;
}

/**
 * Attempts to find unordered matches between namespace parts and base path parts.
 * Returns the match result or null if no match is found.
 */
function findUnorderedNamespaceMatch(namespaceParts: string[], basePath: string, excludedDirectoryNames: string[]): { matchedBasePath: string, remainingNamespace: string } | null {
	const cleanBasePath = basePath.replace(/\/+$/, '');
	const basePathParts = cleanBasePath.split('/').filter(part => part && !excludedDirectoryNames.includes(part.toLowerCase()));
	const basePathPartsLower = basePathParts.map(part => part.toLowerCase());
	
	const matchedNamespaceParts: string[] = [];
	const unmatchedNamespaceParts: string[] = [];

	for (const part of namespaceParts) {
		if (basePathPartsLower.includes(part.toLowerCase())) {
			matchedNamespaceParts.push(part);
		} else {
			unmatchedNamespaceParts.push(part);
		}
	}

	if (matchedNamespaceParts.length > 0) {
		const remainingNamespace = unmatchedNamespaceParts.join(':');
		return { matchedBasePath: cleanBasePath, remainingNamespace };
	}

	return null;
}

/**
 * Parses a component namespace and tries to match it with a base path.
 * Returns the matched base path and the remaining namespace.
 */
function parseComponentNamespace(fullNamespace: string, basePaths: string[]): {
	matchedBasePath: string | null,
	remainingNamespace: string
} {
	const { excludedDirectoryNames } = getConfiguredPaths();

	const namespaceParts = fullNamespace.split(':');

	for (const basePath of basePaths) {
		const cleanBasePath = basePath.replace(/\/+$/, '');
		const basePathNamespace = basePathToNamespace(cleanBasePath, excludedDirectoryNames);
		
		const exactMatch = findExactNamespaceMatch(fullNamespace, basePathNamespace, cleanBasePath);
		if (exactMatch) {
			return exactMatch;
		}
	}

	for (const basePath of basePaths) {
		const partialMatch = findPartialNamespaceMatch(namespaceParts, basePath, excludedDirectoryNames);
		if (partialMatch) {
			return partialMatch;
		}

		const unorderedMatch = findUnorderedNamespaceMatch(namespaceParts, basePath, excludedDirectoryNames);
		if (unorderedMatch) {
			return unorderedMatch;
		}
	}

	return { matchedBasePath: null, remainingNamespace: fullNamespace };
}

interface ComponentMatch {
	fullNamespace: string;
	componentName: string;
	namespaceStart: number;
	namespaceEnd: number;
	componentStart: number;
	componentEnd: number;
}

interface ComponentFiles {
	fullNamespace: string;
	componentName: string;
	phpFiles: vscode.Uri[];
	twigFiles: vscode.Uri[];
}

/**
 * Detects if the cursor is on a Twig component and extracts its parts
 */
function detectComponentAtPosition(document: vscode.TextDocument, position: vscode.Position): ComponentMatch | undefined {
	const line = document.lineAt(position.line).text;
	const match = TWIG_COMPONENT_NAMESPACE_REGEX.exec(line);

	if (!match) {
		return undefined;
	}

	const startIndex = line.indexOf('<twig:') + '<twig:'.length;
	const namespaceStart = line.indexOf(match[1], startIndex);
	const namespaceEnd = namespaceStart + match[1].length;
	const componentStart = line.indexOf(match[2], namespaceEnd + 1);
	const componentEnd = componentStart + match[2].length;

	const isOnNamespace = position.character >= namespaceStart && position.character <= namespaceEnd;
	const isOnComponent = position.character >= componentStart && position.character <= componentEnd;

	if (!isOnNamespace && !isOnComponent) {
		return undefined;
	}

	return {
		fullNamespace: match[1],
		componentName: match[2],
		namespaceStart,
		namespaceEnd,
		componentStart,
		componentEnd
	};
}

/**
 * Generates possible paths for PHP component files
 */
function generatePhpPaths(
	componentMatch: ComponentMatch,
	phpResult: { matchedBasePath: string | null; remainingNamespace: string },
	phpComponentPaths: string[]
): string[] {
	const paths: string[] = [];

	if (phpResult.matchedBasePath) {
		for (const componentPath of phpComponentPaths) {
			const resolvedPath = path.join(
				phpResult.matchedBasePath,
				componentPath
					.replace('${namespace}', phpResult.remainingNamespace.replace(/:/g, '/'))
					.replace('${componentName}', componentMatch.componentName)
			);
			paths.push(resolvedPath);
		}
	} else {
		const { phpBasePaths } = getConfiguredPaths();
		for (const basePath of phpBasePaths) {
			for (const componentPath of phpComponentPaths) {
				const resolvedPath = path.join(
					basePath,
					componentPath
						.replace('${namespace}', componentMatch.fullNamespace.replace(/:/g, '/'))
						.replace('${componentName}', componentMatch.componentName)
				);
				paths.push(resolvedPath);
			}
		}
	}

	return paths;
}

/**
 * Generates possible paths for Twig template files
 */
function generateTwigPaths(
	componentMatch: ComponentMatch,
	twigResult: { matchedBasePath: string | null; remainingNamespace: string },
	twigTemplatePaths: string[],
	phpResult: { matchedBasePath: string | null; remainingNamespace: string }
): string[] {
	const paths: string[] = [];

	// Add standard template paths
	if (twigResult.matchedBasePath) {
		for (const templatePath of twigTemplatePaths) {
			const resolvedPath = path.join(
				twigResult.matchedBasePath,
				templatePath
					.replace('${namespace}', twigResult.remainingNamespace.replace(/:/g, '/'))
					.replace('${componentName}', componentMatch.componentName)
			);
			paths.push(resolvedPath);
		}
	}

	// Add direct template paths
	const { twigBasePaths } = getConfiguredPaths();
	for (const basePath of twigBasePaths) {
		const directPath = path.join(
			basePath,
			'components',
			componentMatch.fullNamespace.replace(/:/g, '/'),
			`${componentMatch.componentName}.html.twig`
		);
		paths.push(directPath);
	}

	// Try additional patterns if needed
	if (paths.length === 0 || (twigResult.matchedBasePath === null && phpResult.matchedBasePath !== null)) {
		if (phpResult.matchedBasePath) {
			const phpBasePart = phpResult.matchedBasePath.replace(/^src\//, '');
			for (const basePath of twigBasePaths) {
				if (basePath.includes(phpBasePart) || basePath.toLowerCase().includes(phpBasePart.toLowerCase())) {
					for (const templatePath of twigTemplatePaths) {
						const resolvedPath = path.join(
							basePath,
							templatePath
								.replace('${namespace}', phpResult.remainingNamespace.replace(/:/g, '/'))
								.replace('${componentName}', componentMatch.componentName)
						);
						paths.push(resolvedPath);
					}
				}
			}
		}

		// Try simplified paths
		for (const basePath of twigBasePaths) {
			if (basePath.includes(componentMatch.fullNamespace.replace(/:/g, '/')) ||
				basePath.toLowerCase().includes(componentMatch.fullNamespace.replace(/:/g, '/').toLowerCase())) {
				paths.push(path.join(basePath, `${componentMatch.componentName}.html.twig`));
			}
		}
	}

	return paths;
}

/**
 * Searches for files in the workspace
 */
function findFilesInWorkspace(phpPaths: string[], twigPaths: string[]): { phpFiles: vscode.Uri[]; twigFiles: vscode.Uri[] } {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return { phpFiles: [], twigFiles: [] };
	}

	const phpFiles: vscode.Uri[] = [];
	const twigFiles: vscode.Uri[] = [];

	vscode.window.showInformationMessage(phpPaths.join('\n'));

	for (const workspaceFolder of workspaceFolders) {
		// Check PHP files
		for (const possiblePath of phpPaths) {
			const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
			if (fs.existsSync(filePath)) {
				phpFiles.push(vscode.Uri.file(filePath));
			}
		}

		// Check Twig files
		for (const possiblePath of twigPaths) {
			const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
			if (fs.existsSync(filePath)) {
				twigFiles.push(vscode.Uri.file(filePath));
			}
		}
	}

	return { phpFiles, twigFiles };
}

/**
 * Performs an aggressive search for Twig templates when PHP files are found but no templates
 */
function performAggressiveTemplateSearch(
	componentMatch: ComponentMatch,
	foundPhpFiles: vscode.Uri[]
): vscode.Uri[] {
	if (foundPhpFiles.length === 0) {
		return [];
	}

	const { fallbackTemplateDirs, twigBasePaths } = getConfiguredPaths();
	const foundTwigFiles: vscode.Uri[] = [];

	for (const workspaceFolder of vscode.workspace.workspaceFolders || []) {
		for (const templateDir of fallbackTemplateDirs) {
			const templateBasePath = path.join(workspaceFolder.uri.fsPath, templateDir);
			if (!fs.existsSync(templateBasePath)) {
				continue;
			}

			for (const basePath of twigBasePaths) {
				// Check direct path
				const possiblePath = path.join(basePath, `${componentMatch.componentName}.html.twig`);
				const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
				if (fs.existsSync(filePath)) {
					foundTwigFiles.push(vscode.Uri.file(filePath));
				}

				// Check components path
				const componentsPath = path.join(
					basePath,
					'components',
					componentMatch.fullNamespace.replace(/:/g, '/'),
					`${componentMatch.componentName}.html.twig`
				);
				const componentsFilePath = path.join(workspaceFolder.uri.fsPath, componentsPath);
				if (fs.existsSync(componentsFilePath)) {
					foundTwigFiles.push(vscode.Uri.file(componentsFilePath));
				}
			}
		}
	}

	return foundTwigFiles;
}

/**
 * Find component files based on the cursor position
 */
async function findComponentFiles(document: vscode.TextDocument, position: vscode.Position): Promise<ComponentFiles | undefined> {
	const componentMatch = detectComponentAtPosition(document, position);
	if (!componentMatch) {
		return undefined;
	}

	const { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths } = getConfiguredPaths();
	const phpResult = parseComponentNamespace(componentMatch.fullNamespace, phpBasePaths);
	const twigResult = parseComponentNamespace(componentMatch.fullNamespace, twigBasePaths);

	const phpPaths = generatePhpPaths(componentMatch, phpResult, phpComponentPaths);
	const twigPaths = generateTwigPaths(componentMatch, twigResult, twigTemplatePaths, phpResult);

	const { phpFiles, twigFiles } = findFilesInWorkspace(phpPaths, twigPaths);

	// If we found PHP files but no Twig files, try aggressive search
	if (phpFiles.length > 0 && twigFiles.length === 0) {
		const additionalTwigFiles = performAggressiveTemplateSearch(componentMatch, phpFiles);
		twigFiles.push(...additionalTwigFiles);
	}

	if (phpFiles.length === 0 && twigFiles.length === 0) {
		return undefined;
	}

	return {
		fullNamespace: componentMatch.fullNamespace,
		componentName: componentMatch.componentName,
		phpFiles,
		twigFiles
	};
}

// Navigate to Twig component
async function navigateToTwigComponent(editor: vscode.TextEditor, isModifierClick: boolean = false) {
	const position = editor.selection.active;
	const document = editor.document;

	const result = await findComponentFiles(document, position);
	if (!result) {
		// vscode.window.showInformationMessage('No Twig component found at cursor position');
		return;
	}

	const { phpFiles, twigFiles } = result;

	// If modifier key is pressed (Cmd on macOS, Alt on Windows/Linux), show the quick pick menu
	if (isModifierClick || (phpFiles.length > 0 && twigFiles.length > 0)) {
		// Create quick pick items
		const items: vscode.QuickPickItem[] = [];

		if (phpFiles.length > 0) {
			items.push({
				label: "$(code) Open Component File",
				description: path.basename(phpFiles[0].fsPath),
				detail: phpFiles[0].fsPath
			});
		}

		if (twigFiles.length > 0) {
			items.push({
				label: "$(file) Open Template File",
				description: path.basename(twigFiles[0].fsPath),
				detail: twigFiles[0].fsPath
			});
		}

		if (phpFiles.length > 0 && twigFiles.length > 0) {
			items.push({
				label: "$(files) Open Both Files",
				description: "Open both component and template files",
				detail: "This will open both files in separate tabs"
			});
		}

		// Create a QuickPick
		const quickPick = vscode.window.createQuickPick();
		quickPick.items = items;
		quickPick.placeholder = "Select which file(s) to open";

		// Handle selection
		quickPick.onDidAccept(() => {
			const selection = quickPick.selectedItems[0];
			if (!selection) {
				console.log('No selection made');
				quickPick.hide();
				return;
			}

			console.log(`User selected: ${selection.label}`);
			quickPick.hide();

			if (selection.label.includes("Open Component File") && phpFiles.length > 0) {
				// Open component file
				vscode.window.showTextDocument(phpFiles[0]);
			} else if (selection.label.includes("Open Template File") && twigFiles.length > 0) {
				// Open template file
				vscode.window.showTextDocument(twigFiles[0]);
			} else if (selection.label.includes("Open Both Files")) {
				// Open both files
				if (twigFiles.length > 0) {
					vscode.window.showTextDocument(twigFiles[0], { preview: false });
				}
				if (phpFiles.length > 0) {
					vscode.window.showTextDocument(phpFiles[0]);
				}
			}
		});

		quickPick.show();
	} else {
		// If only one type of file is found and modifier key is not pressed, open it directly
		if (phpFiles.length > 0) {
			vscode.window.showTextDocument(phpFiles[0]);
		} else if (twigFiles.length > 0) {
			vscode.window.showTextDocument(twigFiles[0]);
		}
	}
}

class TwigComponentDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        // Find the files but don't navigate immediately
        const result = await findComponentFiles(document, position);
        if (!result) {
            return undefined;
        }
        
        const { phpFiles, twigFiles } = result;
        
        // Use a timeout to defer the quick pick menu to ensure it only appears on click, not hover
        // This is a workaround to distinguish between hover and click
        setTimeout(async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === document) {
                // Show the quick pick menu with isModifierClick=true to always show options
                await navigateToTwigComponent(editor, true);
            }
        }, 100);
        
        // Return a dummy location to satisfy the definition provider interface
        // We're not actually navigating here - our timeout will handle that
        if (phpFiles.length > 0) {
            return new vscode.Location(phpFiles[0], new vscode.Position(0, 0));
        } else if (twigFiles.length > 0) {
            return new vscode.Location(twigFiles[0], new vscode.Position(0, 0));
        }
        
        return undefined;
    }
}