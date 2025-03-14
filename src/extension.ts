// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Regex to match Twig component tags with multi-level namespaces
const TWIG_COMPONENT_REGEX = /<twig:([A-Za-z0-9_:]+):([A-Za-z0-9_]+)/g;
const TWIG_COMPONENT_NAMESPACE_REGEX = /<twig:([A-Za-z0-9_:]+):([A-Za-z0-9_]+)/;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Symfony UX Twig Component extension is now active!');

	// Register the command for navigating to Twig components
	const navigateCommand = vscode.commands.registerTextEditorCommand(
		'symfonyUxTwigComponent.navigateToComponent',
		(editor, edit) => {
			navigateToTwigComponent(editor);
		}
	);

	// Register the document range formatting provider for Twig components
	// Using range formatting instead of document formatting to work alongside other formatters
	const formattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
		{ language: 'twig' },
		new TwigComponentFormattingProvider()
	);

	// Register the definition provider for backward compatibility
	const definitionProvider = vscode.languages.registerDefinitionProvider(
		{ language: 'twig' },
		new TwigComponentDefinitionProvider()
	);

	context.subscriptions.push(navigateCommand, formattingProvider, definitionProvider);
}

// Get configured paths
function getConfiguredPaths(): { 
	phpBasePaths: string[], 
	phpComponentPaths: string[], 
	twigBasePaths: string[], 
	twigTemplatePaths: string[] 
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
	
	return { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths };
}

// Parse the namespace from a component tag and match it with base paths
function parseComponentNamespace(fullNamespace: string, basePaths: string[]): { 
	matchedBasePath: string | null, 
	remainingNamespace: string 
} {
	// Debug logging
	console.log(`Parsing namespace: ${fullNamespace}`);
	console.log(`Available base paths: ${JSON.stringify(basePaths)}`);
	
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
			if (part && part !== 'src' && part !== 'templates' && part !== 'templates_new' && part !== 'components') {
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
		const basePathParts = cleanBasePath.split('/').filter(part => part && part !== 'src' && part !== 'templates' && part !== 'templates_new' && part !== 'components');
		
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
		
		// Try to find the template by searching for the component name in all template directories
		for (const workspaceFolder of workspaceFolders) {
			// Check in templates and templates_new directories
			const templateDirs = ['templates', 'templates_new'];
			
			for (const templateDir of templateDirs) {
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
async function navigateToTwigComponent(editor: vscode.TextEditor) {
	const position = editor.selection.active;
	const document = editor.document;
	
	const result = await findComponentFiles(document, position);
	if (!result) {
		vscode.window.showInformationMessage('No Twig component found at cursor position');
		return;
	}
	
	const { phpFiles, twigFiles } = result;
	
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
}

// Definition provider for Twig components (for backward compatibility)
class TwigComponentDefinitionProvider implements vscode.DefinitionProvider {
	async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.Definition | undefined> {
		const result = await findComponentFiles(document, position);
		if (!result) {
			return undefined;
		}
		
		const { phpFiles, twigFiles } = result;
		
		// If we have PHP files, return the first one
		if (phpFiles.length > 0) {
			return new vscode.Location(phpFiles[0], new vscode.Position(0, 0));
		}
		
		// Otherwise, return the first Twig file
		if (twigFiles.length > 0) {
			return new vscode.Location(twigFiles[0], new vscode.Position(0, 0));
		}
		
		return undefined;
	}
}

// Formatting provider for Twig components
class TwigComponentFormattingProvider implements vscode.DocumentRangeFormattingEditProvider {
	provideDocumentRangeFormattingEdits(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): vscode.TextEdit[] {
		const edits: vscode.TextEdit[] = [];
		const text = document.getText(range);
		let match;

		// Reset the regex
		TWIG_COMPONENT_REGEX.lastIndex = 0;
		
		// Create a temporary string to search through
		const tempText = text;
		let offset = document.offsetAt(range.start);
		
		while ((match = TWIG_COMPONENT_REGEX.exec(tempText)) !== null) {
			const matchStartOffset = offset + match.index;
			const startPos = document.positionAt(matchStartOffset);
			const line = document.lineAt(startPos.line);
			const lineText = line.text;
			
			// Find the end of the component tag
			const tagEndIndex = lineText.indexOf('>', startPos.character + match[0].length);
			if (tagEndIndex === -1) {
				continue; // Skip if no closing bracket found
			}
			
			// Extract the part of the line that contains the tag and its attributes
			const tagText = lineText.substring(startPos.character, tagEndIndex + 1);
			
			// Check if there are attributes in the tag
			const attributeRegex = /\s+([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)')/g;
			let attributeMatch;
			const attributes: string[] = [];
			
			// Clone the regex to avoid affecting the outer loop
			const attrRegexClone = new RegExp(attributeRegex);
			let attrText = tagText.substring(match[0].length);
			
			while ((attributeMatch = attrRegexClone.exec(attrText)) !== null) {
				attributes.push(attributeMatch[0].trim());
			}
			
			// Only format if there are attributes
			if (attributes.length > 0) {
				// Format the attributes to be on separate lines
				let formattedText = lineText.substring(0, startPos.character + match[0].length);
				let indentation = ' '.repeat(options.insertSpaces ? options.tabSize : 4);
				
				for (const attr of attributes) {
					formattedText += '\n' + ' '.repeat(startPos.character) + indentation + attr;
				}
				
				// Add the closing tag
				formattedText += '\n' + ' '.repeat(startPos.character) + '>';
				
				// Create a text edit to replace the tag portion
				const replaceRange = new vscode.Range(
					startPos,
					new vscode.Position(startPos.line, tagEndIndex + 1)
				);
				
				edits.push(vscode.TextEdit.replace(replaceRange, formattedText));
			}
		}
		
		return edits;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}


