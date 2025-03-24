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
            } else if (entry.name.endsWith('.html.twig')) {
                const componentInfo = this.createComponentInfo(fullPath, basePath, templatePaths);
                if (componentInfo) {
                    components.push(componentInfo);
                }
            }
        }
    }

    private createComponentInfo(filePath: string, basePath: string, templatePaths: string[]): ComponentInfo | undefined {
        const withoutExt = filePath.replace('.html.twig', '');

        const basePathParts = basePath.split(path.sep);
        const allParts = withoutExt.split(path.sep);
        const componentParts = allParts.slice(allParts.indexOf(basePathParts[basePathParts.length - 1]) + 1);

        if (componentParts.length === 0) {
            return undefined;
        }

        const componentName = componentParts[componentParts.length - 1];

        const namespace = componentParts.slice(0, -1).join(':');
        const fullName = namespace ? `${namespace}:${componentName}` : componentName;
        const componentPath = this.filterComponentPath(fullName, templatePaths);

        return {
            name: componentName,
            fullName,
            componentPath,
            filePath
        };
    }

    private filterComponentPath(fullName: string, templatePaths: string[]): string {
        let bestMatch = {
            path: fullName,
            score: -1
        };

        const namespaceParts = fullName.split(":");

        for (const templatePath of templatePaths) {
            const templatePathParts = templatePath.split("/");
            
            let matchScore = 0;
            let matchedParts = 0;
            
            const realPathParts = templatePathParts.filter(part => !['${namespace}', '${componentName}'].includes(part));
            
            for (let i = 0; i < namespaceParts.length && i < realPathParts.length; i++) {
                if (namespaceParts[i].toLowerCase() === realPathParts[i].toLowerCase()) {
                    matchedParts++;
                }
            }
            
            matchScore = (matchedParts * 10) - 
                        Math.abs(realPathParts.length - namespaceParts.length) +
                        (matchedParts > 0 ? 5 : 0);

            if (matchScore > bestMatch.score) {
                const remainingParts = namespaceParts.slice(matchedParts);
                bestMatch = {
                    path: remainingParts.join(":"),
                    score: matchScore
                };
            }
        }

        return bestMatch.path;
    }
} 