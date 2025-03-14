// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { registerFormattingProviders } from './providers/formattingProvider';
import { registerFormattingCommands } from './commands/formatting';
import { debugLog, registerConfigChangeListener } from './utils/config';

// Regex to match Twig component tags with multi-level namespaces
const TWIG_COMPONENT_REGEX = /<twig:([A-Za-z0-9_:]+):([A-Za-z0-9_]+)/g;
const TWIG_COMPONENT_NAMESPACE_REGEX = /<twig:([A-Za-z0-9_:]+):([A-Za-z0-9_]+)/;
// Regex to match Twig component attributes, including those with Twig variables
const TWIG_ATTRIBUTE_REGEX = /\s+([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|"{{[^}]*}}"|'{{[^}]*}}'|"{{[^}]*}}"|'{{[^}]*}}')/g;
// Regex to detect flattened components (all on one line with multiple attributes)
const FLATTENED_COMPONENT_REGEX = /<twig:[A-Za-z0-9_:]+:[A-Za-z0-9_]+\s+[a-zA-Z0-9_-]+=(?:"[^"]*"|'[^']*')\s+[a-zA-Z0-9_-]+=(?:"[^"]*"|'[^']*')/g;

// This method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
	debugLog('Activating Symfony UX Twig Component extension');
	
	// Store all disposables in an array
	const disposables: vscode.Disposable[] = [];
	
	// Register the navigation command
	disposables.push(
		vscode.commands.registerCommand('symfony-ux-twig-component.navigateToComponent', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				// We'll implement this in a separate PR
				vscode.window.showInformationMessage('Navigation to component will be implemented in a future update.');
			}
		})
	);
	
	// Register formatting providers
	disposables.push(...registerFormattingProviders(context));
	
	// Register formatting commands
	disposables.push(...registerFormattingCommands(context));
	
	// Register configuration change listener
	disposables.push(
		registerConfigChangeListener(() => {
			// Dispose all existing providers
			disposables.forEach(d => d.dispose());
			disposables.length = 0;
			
			// Re-register all providers with new configuration
			disposables.push(...registerFormattingProviders(context));
			disposables.push(...registerFormattingCommands(context));
			
			debugLog('Configuration changed, providers reregistered');
		})
	);
	
	// Add all disposables to the context
	disposables.forEach(d => context.subscriptions.push(d));
	
	debugLog('Symfony UX Twig Component extension activated');
}

// This method is called when the extension is deactivated
export function deactivate() {
	debugLog('Symfony UX Twig Component extension deactivated');
}

// Get configured paths
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

