import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfiguredPaths } from '../utils/config';

interface ComponentInfo {
    name: string;
    fullName: string;
    filePath: string;
}

export class TwigComponentCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | undefined> {
        // Get the line up to the cursor position
        const line = document.lineAt(position.line).text;
        const lineUntilPosition = line.substring(0, position.character);

        // Check if we're typing a Twig component
        if (!lineUntilPosition.includes('<twig:')) {
            return undefined;
        }

        // Get the partial component name being typed
        const match = lineUntilPosition.match(/<twig:([^>]*)$/);
        if (!match) {
            return undefined;
        }

        const searchTerm = match[1];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        // Get configured paths
        const { twigBasePaths } = getConfiguredPaths();

        // Get all Twig files in the configured paths
        const components = await this.findAllComponents(workspaceFolder, twigBasePaths);

        // Filter components by exact sequence match
        const matchingComponents = components.filter(component => 
            component.name.includes(searchTerm) || 
            component.fullName.includes(searchTerm)
        );

        // Create completion items
        return matchingComponents.map(component => {
            const item = new vscode.CompletionItem(
                `${component.fullName} [${component.filePath}]`,
                vscode.CompletionItemKind.Class
            );
            item.detail = 'Twig Component';
            item.insertText = component.fullName;
            item.filterText = component.fullName; // This ensures filtering works on the component name only
            return item;
        });
    }

    private async findAllComponents(workspaceFolder: vscode.WorkspaceFolder, basePaths: string[]): Promise<ComponentInfo[]> {
        const components: ComponentInfo[] = [];
        const workspacePath = workspaceFolder.uri.fsPath;

        // Scan each configured base path
        for (const basePath of basePaths) {
            const fullPath = path.join(workspacePath, basePath);
            if (!fs.existsSync(fullPath)) {
                continue;
            }
            await this.scanDirectory(fullPath, basePath, components);
        }

        return components;
    }

    private async scanDirectory(dir: string, basePath: string, components: ComponentInfo[]): Promise<void> {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await this.scanDirectory(fullPath, basePath, components);
            } else if (entry.name.endsWith('.html.twig')) {
                const componentInfo = this.createComponentInfo(fullPath, basePath);
                if (componentInfo) {
                    components.push(componentInfo);
                }
            }
        }
    }

    private createComponentInfo(filePath: string, basePath: string): ComponentInfo | undefined {
        // Remove file extension
        const withoutExt = filePath.replace('.html.twig', '');
        
        // Get the relative path by removing everything up to and including the base path
        const basePathParts = basePath.split(path.sep);
        const allParts = withoutExt.split(path.sep);
        const componentParts = allParts.slice(allParts.indexOf(basePathParts[basePathParts.length - 1]) + 1);
        
        if (componentParts.length === 0) {
            return undefined;
        }

        // The last part is the component name
        const componentName = componentParts[componentParts.length - 1];
        
        // Everything before the last part is the namespace
        const namespace = componentParts.slice(0, -1).join(':');
        const fullName = namespace ? `${namespace}:${componentName}` : componentName;

        return {
            name: componentName,
            fullName,
            filePath
        };
    }
} 