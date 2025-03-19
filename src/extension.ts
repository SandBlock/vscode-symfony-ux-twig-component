import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { registerFormattingProviders } from './providers/formattingProvider';
import { registerFormattingCommands } from './commands/formatting';
import { registerNavigationCommands } from './commands/navigation';
import { debugLog, registerConfigChangeListener } from './utils/config';
import { TWIG_COMPONENT_REGEX, TWIG_COMPONENT_NAMESPACE_REGEX, TWIG_ATTRIBUTE_REGEX, FLATTENED_COMPONENT_REGEX } from './utils/constants';

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

	// Skip empty parts and convert to namespace format
	for (const part of basePathParts) {
		if (part && !excludedDirectoryNames.includes(part.toLowerCase())) {
			basePathNamespace += (basePathNamespace ? ':' : '') + part;
		}
	}

	console.log(`Base path: ${cleanBasePath}, converted to namespace: ${basePathNamespace}`);
	return basePathNamespace;
}

/**
 * Attempts to find an exact match between a namespace and a base path namespace.
 * Returns the match result or null if no match is found.
 */
function findExactMatch(fullNamespace: string, basePathNamespace: string, cleanBasePath: string): { matchedBasePath: string, remainingNamespace: string } | null {
	// 1. Check for exact match (for cases like templates/components/Content)
	if (basePathNamespace && basePathNamespace === fullNamespace) {
		console.log(`Exact match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
		return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
	}

	// 2. Check if the namespace starts with the base path namespace
	if (basePathNamespace && fullNamespace.startsWith(basePathNamespace + ':')) {
		// Remove the matched part from the namespace
		const remainingNamespace = fullNamespace.substring(basePathNamespace.length + 1);
		console.log(`Prefix match found! Base path: ${cleanBasePath}, remaining namespace: ${remainingNamespace}`);
		return { matchedBasePath: cleanBasePath, remainingNamespace };
	}

	// 3. Check if the base path starts with the namespace (reverse match)
	if (basePathNamespace && basePathNamespace.startsWith(fullNamespace + ':')) {
		console.log(`Reverse match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
		return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
	}

	// 4. Check if the base path contains the full namespace
	if (basePathNamespace && basePathNamespace.includes(fullNamespace)) {
		console.log(`Contained match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
		return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
	}

	return null;
}

/**
 * Attempts to find partial matches between namespace parts and base path parts.
 * Returns the match result or null if no match is found.
 */
function findPartialMatch(namespaceParts: string[], basePath: string, excludedDirectoryNames: string[]): { matchedBasePath: string, remainingNamespace: string } | null {
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
		console.log(`Partial match found! Base path: ${cleanBasePath}, matched parts: ${matchedParts}, remaining namespace: ${remainingNamespace}`);
		return { matchedBasePath: cleanBasePath, remainingNamespace };
	}

	return null;
}

/**
 * Attempts to find unordered matches between namespace parts and base path parts.
 * Returns the match result or null if no match is found.
 */
function findUnorderedMatch(namespaceParts: string[], basePath: string, excludedDirectoryNames: string[]): { matchedBasePath: string, remainingNamespace: string } | null {
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
		console.log(`Partial unordered match found! Base path: ${cleanBasePath}, matched parts: ${matchedNamespaceParts.join(':')}, remaining namespace: ${remainingNamespace}`);
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

	// Convert namespace format (e.g., "Content:Menu") to path format (e.g., "Content/Menu")
	const namespaceParts = fullNamespace.split(':');

	// Try to match with base paths - first try exact matches
	for (const basePath of basePaths) {
		const cleanBasePath = basePath.replace(/\/+$/, '');
		const basePathNamespace = basePathToNamespace(cleanBasePath, excludedDirectoryNames);
		
		// Try to find exact matches first
		const exactMatch = findExactMatch(fullNamespace, basePathNamespace, cleanBasePath);
		if (exactMatch) {
			return exactMatch;
		}
	}

	// Try to match partial paths (for more complex directory structures)
	for (const basePath of basePaths) {
		// Try to match parts in order
		const partialMatch = findPartialMatch(namespaceParts, basePath, excludedDirectoryNames);
		if (partialMatch) {
			return partialMatch;
		}

		// Try to match parts in any order
		const unorderedMatch = findUnorderedMatch(namespaceParts, basePath, excludedDirectoryNames);
		if (unorderedMatch) {
			return unorderedMatch;
		}
	}

	// If no match found, return the full namespace
	console.log(`No match found, using full namespace: ${fullNamespace}`);
	return { matchedBasePath: null, remainingNamespace: fullNamespace };
}

// Find component files based on the cursor position
async function findComponentFiles(document: vscode.TextDocument, position: vscode.Position): Promise<{
	fullNamespace: string,
	componentName: string,
	phpFiles: vscode.Uri[],
	twigFiles: vscode.Uri[]
} | undefined> {
	const line = document.lineAt(position.line).text;
	console.log(`Clicked line: ${line}`);

	const match = TWIG_COMPONENT_NAMESPACE_REGEX.exec(line);

	if (!match) {
		console.log('No component tag match found in line');
		return undefined;
	}

	console.log(`Component match: ${JSON.stringify(match)}`);

	// Get the positions of both namespace and component name
	const namespaceStart = line.indexOf(match[1], match.index + 6); // 6 is the length of "<twig:"
	const namespaceEnd = namespaceStart + match[1].length;

	const componentStart = line.indexOf(match[2], namespaceEnd + 1); // +1 for the colon
	const componentEnd = componentStart + match[2].length;

	console.log(`Namespace position: ${namespaceStart}-${namespaceEnd}, Component position: ${componentStart}-${componentEnd}, cursor position: ${position.character}`);

	// Check if cursor is on either the namespace or component name
	const isOnNamespace = position.character >= namespaceStart && position.character <= namespaceEnd;
	const isOnComponent = position.character >= componentStart && position.character <= componentEnd;

	if (!isOnNamespace && !isOnComponent) {
		console.log('Cursor not on namespace or component name');
		return undefined;
	}

	// Parse the component parts
	const fullNamespace = match[1];
	const componentName = match[2];

	console.log(`Full namespace: ${fullNamespace}, Component name: ${componentName}`);

	// Get configured paths
	const { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths } = getConfiguredPaths();

	console.log(`PHP base paths: ${JSON.stringify(phpBasePaths)}`);
	console.log(`PHP component paths: ${JSON.stringify(phpComponentPaths)}`);
	console.log(`Twig base paths: ${JSON.stringify(twigBasePaths)}`);
	console.log(`Twig template paths: ${JSON.stringify(twigTemplatePaths)}`);

	// Parse the namespace and match with base paths
	const phpResult = parseComponentNamespace(fullNamespace, phpBasePaths);
	const twigResult = parseComponentNamespace(fullNamespace, twigBasePaths);

	console.log(`PHP result: ${JSON.stringify(phpResult)}`);
	console.log(`Twig result: ${JSON.stringify(twigResult)}`);

	// Search for the component in possible locations
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		console.log('No workspace folders found');
		return undefined;
	}

	// Generate all possible paths
	const phpPossiblePaths: string[] = [];
	const twigPossiblePaths: string[] = [];

	// Add PHP paths
	if (phpResult.matchedBasePath) {
		for (const componentPath of phpComponentPaths) {
			const resolvedPath = path.join(
				phpResult.matchedBasePath,
				componentPath
					.replace('${namespace}', phpResult.remainingNamespace.replace(/:/g, '/'))
					.replace('${componentName}', componentName)
			);
			phpPossiblePaths.push(resolvedPath);
			console.log(`Added PHP path: ${resolvedPath}`);
		}
	}

	// Add Twig paths
	if (twigResult.matchedBasePath) {
		for (const templatePath of twigTemplatePaths) {
			const resolvedPath = path.join(
				twigResult.matchedBasePath,
				templatePath
					.replace('${namespace}', twigResult.remainingNamespace.replace(/:/g, '/'))
					.replace('${componentName}', componentName)
			);
			twigPossiblePaths.push(resolvedPath);
			console.log(`Added Twig path: ${resolvedPath}`);
		}
	}

	// If no base path matched, try all combinations
	if (!phpResult.matchedBasePath && !twigResult.matchedBasePath) {
		console.log('No base path matched, trying all combinations');
		// For PHP
		for (const basePath of phpBasePaths) {
			for (const componentPath of phpComponentPaths) {
				const resolvedPath = path.join(
					basePath,
					componentPath
						.replace('${namespace}', fullNamespace.replace(/:/g, '/'))
						.replace('${componentName}', componentName)
				);
				phpPossiblePaths.push(resolvedPath);
				console.log(`Added fallback PHP path: ${resolvedPath}`);
			}
		}

		// For Twig
		for (const basePath of twigBasePaths) {
			for (const templatePath of twigTemplatePaths) {
				const resolvedPath = path.join(
					basePath,
					templatePath
						.replace('${namespace}', fullNamespace.replace(/:/g, '/'))
						.replace('${componentName}', componentName)
				);
				twigPossiblePaths.push(resolvedPath);
				console.log(`Added fallback Twig path: ${resolvedPath}`);
			}
		}
	}

	// Add direct template paths for the specific case of templates/components/[namespace]/[componentName].html.twig
	// This is a special case for the user's specific configuration
	for (const basePath of twigBasePaths) {
		const directPath = path.join(
			basePath,
			'components',
			fullNamespace.replace(/:/g, '/'),
			`${componentName}.html.twig`
		);
		twigPossiblePaths.push(directPath);
		console.log(`Added direct Twig path: ${directPath}`);
	}

	// Try additional template path patterns for complex structures
	// This is a fallback for cases where the standard patterns don't work
	if (twigPossiblePaths.length === 0 || (twigResult.matchedBasePath === null && phpResult.matchedBasePath !== null)) {
		console.log('Trying additional template path patterns');

		// Try to use the PHP namespace result to find the template
		if (phpResult.matchedBasePath) {
			// Extract the relevant part from the PHP base path
			const phpBasePart = phpResult.matchedBasePath.replace(/^src\//, '');
			console.log(`Extracted PHP base part: ${phpBasePart}`);

			// Try to find matching template paths
			for (const basePath of twigBasePaths) {
				// Check if this base path might contain our component
				if (basePath.includes(phpBasePart) ||
					basePath.toLowerCase().includes(phpBasePart.toLowerCase())) {

					console.log(`Found potential matching template base path: ${basePath}`);

					for (const templatePath of twigTemplatePaths) {
						const resolvedPath = path.join(
							basePath,
							templatePath
								.replace('${namespace}', phpResult.remainingNamespace.replace(/:/g, '/'))
								.replace('${componentName}', componentName)
						);
						twigPossiblePaths.push(resolvedPath);
						console.log(`Added additional Twig path: ${resolvedPath}`);
					}
				}
			}
		}

		// Try with just the component name (for cases where the template is directly in the namespace directory)
		for (const basePath of twigBasePaths) {
			if (basePath.includes(fullNamespace.replace(/:/g, '/')) ||
				basePath.toLowerCase().includes(fullNamespace.replace(/:/g, '/').toLowerCase())) {

				const resolvedPath = path.join(basePath, `${componentName}.html.twig`);
				twigPossiblePaths.push(resolvedPath);
				console.log(`Added simplified Twig path: ${resolvedPath}`);
			}
		}
	}

	console.log(`Checking ${phpPossiblePaths.length + twigPossiblePaths.length} possible paths`);

	// Check all possible paths and find existing files
	const foundPhpFiles: vscode.Uri[] = [];
	const foundTwigFiles: vscode.Uri[] = [];

	for (const workspaceFolder of workspaceFolders) {
		// Check PHP files
		for (const possiblePath of phpPossiblePaths) {
			const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
			console.log(`Checking PHP path: ${filePath}`);

			if (fs.existsSync(filePath)) {
				console.log(`Found PHP file at: ${filePath}`);
				foundPhpFiles.push(vscode.Uri.file(filePath));
			}
		}

		// Check Twig files
		for (const possiblePath of twigPossiblePaths) {
			const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
			console.log(`Checking Twig path: ${filePath}`);

			if (fs.existsSync(filePath)) {
				console.log(`Found Twig file at: ${filePath}`);
				foundTwigFiles.push(vscode.Uri.file(filePath));
			}
		}
	}

	// If we found PHP files but no Twig files, try a more aggressive search
	if (foundPhpFiles.length > 0 && foundTwigFiles.length === 0) {
		console.log('Found PHP files but no Twig files, trying more aggressive search');

		// Get fallback template directories from configuration
		const { fallbackTemplateDirs } = getConfiguredPaths();

		// Try to find the template by searching for the component name in all template directories
		for (const workspaceFolder of workspaceFolders) {
			// Check in configured fallback template directories
			for (const templateDir of fallbackTemplateDirs) {
				const templateBasePath = path.join(workspaceFolder.uri.fsPath, templateDir);

				// Skip if the directory doesn't exist
				if (!fs.existsSync(templateBasePath)) {
					continue;
				}

				// Try to find the template by searching for files with the component name
				const searchPattern = `**/${componentName}.html.twig`;

				try {
					// This is a simplified version - in a real implementation, you'd use a proper glob search
					// For demonstration purposes, we're just showing the concept
					console.log(`Would search for ${searchPattern} in ${templateBasePath}`);

					// For each twigBasePath, check if there's a file with the component name
					for (const basePath of twigBasePaths) {
						const possiblePath = path.join(basePath, `${componentName}.html.twig`);
						const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);

						console.log(`Checking additional Twig path: ${filePath}`);

						if (fs.existsSync(filePath)) {
							console.log(`Found Twig file at: ${filePath}`);
							foundTwigFiles.push(vscode.Uri.file(filePath));
						}

						// Check for the specific case of templates/components/[namespace]/[componentName].html.twig
						const componentsPath = path.join(basePath, 'components', fullNamespace.replace(/:/g, '/'), `${componentName}.html.twig`);
						const componentsFilePath = path.join(workspaceFolder.uri.fsPath, componentsPath);

						console.log(`Checking specific components path: ${componentsFilePath}`);

						if (fs.existsSync(componentsFilePath)) {
							console.log(`Found Twig file at: ${componentsFilePath}`);
							foundTwigFiles.push(vscode.Uri.file(componentsFilePath));
						}
					}
				} catch (error) {
					console.error(`Error searching for template: ${error}`);
				}
			}
		}
	}

	console.log(`Found ${foundPhpFiles.length} PHP files and ${foundTwigFiles.length} Twig files`);

	// If no files found, return undefined
	if (foundPhpFiles.length === 0 && foundTwigFiles.length === 0) {
		console.log('No matching files found');
		return undefined;
	}

	return {
		fullNamespace,
		componentName,
		phpFiles: foundPhpFiles,
		twigFiles: foundTwigFiles
	};
}

// Navigate to Twig component
async function navigateToTwigComponent(editor: vscode.TextEditor, isModifierClick: boolean = false) {
	const position = editor.selection.active;
	const document = editor.document;

	const result = await findComponentFiles(document, position);
	if (!result) {
		vscode.window.showInformationMessage('No Twig component found at cursor position');
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