// Parse the namespace from a component tag and match it with base paths
function parseComponentNamespace(fullNamespace: string, basePaths: string[]): {
	matchedBasePath: string | null,
	remainingNamespace: string
} {
	// Debug logging
	console.log(`Parsing namespace: ${fullNamespace}`);
	console.log(`Available base paths: ${JSON.stringify(basePaths)}`);

	// Get excluded directory names from configuration
	const { excludedDirectoryNames } = getConfiguredPaths();

	// Convert namespace format (e.g., "Content:Menu") to path format (e.g., "Content/Menu")
	const namespaceParts = fullNamespace.split(':');
	console.log(`Namespace parts: ${JSON.stringify(namespaceParts)}`);

	// Try to match with base paths - first try exact matches
	for (const basePath of basePaths) {
		// Remove trailing slashes from base path
		const cleanBasePath = basePath.replace(/\/+$/, '');

		// Convert base path to namespace format for comparison
		const basePathParts = cleanBasePath.split('/');
		let basePathNamespace = '';

		// Skip empty parts and convert to namespace format
		for (const part of basePathParts) {
			if (part && !excludedDirectoryNames.includes(part.toLowerCase())) {
				basePathNamespace += (basePathNamespace ? ':' : '') + part;
			}
		}

		console.log(`Base path: ${cleanBasePath}, converted to namespace: ${basePathNamespace}`);

		// Check for exact match (for cases like templates/components/Content)
		if (basePathNamespace && basePathNamespace === fullNamespace) {
			console.log(`Exact match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
			return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
		}

		// Check if the namespace starts with the base path namespace
		if (basePathNamespace && fullNamespace.startsWith(basePathNamespace + ':')) {
			// Remove the matched part from the namespace
			const remainingNamespace = fullNamespace.substring(basePathNamespace.length + 1);
			console.log(`Prefix match found! Base path: ${cleanBasePath}, remaining namespace: ${remainingNamespace}`);
			return { matchedBasePath: cleanBasePath, remainingNamespace };
		}

		// Check if the base path starts with the namespace (reverse match)
		if (basePathNamespace && basePathNamespace.startsWith(fullNamespace + ':')) {
			console.log(`Reverse match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
			return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
		}

		// Check if the base path contains the full namespace
		if (basePathNamespace && basePathNamespace.includes(fullNamespace)) {
			console.log(`Contained match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
			return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
		}
	}

	// Try to match partial paths (for more complex directory structures)
	for (const basePath of basePaths) {
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

		// Try to match parts in any order (for cases where the directory structure doesn't match the namespace exactly)
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

// Formatting provider for Twig components
class TwigComponentFormattingProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
	provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): vscode.TextEdit[] {
		// Get configuration
		const config = vscode.workspace.getConfiguration('symfonyUxTwigComponent');
		const formattingEnabled = config.get<boolean>('formatting.enabled', true);
		
		if (!formattingEnabled) {
			return [];
		}
		
		// Format the entire document
		const range = new vscode.Range(
			new vscode.Position(0, 0),
			document.lineAt(document.lineCount - 1).range.end
		);
		return this.formatTwigComponents(document, range, options);
	}

	provideDocumentRangeFormattingEdits(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): vscode.TextEdit[] {
		// Get configuration
		const config = vscode.workspace.getConfiguration('symfonyUxTwigComponent');
		const formattingEnabled = config.get<boolean>('formatting.enabled', true);
		
		if (!formattingEnabled) {
			return [];
		}
		
		return this.formatTwigComponents(document, range, options);
	}

	public formatTwigComponents(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions
	): vscode.TextEdit[] {
		const edits: vscode.TextEdit[] = [];
		const text = document.getText(range);
		
		// First check for flattened components that need formatting
		// We'll use a different approach to find flattened components
		const lines = text.split('\n');
		
		// Process each line to find flattened components
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Reset the regex for each line
			TWIG_COMPONENT_REGEX.lastIndex = 0;
			let match;
			
			// Look for component tags in this line
			while ((match = TWIG_COMPONENT_REGEX.exec(line)) !== null) {
				const namespace = match[1];
				const component = match[2];
				const startChar = match.index;
				
				// Find the end of the tag on this line
				const tagEndIndex = line.indexOf('>', startChar + match[0].length);
				if (tagEndIndex === -1) {
					continue; // No closing bracket on this line
				}
				
				// Extract the tag text
				const tagText = line.substring(startChar, tagEndIndex + 1);
				
				// Count attributes
				const attributes: string[] = [];
				TWIG_ATTRIBUTE_REGEX.lastIndex = 0;
				let attrMatch;
				
				while ((attrMatch = TWIG_ATTRIBUTE_REGEX.exec(tagText)) !== null) {
					attributes.push(attrMatch[0].trim());
				}
				
				// If we have multiple attributes on a single line, format it
				if (attributes.length > 1) {
					const tag = {
						namespace,
						component,
						startLine: i + range.start.line,
						startChar,
						endLine: i + range.start.line,
						endChar: tagEndIndex + 1,
						attributes
					};
					
					this.formatTag(document, tag, edits, options);
				}
			}
		}
		
		// Now handle multi-line tags
		let currentTag: { 
			namespace: string, 
			component: string, 
			startLine: number, 
			startChar: number,
			attributes: string[],
			endLine?: number,
			endChar?: number
		} | null = null;
		
		// First pass: identify all component tags and their attributes
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// If we're not currently tracking a tag, look for a new one
			if (!currentTag) {
				// Reset the regex
				TWIG_COMPONENT_REGEX.lastIndex = 0;
				const match = TWIG_COMPONENT_REGEX.exec(line);
				
				if (match) {
					// Found a new tag
					currentTag = {
						namespace: match[1],
						component: match[2],
						startLine: i + range.start.line,
						startChar: match.index,
						attributes: []
					};
					
					// Check if the tag ends on this line
					const tagEndIndex = line.indexOf('>', match.index + match[0].length);
					if (tagEndIndex !== -1) {
						currentTag.endLine = i + range.start.line;
						currentTag.endChar = tagEndIndex + 1;
						
						// Extract attributes
						const tagText = line.substring(match.index, tagEndIndex + 1);
						const attributeRegex = TWIG_ATTRIBUTE_REGEX;
						let attributeMatch;
						
						while ((attributeMatch = attributeRegex.exec(tagText)) !== null) {
							currentTag.attributes.push(attributeMatch[0].trim());
						}
						
						// Format the tag if it has attributes
						if (currentTag.attributes.length > 0) {
							this.formatTag(document, currentTag, edits, options);
						}
						
						currentTag = null;
					}
				}
			} else {
				// We're tracking a tag, look for the end
				const tagEndIndex = line.indexOf('>');
				if (tagEndIndex !== -1) {
					currentTag.endLine = i + range.start.line;
					currentTag.endChar = tagEndIndex + 1;
					
					// Extract attributes from this line
					const attributeRegex = TWIG_ATTRIBUTE_REGEX;
					let attributeMatch;
					
					while ((attributeMatch = attributeRegex.exec(line)) !== null) {
						currentTag.attributes.push(attributeMatch[0].trim());
					}
					
					// Format the tag if it has attributes
					if (currentTag.attributes.length > 0) {
						this.formatTag(document, currentTag, edits, options);
					}
					
					currentTag = null;
				} else {
					// Still in the tag, collect attributes
					const attributeRegex = TWIG_ATTRIBUTE_REGEX;
					let attributeMatch;
					
					while ((attributeMatch = attributeRegex.exec(line)) !== null) {
						currentTag.attributes.push(attributeMatch[0].trim());
					}
				}
			}
		}
		
		return edits;
	}
	
	private formatTag(
		document: vscode.TextDocument,
		tag: { 
			namespace: string, 
			component: string, 
			startLine: number, 
			startChar: number,
			attributes: string[],
			endLine?: number,
			endChar?: number
		},
		edits: vscode.TextEdit[],
		options: vscode.FormattingOptions
	): void {
		if (!tag.endLine || !tag.endChar) {
			return;
		}
		
		// Get the full tag text
		let fullTagText = '';
		if (tag.startLine === tag.endLine) {
			// Single line tag
			const line = document.lineAt(tag.startLine).text;
			fullTagText = line.substring(tag.startChar, tag.endChar);
		} else {
			// Multi-line tag
			const startLine = document.lineAt(tag.startLine).text;
			fullTagText = startLine.substring(tag.startChar);
			
			for (let i = tag.startLine + 1; i < tag.endLine; i++) {
				fullTagText += '\n' + document.lineAt(i).text;
			}
			
			const endLine = document.lineAt(tag.endLine).text;
			fullTagText += '\n' + endLine.substring(0, tag.endChar);
		}
		
		// Get the leading whitespace from the line
		const startLine = document.lineAt(tag.startLine);
		const leadingWhitespace = startLine.text.substring(0, startLine.firstNonWhitespaceCharacterIndex);
		
		// Format the tag exactly as shown in the screenshot
		const tagStart = `<twig:${tag.namespace}:${tag.component}`;
		
		// Based on the screenshot, attributes are indented with exactly 4 spaces from the start of the line
		// The tag itself is at the same indentation level as the closing tag
		
		// Build the formatted text
		let formattedText = tagStart;
		
		// Add attributes on separate lines with proper indentation
		// In the screenshot, attributes are indented with exactly 4 spaces
		for (const attr of tag.attributes) {
			formattedText += '\n' + leadingWhitespace + '    ' + attr;
		}
		
		// Add closing tag on its own line
		formattedText += '\n' + leadingWhitespace + '>';
		
		// Check if this is a self-closing tag or a tag with content
		const isSelfClosing = fullTagText.trim().endsWith('/>');
		if (isSelfClosing) {
			// If it's self-closing, use '/>' instead of '>'
			formattedText = formattedText.substring(0, formattedText.length - 1) + '/>';
		}
		
		// Create the range to replace
		const replaceRange = new vscode.Range(
			new vscode.Position(tag.startLine, tag.startChar),
			new vscode.Position(tag.endLine, tag.endChar)
		);
		
		edits.push(vscode.TextEdit.replace(replaceRange, formattedText));
	}
}


