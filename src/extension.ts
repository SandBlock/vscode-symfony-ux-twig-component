// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Regex to match Twig component tags
const TWIG_COMPONENT_REGEX = /<twig:([A-Za-z0-9_]+):([A-Za-z0-9_]+)/g;
const TWIG_COMPONENT_NAMESPACE_REGEX = /<twig:([A-Za-z0-9_]+):([A-Za-z0-9_]+)/;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Symfony UX Twig Component extension is now active!');

	// Register the definition provider for Twig components
	const definitionProvider = vscode.languages.registerDefinitionProvider(
		{ language: 'twig' },
		new TwigComponentDefinitionProvider()
	);

	// Register the document formatting provider for Twig components
	const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
		{ language: 'twig' },
		new TwigComponentFormattingProvider()
	);

	context.subscriptions.push(definitionProvider, formattingProvider);
}

// Definition provider for Twig components
class TwigComponentDefinitionProvider implements vscode.DefinitionProvider {
	async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.Definition | undefined> {
		const line = document.lineAt(position.line).text;
		const match = TWIG_COMPONENT_NAMESPACE_REGEX.exec(line);
		
		if (!match) {
			return undefined;
		}

		// Check if the cursor is on the namespace part
		const namespaceStart = line.indexOf(match[1], match.index + 6); // 6 is the length of "<twig:"
		const namespaceEnd = namespaceStart + match[1].length;
		
		if (position.character < namespaceStart || position.character > namespaceEnd) {
			return undefined;
		}

		// Try to find the component file
		const namespace = match[1];
		const componentName = match[2];
		
		// Search for the component in possible locations
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return undefined;
		}

		// Possible locations for Symfony UX Twig components
		const possiblePaths = [
			// PHP class
			`src/Components/${namespace}/${componentName}.php`,
			`src/Twig/Components/${namespace}/${componentName}.php`,
			`src/Twig/Component/${namespace}/${componentName}.php`,
			// Twig template
			`templates/components/${namespace}/${componentName}.html.twig`,
			`templates/twig/components/${namespace}/${componentName}.html.twig`,
			`templates/${namespace}/${componentName}.html.twig`,
		];

		for (const workspaceFolder of workspaceFolders) {
			for (const possiblePath of possiblePaths) {
				const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
				
				if (fs.existsSync(filePath)) {
					const targetUri = vscode.Uri.file(filePath);
					return new vscode.Location(targetUri, new vscode.Position(0, 0));
				}
			}
		}

		return undefined;
	}
}

// Formatting provider for Twig components
class TwigComponentFormattingProvider implements vscode.DocumentFormattingEditProvider {
	provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): vscode.TextEdit[] {
		const edits: vscode.TextEdit[] = [];
		const text = document.getText();
		let match;

		// Reset the regex
		TWIG_COMPONENT_REGEX.lastIndex = 0;
		
		while ((match = TWIG_COMPONENT_REGEX.exec(text)) !== null) {
			const startPos = document.positionAt(match.index);
			const line = document.lineAt(startPos.line);
			const lineText = line.text;
			
			// Check if there are attributes on the same line
			const lineAfterTag = lineText.substring(startPos.character + match[0].length);
			const attributeMatches = lineAfterTag.match(/\s+([a-zA-Z0-9_-]+)="([^"]*)"(?=\s|\/?>)/g);
			
			if (attributeMatches && attributeMatches.length > 0) {
				// Format the attributes to be on separate lines
				let formattedText = lineText.substring(0, startPos.character + match[0].length);
				let indentation = ' '.repeat(startPos.character + 4); // 4 spaces indentation
				
				for (const attrMatch of attributeMatches) {
					formattedText += '\n' + indentation + attrMatch.trim();
				}
				
				// Add the closing tag if it exists on this line
				const closingTagMatch = lineAfterTag.match(/\s*\/?>/);
				if (closingTagMatch) {
					formattedText += '\n' + ' '.repeat(startPos.character) + closingTagMatch[0].trim();
				}
				
				// Create a text edit to replace the entire line
				edits.push(vscode.TextEdit.replace(line.range, formattedText));
			}
		}
		
		return edits;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
