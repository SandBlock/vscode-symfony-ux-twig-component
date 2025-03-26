import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfiguredPaths } from '../utils/config';

interface ComponentInfo {
    name: string;
    fullName: string;
    componentPath: string;
    filePath: string;
}

export class TwigComponentCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | undefined> {
        const line = document.lineAt(position.line).text;
        const lineUntilPosition = line.substring(0, position.character);

        if (!lineUntilPosition.includes('<twig:')) {
            return undefined;
        }

        const match = lineUntilPosition.match(/<twig:([^>]*)$/);
        if (!match) {
            return undefined;
        }

        const searchTerm = match[1];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        const { twigBasePaths, twigTemplatePaths } = getConfiguredPaths();

        const components = await this.findAllComponents(workspaceFolder, twigBasePaths, twigTemplatePaths);
        vscode.window.showInformationMessage(JSON.stringify(components));
        const matchingComponents = components.filter(component =>
            component.name.includes(searchTerm) ||
            component.componentPath.includes(searchTerm)
        );

        return matchingComponents.map(component => {
            const item = new vscode.CompletionItem(
                `${component.name} [${component.fullName}]`,
                vscode.CompletionItemKind.Class
            );
            item.detail = 'Twig Component';
            item.insertText = component.componentPath;
            item.filterText = component.fullName;
            return item;
        });
    }

    private async findAllComponents(workspaceFolder: vscode.WorkspaceFolder, basePaths: string[], templatePaths: string[]): Promise<ComponentInfo[]> {
        const components: ComponentInfo[] = [];
        const workspacePath = workspaceFolder.uri.fsPath;

        for (const basePath of basePaths) {
            const fullPath = path.join(workspacePath, basePath);
            if (!fs.existsSync(fullPath)) {
                continue;
            }
            await this.scanDirectory(fullPath, basePath, templatePaths, components);
        }

        return components;
    }

    private async scanDirectory(dir: string, basePath: string, templatePaths: string[], components: ComponentInfo[]): Promise<void> {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await this.scanDirectory(fullPath, basePath, templatePaths, components);
            } else if (entry.name.endsWith('.twig')) {
                const componentInfo = this.createComponentInfo(fullPath, basePath, templatePaths);
                if (componentInfo) {
                    components.push(componentInfo);
                }
            }
        }
    }

    private createComponentInfo(filePath: string, basePath: string, templatePaths: string[]): ComponentInfo | undefined {
        const withoutExt = filePath.replace('.html.twig', '').replace('.twig', '');

        const basePathParts = basePath.split(path.sep);
        const allParts = withoutExt.split(path.sep);
        const componentParts = allParts.slice(allParts.indexOf(basePathParts[basePathParts.length - 1]) + 1);

        if (componentParts.length === 0) {
            return undefined;
        }

        const componentName = componentParts[componentParts.length - 1];

        const namespace = componentParts.slice(0, -1).join(':');
        const fullName = namespace ? `${namespace}:${componentName}` : componentName;
        // const componentPath = this.filterComponentPath(fullName, templatePaths);
        const componentPath = this.filterComponentPath(namespace, componentName, filePath, templatePaths);

        if (!componentPath) {
            return undefined;
        }

        return {
            name: componentName,
            fullName: fullName,
            componentPath: componentPath,
            filePath: filePath
        };
    }

    private filterComponentPath(namespace: string, componentName: string, filePath: string, templatePaths: string[]): string | null {

        for (const templatePath of templatePaths) {
            const cutTemplatePath = templatePath.substring(0, templatePath.indexOf('${'));
            const filteredNamespace = namespace.replaceAll(':', '/').substring(cutTemplatePath.length);
            const filledNamespace = templatePath
                .replace('${namespace}', filteredNamespace)
                .replace('${componentName}', componentName)
                .replaceAll(':', '/');
            
            if (filePath.includes(filledNamespace)) {
                // return filledNamespace.replaceAll('/', ':');

                const filledNamespaceParts = filledNamespace.split('/');
                const templatePathParts = templatePath.split('/');

                let remainingParts = [];
                for (const filledNamespacePart of filledNamespaceParts) {
                    let found = false;
                    for (const templatePathPart of templatePathParts) {
                        if (filledNamespacePart === templatePathPart) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        remainingParts.push(filledNamespacePart);
                    }
                }

                return remainingParts.join(':')
                    .replace('.html.twig', '')
                    .replace('.twig', '');
            }
        }

        return null;
    }
} 