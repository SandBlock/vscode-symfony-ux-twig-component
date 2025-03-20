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
	// Split into parts and get component name
	const parts = fullComponentPath.split(':');
	const componentName = parts.pop() || '';
	const remainingNamespace = parts.join('/');

	return {
		fullComponentPath,
		componentName,
		remainingNamespace
	};
}

function findMatchingBasePath(fullComponentPath: string, basePaths: string[], excludedDirectoryNames: string[]): { foundBasePath: string | null, remainingNamespace: string } {
	for (const basePath of basePaths) {
		// Filter out excluded directories from base path
		const pathParts = basePath.split('/');
		const filteredParts = pathParts.filter(part => !excludedDirectoryNames.includes(part.toLowerCase()));
		const filteredBasePath = filteredParts.join('/');

		// Convert to namespace format for comparison
		const namespaceBasePath = filteredBasePath.replace(/\//g, ':');

		// Check if component path starts with the namespace base path
		if (fullComponentPath.startsWith(namespaceBasePath + ':')) {
			const remainingNamespace = fullComponentPath.substring(namespaceBasePath.length + 1);
			return { foundBasePath: basePath, remainingNamespace };
		}
	}

	return { foundBasePath: null, remainingNamespace: fullComponentPath };
}

function generatePossiblePaths(
	basePath: string,
	componentPaths: string[],
	componentName: string,
	remainingNamespace: string
): string[] {
	return componentPaths.map(componentPath => {
		let resolvedPath = componentPath
			.replace('${componentName}/', remainingNamespace)
			.replace('${componentName}', componentName);
		
		return path.join(basePath, resolvedPath).replace(/\/+/g, '/');
	});
}

function findExistingFiles(possiblePaths: string[], workspaceFolders: readonly vscode.WorkspaceFolder[]): vscode.Uri[] {
	const foundFiles: vscode.Uri[] = [];

	for (const workspaceFolder of workspaceFolders) {
		for (const possiblePath of possiblePaths) {
			const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
			if (fs.existsSync(filePath)) {
				foundFiles.push(vscode.Uri.file(filePath));
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

	// Step 4: Find matching base paths
	const phpMatch = findMatchingBasePath(fullComponentPath, phpBasePaths, excludedDirectoryNames);
	const twigMatch = findMatchingBasePath(fullComponentPath, twigBasePaths, excludedDirectoryNames);

	// Step 5: Generate possible paths
	const phpPossiblePaths = phpMatch.foundBasePath 
		? generatePossiblePaths(phpMatch.foundBasePath, phpComponentPaths, componentName, phpMatch.remainingNamespace)
		: [];

	const twigPossiblePaths = twigMatch.foundBasePath
		? generatePossiblePaths(twigMatch.foundBasePath, twigTemplatePaths, componentName, twigMatch.remainingNamespace)
		: [];

	// Step 6: Find existing files
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return undefined;
	}

	const foundPhpFiles = findExistingFiles(phpPossiblePaths, workspaceFolders);
	const foundTwigFiles = findExistingFiles(twigPossiblePaths, workspaceFolders);

	if (foundPhpFiles.length === 0 && foundTwigFiles.length === 0) {
		return undefined;
	}

	return {
		fullNamespace: remainingNamespace,
		componentName,
		phpFiles: foundPhpFiles,
		twigFiles: foundTwigFiles
	};
} 