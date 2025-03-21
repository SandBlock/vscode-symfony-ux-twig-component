import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfiguredPaths } from './config';
import { TWIG_COMPONENT_NAMESPACE_REGEX } from './constants';

interface ComponentInfo {
	fullComponentPath: string;
	componentName: string;
	remainingNamespace: string;
}

interface PossiblePath {
	basePath: string;
	namespace: string;
}

interface FileSearchResult {
	fullNamespace: string;
	componentName: string;
	phpFiles: vscode.Uri[];
	twigFiles: vscode.Uri[];
}

function extractComponentFromDocument(document: vscode.TextDocument, position: vscode.Position): string | undefined {
	const line = document.lineAt(position.line).text;
	const match = TWIG_COMPONENT_NAMESPACE_REGEX.exec(line);

	if (!match) {
		return undefined;
	}

	const startIndex = line.indexOf('<twig:') + '<twig:'.length;
	const namespace = match[1] || '';
	const component = match[2];

	// Calculate positions
	const namespaceStart = namespace ? line.indexOf(namespace, startIndex) : startIndex;
	const namespaceEnd = namespace ? namespaceStart + namespace.length : startIndex;
	const componentStart = line.indexOf(component, namespace ? namespaceEnd + 1 : startIndex);
	const componentEnd = componentStart + component.length;

	// Check if cursor is on either namespace or component
	const isOnNamespace = namespace ? (position.character >= namespaceStart && position.character <= namespaceEnd) : false;
	const isOnComponent = position.character >= componentStart && position.character <= componentEnd;

	if (!isOnNamespace && !isOnComponent) {
		return undefined;
	}

	return namespace ? `${namespace}:${component}` : component;
}

function processComponentPath(fullComponentPath: string): ComponentInfo {
	const parts = fullComponentPath.split(':');
	const componentName = parts.pop() || '';
	const remainingNamespace = parts.join('/');

	return {
		fullComponentPath,
		componentName,
		remainingNamespace
	};
}

function findMatchingBasePath(fullComponentPath: string, basePaths: string[], excludedDirectoryNames: string[]): PossiblePath[] {
	const possiblePaths: PossiblePath[] = [];

	for (const basePath of basePaths) {
		const basePathParts = basePath.split('/');

		const filteredBasePathParts = basePathParts.filter(part => !excludedDirectoryNames.includes(part.toLowerCase()));
		const filteredBasePath = filteredBasePathParts.join(':');

		if (filteredBasePath != '' && fullComponentPath.startsWith(filteredBasePath)) {
			const charactersToRemove = filteredBasePathParts.length == 1 ? filteredBasePath.length + 1 : filteredBasePath.length;
			const remainingNamespace = fullComponentPath.slice(charactersToRemove); 
			possiblePaths.push({ basePath: basePath, namespace:remainingNamespace });
		}
	}

	if (possiblePaths.length == 0) {
		for (const basePath of basePaths) {
			possiblePaths.push({ basePath: basePath, namespace: fullComponentPath });
		}
	}
	return possiblePaths;
}

function generatePossiblePaths(
	possiblePaths: PossiblePath[],
	componentPaths: string[],
	componentName: string
): string[] {
	const paths: string[] = [];
	for (const possiblePath of possiblePaths) {
		const namespaceParts = possiblePath.namespace.split(':');
		namespaceParts.pop()
		const remainingNamespace = namespaceParts.join('/');
		paths.push(...buildPossiblePaths(possiblePath.basePath, componentPaths, componentName, remainingNamespace));
	}

	return paths;
}

function buildPossiblePaths(basePath: string, componentPaths: string[], componentName: string, remainingNamespace: string): string[] {
	const paths = componentPaths.map(componentPath => {
		let resolvedPath = componentPath
			.replace('${namespace}', remainingNamespace ? remainingNamespace : '')
			.replace('${componentName}', componentName)
			.replace(/\/+/g, '/') // Clean up double slashes
			.replace(/^\//, ''); // Remove leading slash

		resolvedPath = resolvedPath.replace(/\/\//g, '/');

		const finalPath = path.join(basePath, resolvedPath);
		return finalPath;
	});
	return paths;
}

function findExistingFiles(possiblePaths: string[], workspaceFolders: readonly vscode.WorkspaceFolder[]): vscode.Uri[] {
	const foundFiles: vscode.Uri[] = [];

	for (const workspaceFolder of workspaceFolders) {

		for (const possiblePath of possiblePaths) {
			const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);

			try {
				if (fs.existsSync(filePath)) {
					foundFiles.push(vscode.Uri.file(filePath));
				}
			} catch (error) {
				vscode.window.showInformationMessage(`Error checking file: ${error}`);
			}
		}
	}

	return foundFiles;
}

export async function findComponentFiles(document: vscode.TextDocument, position: vscode.Position): Promise<FileSearchResult | undefined> {
	// Step 1: Extract component from document
	const fullComponentPath = extractComponentFromDocument(document, position);
	if (!fullComponentPath) {
		return undefined;
	}

	// Step 2: Process component path
	const { componentName, remainingNamespace } = processComponentPath(fullComponentPath);

	// Step 3: Get configured paths
	const { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths, excludedDirectoryNames } = getConfiguredPaths();
	const phpMatch = findMatchingBasePath(fullComponentPath, phpBasePaths, excludedDirectoryNames);
	const twigMatch = findMatchingBasePath(fullComponentPath, twigBasePaths, excludedDirectoryNames);
	// Step 5: Generate possible paths
	const phpPossiblePaths: string[] = generatePossiblePaths(phpMatch, phpComponentPaths, componentName);
	const twigPossiblePaths: string[] = generatePossiblePaths(twigMatch, twigTemplatePaths, componentName);

	// Step 6: Find existing files
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		vscode.window.showInformationMessage('No workspace folders found');
		return undefined;
	}

	const foundPhpFiles = findExistingFiles(phpPossiblePaths, workspaceFolders);
	const foundTwigFiles = findExistingFiles(twigPossiblePaths, workspaceFolders);

	if (foundPhpFiles.length === 0 && foundTwigFiles.length === 0) {
		vscode.window.showInformationMessage('No matching files found');
		return undefined;
	}

	return {
		fullNamespace: remainingNamespace,
		componentName,
		phpFiles: foundPhpFiles,
		twigFiles: foundTwigFiles
	};
} 