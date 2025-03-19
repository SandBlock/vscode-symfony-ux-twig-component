import * as vscode from 'vscode';
import * as path from 'path';
import { findComponentFiles } from '../utils/componentFinder';

// Navigate to Twig component
export async function navigateToTwigComponent(editor: vscode.TextEditor, isModifierClick: boolean = false) {
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

// Definition provider for Twig components
export class TwigComponentDefinitionProvider implements vscode.DefinitionProvider {
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

// Register navigation commands and providers
export function registerNavigationCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];
	
	// Register the navigation command
	disposables.push(
		vscode.commands.registerCommand('symfony-ux-twig-component.navigateToComponent', async () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				await navigateToTwigComponent(editor);
			}
		})
	);
	
	// Register the definition provider for Twig components
	disposables.push(
		vscode.languages.registerDefinitionProvider(
			{ language: 'twig' },
			new TwigComponentDefinitionProvider()
		)
	);
	
	return disposables;
} 