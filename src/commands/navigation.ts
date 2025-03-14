import * as vscode from 'vscode';
import { findComponentFiles } from '../utils/componentFinder';

// Navigate to Twig component
export async function navigateToTwigComponent(editor: vscode.TextEditor, isModifierClick: boolean = false) {
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
				description: phpFiles[0].fsPath.split('/').pop(),
				detail: phpFiles[0].fsPath
			});
		}

		if (twigFiles.length > 0) {
			items.push({
				label: "$(file) Open Template File",
				description: twigFiles[0].fsPath.split('/').pop(),
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

// Register commands for navigation
export function registerNavigationCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];

	// Register the command for navigating to Twig components
	const navigateCommand = vscode.commands.registerTextEditorCommand(
		'symfonyUxTwigComponent.navigateToComponent',
		(editor, edit) => {
			navigateToTwigComponent(editor, false);
		}
	);
	disposables.push(navigateCommand);

	// Register a separate command for Cmd+click navigation (Alt+click on Windows/Linux)
	const modifierNavigateCommand = vscode.commands.registerCommand(
		'symfonyUxTwigComponent.modifierNavigateToComponent',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				await navigateToTwigComponent(editor, true);
			}
		}
	);
	disposables.push(modifierNavigateCommand);

	// Register command to open a single file
	const openFileCommand = vscode.commands.registerCommand(
		'symfonyUxTwigComponent.openFile',
		async (args) => {
			if (args && args.filePath) {
				const uri = vscode.Uri.file(args.filePath);
				await vscode.window.showTextDocument(uri);
			}
		}
	);
	disposables.push(openFileCommand);

	// Register command to open both files
	const openBothFilesCommand = vscode.commands.registerCommand(
		'symfonyUxTwigComponent.openBothFiles',
		async (args) => {
			if (args && args.phpFilePath && args.twigFilePath) {
				// Open Twig file first (non-preview)
				const twigUri = vscode.Uri.file(args.twigFilePath);
				await vscode.window.showTextDocument(twigUri, { preview: false });

				// Then open PHP file
				const phpUri = vscode.Uri.file(args.phpFilePath);
				await vscode.window.showTextDocument(phpUri);
			}
		}
	);
	disposables.push(openBothFilesCommand);

	return disposables;
} 