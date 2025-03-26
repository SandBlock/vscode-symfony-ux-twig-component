import * as fs from 'fs';
import { debounce } from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

export interface ComponentInfo {
    name: string;
    fullName: string;
    componentPath: string;
    filePath: string;
}

export class ComponentCache {
    private static instance: ComponentCache;
    private cache: Map<string, ComponentInfo[]> = new Map();
    private fileWatchers: vscode.FileSystemWatcher[] = [];
    private isScanning: boolean = false;
    private scanQueue: Set<string> = new Set();

    private constructor() {}

    public static getInstance(): ComponentCache {
        if (!ComponentCache.instance) {
            ComponentCache.instance = new ComponentCache();
        }
        return ComponentCache.instance;
    }

    public async getComponents(workspaceFolder: vscode.WorkspaceFolder, basePaths: string[], templatePaths: string[]): Promise<ComponentInfo[]> {
        const cacheKey = this.getCacheKey(workspaceFolder, basePaths, templatePaths);
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        await this.scanWorkspace(workspaceFolder, basePaths, templatePaths);
        return this.cache.get(cacheKey) || [];
    }

    private getCacheKey(workspaceFolder: vscode.WorkspaceFolder, basePaths: string[], templatePaths: string[]): string {
        return `${workspaceFolder.uri.fsPath}:${basePaths.join(',')}:${templatePaths.join(',')}`;
    }

    private async scanWorkspace(workspaceFolder: vscode.WorkspaceFolder, basePaths: string[], templatePaths: string[]): Promise<void> {
        if (this.isScanning) {
            this.scanQueue.add(this.getCacheKey(workspaceFolder, basePaths, templatePaths));
            return;
        }

        this.isScanning = true;
        const components: ComponentInfo[] = [];
        const workspacePath = workspaceFolder.uri.fsPath;

        try {
            for (const basePath of basePaths) {
                const fullPath = path.join(workspacePath, basePath);
                if (!fs.existsSync(fullPath)) {
                    continue;
                }
                await this.scanDirectory(fullPath, basePath, templatePaths, components);
            }

            const cacheKey = this.getCacheKey(workspaceFolder, basePaths, templatePaths);
            this.cache.set(cacheKey, components);
            this.setupFileWatchers(workspaceFolder, basePaths, templatePaths);
        } finally {
            this.isScanning = false;
            this.processScanQueue();
        }
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

    private setupFileWatchers(workspaceFolder: vscode.WorkspaceFolder, basePaths: string[], templatePaths: string[]): void {
        // Dispose existing watchers
        this.fileWatchers.forEach(watcher => watcher.dispose());
        this.fileWatchers = [];

        // Create new watchers for each base path
        for (const basePath of basePaths) {
            const fullPath = path.join(workspaceFolder.uri.fsPath, basePath);
            if (!fs.existsSync(fullPath)) {
                continue;
            }

            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolder, `${basePath}/**/*.twig`)
            );

            // Debounce the file change handler
            const debouncedHandler = debounce(async (uri: vscode.Uri) => {
                await this.handleFileChange(workspaceFolder, basePaths, templatePaths);
            }, 1000);

            watcher.onDidChange(debouncedHandler);
            watcher.onDidCreate(debouncedHandler);
            watcher.onDidDelete(debouncedHandler);

            this.fileWatchers.push(watcher);
        }
    }

    private async handleFileChange(workspaceFolder: vscode.WorkspaceFolder, basePaths: string[], templatePaths: string[]): Promise<void> {
        const cacheKey = this.getCacheKey(workspaceFolder, basePaths, templatePaths);
        this.cache.delete(cacheKey);
        await this.scanWorkspace(workspaceFolder, basePaths, templatePaths);
    }

    private async processScanQueue(): Promise<void> {
        if (this.scanQueue.size > 0) {
            const nextKey = this.scanQueue.values().next().value;
            if (!nextKey) {
                return;
            }
            this.scanQueue.delete(nextKey);
            // Extract workspace folder and paths from the cache key
            const [workspacePath, basePathsStr, templatePathsStr] = nextKey.split(':');
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(workspacePath));
            if (workspaceFolder) {
                const basePaths = basePathsStr.split(',');
                const templatePaths = templatePathsStr.split(',');
                await this.scanWorkspace(workspaceFolder, basePaths, templatePaths);
            }
        }
    }

    public dispose(): void {
        this.fileWatchers.forEach(watcher => watcher.dispose());
        this.fileWatchers = [];
        this.cache.clear();
        this.scanQueue.clear();
    }
} 