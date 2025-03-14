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

	// Register the definition provider for Twig components
	const definitionProvider = vscode.languages.registerDefinitionProvider(
		{ language: 'twig' },
		new TwigComponentDefinitionProvider()
	);

	// Register the document range formatting provider for Twig components
	// Using range formatting instead of document formatting to work alongside other formatters
	const formattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
		{ language: 'twig' },
		new TwigComponentFormattingProvider()
	);

	context.subscriptions.push(definitionProvider, formattingProvider);
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
		'src/Content',
		'src/Portal/Shared',
		'src'
	]);
	
	const phpComponentPaths = config.get<string[]>('phpComponentPaths', [
		'Twig/Component/${namespace}/${componentName}.php',
		'Components/${namespace}/${componentName}.php',
		'Twig/Components/${namespace}/${componentName}.php'
	]);
	
	const twigBasePaths = config.get<string[]>('twigBasePaths', [
		'templates/content',
		'templates/portal/shared',
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
	
	// Try to match with base paths
	for (const basePath of basePaths) {
		// Remove trailing slashes from base path
		const cleanBasePath = basePath.replace(/\/+$/, '');
		
		// Convert base path to namespace format for comparison
		const basePathParts = cleanBasePath.split('/');
		let basePathNamespace = '';
		
		// Skip empty parts and convert to namespace format
		for (const part of basePathParts) {
			if (part && part !== 'src' && part !== 'templates') {
				basePathNamespace += (basePathNamespace ? ':' : '') + part;
			}
		}
		
		console.log(`Base path: ${cleanBasePath}, converted to namespace: ${basePathNamespace}`);
		
		// Check if the namespace starts with the base path namespace
		if (basePathNamespace && fullNamespace.startsWith(basePathNamespace + ':')) {
			// Remove the matched part from the namespace
			const remainingNamespace = fullNamespace.substring(basePathNamespace.length + 1);
			console.log(`Match found! Base path: ${cleanBasePath}, remaining namespace: ${remainingNamespace}`);
			return { matchedBasePath: cleanBasePath, remainingNamespace };
		}
	}
	
	// If no match found, return the full namespace
	console.log(`No match found, using full namespace: ${fullNamespace}`);
	return { matchedBasePath: null, remainingNamespace: fullNamespace };
}

// Definition provider for Twig components
class TwigComponentDefinitionProvider implements vscode.DefinitionProvider {
	async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.Definition | undefined> {
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
		const possiblePaths: string[] = [];
		
		// Add PHP paths
		if (phpResult.matchedBasePath) {
			for (const componentPath of phpComponentPaths) {
				const resolvedPath = path.join(
					phpResult.matchedBasePath,
					componentPath
						.replace('${namespace}', phpResult.remainingNamespace.replace(/:/g, '/'))
						.replace('${componentName}', componentName)
				);
				possiblePaths.push(resolvedPath);
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
				possiblePaths.push(resolvedPath);
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
					possiblePaths.push(resolvedPath);
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
					possiblePaths.push(resolvedPath);
					console.log(`Added fallback Twig path: ${resolvedPath}`);
				}
			}
		}

		console.log(`Checking ${possiblePaths.length} possible paths`);
		
		// Check all possible paths
		for (const workspaceFolder of workspaceFolders) {
			for (const possiblePath of possiblePaths) {
				const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
				console.log(`Checking path: ${filePath}`);
				
				if (fs.existsSync(filePath)) {
					console.log(`Found file at: ${filePath}`);
					const targetUri = vscode.Uri.file(filePath);
					return new vscode.Location(targetUri, new vscode.Position(0, 0));
				}
			}
		}

		console.log('No matching file found');
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
