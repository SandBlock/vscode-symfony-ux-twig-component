import * as vscode from 'vscode';
import { TwigComponentFormattingProvider } from '../providers/formattingProvider';
import { debugLog } from '../utils/config';

/**
 * Format all Twig components in the current document
 */
export async function formatTwigComponents(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'twig') {
        vscode.window.showInformationMessage('Please open a Twig file to format components.');
        return;
    }

    debugLog('Manually formatting Twig components');

    // Create a formatting provider instance
    const formatter = new TwigComponentFormattingProvider();
    
    // Get the entire document range
    const document = editor.document;
    const range = new vscode.Range(
        new vscode.Position(0, 0),
        document.lineAt(document.lineCount - 1).range.end
    );
    
    // Get formatting options
    const options = {
        insertSpaces: editor.options.insertSpaces as boolean,
        tabSize: editor.options.tabSize as number
    };
    
    // Get the edits
    const edits = formatter.formatTwigComponents(document, range, options);
    
    // Apply the edits
    if (edits.length > 0) {
        const edit = new vscode.WorkspaceEdit();
        for (const textEdit of edits) {
            edit.replace(document.uri, textEdit.range, textEdit.newText);
        }
        
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(`Formatted ${edits.length} Twig component(s).`);
        debugLog(`Manually formatted ${edits.length} Twig component(s)`);
    } else {
        vscode.window.showInformationMessage('No Twig components found to format.');
        debugLog('No Twig components found to format');
    }
}

/**
 * Register formatting commands
 */
export function registerFormattingCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    
    // Register command to manually format Twig components
    const formatCommand = vscode.commands.registerCommand(
        'symfony-ux-twig-component.formatTwigComponents',
        formatTwigComponents
    );
    disposables.push(formatCommand);
    
    return disposables;
} 