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

function findMatchingBasePath(fullComponentPath: string, basePaths: string[], excludedDirectoryNames: string[]): PossiblePath[] {
	// vscode.window.showInformationMessage(`Searching for matching base path for: ${fullComponentPath}`);
	const componentParts = fullComponentPath.split(':');
	const firstComponentPart = componentParts[0];

	const possiblePaths: PossiblePath[] = [];

	// Find exact matching base path
	for (const basePath of basePaths) {
		// Get the last part of the base path
		const basePathParts = basePath.split('/');
		// const lastPart = basePathParts[basePathParts.length - 1];

		const filteredBasePathParts = basePathParts.filter(part => !excludedDirectoryNames.includes(part.toLowerCase()));
		const filteredBasePath = filteredBasePathParts.join(':');
		if (filteredBasePath != '' && fullComponentPath.startsWith(filteredBasePath)) {
			const charactersToRemove = filteredBasePathParts.length == 1 ? filteredBasePath.length + 1 : filteredBasePath.length;
			const remainingNamespace = fullComponentPath.slice(charactersToRemove); // include : at the end
			//@todo implement best match (e.g. longest basePath that matches)
			possiblePaths.push({ basePath: basePath, namespace:remainingNamespace });
		}

		// Skip if the last part is in excluded directories
		// if (!lastPart || excludedDirectoryNames.includes(lastPart.toLowerCase())) {
		// 	// vscode.window.showInformationMessage(`Skipping ${basePath} - excluded directory`);
		// 	continue;
		// }

		// // Only match if the last part of the base path exactly matches the first part of the component
		// if (lastPart === firstComponentPart) {  // Removed toLowerCase() for exact matching
		// 	// vscode.window.showInformationMessage(`Found match! ${basePath} matches with ${firstComponentPart}`);
		// 	return {
		// 		foundBasePath: basePath,
		// 		remainingNamespace: componentParts.slice(1).join(':')
		// 	};
		// } else {
		// 	// vscode.window.showInformationMessage(`No match: "${lastPart}" !== "${firstComponentPart}"`);
		// }
	}
	if (possiblePaths.length == 0) {
		for (const basePath of basePaths) {
			possiblePaths.push({ basePath: basePath, namespace: fullComponentPath });
		}
	}

	// // Try matching with the first part of the base path
	// for (const basePath of basePaths) {
	// 	const basePathParts = basePath.split('/');
	// 	const firstPart = basePathParts[basePathParts.length - 1];

	// 	if (firstPart === firstComponentPart) {  // Removed toLowerCase() for exact matching
	// 		vscode.window.showInformationMessage(`Found match with first part! ${basePath} matches with ${firstComponentPart}`);
	// 		return {
	// 			foundBasePath: basePath,
	// 			remainingNamespace: componentParts.slice(1).join(':')
	// 		};
	// 	}
	// }

	// vscode.window.showInformationMessage(`No matching base path found for ${fullComponentPath}`);
	// return { foundBasePath: null, remainingNamespace: fullComponentPath };
	return possiblePaths;
}

function generatePossiblePaths(
	possiblePaths: PossiblePath[],
	componentPaths: string[],
	componentName: string
): string[] {
	// const namespaceParts = remainingNamespace.split(':');
	// namespaceParts.pop() || '';
	// remainingNamespace = namespaceParts.join('/');

	// if (basePath != null) {
	// 	return buildPossiblePaths(basePath, componentPaths, componentName, remainingNamespace);
	// }
	
	// const paths: string[] = [];
	// vscode.window.showInformationMessage(`Configured base paths: ${configuredBasePaths.join(', ')}`);
	// for (const configuredBasePath of configuredBasePaths) {
	// 	paths.push(...buildPossiblePaths(configuredBasePath, componentPaths, componentName, remainingNamespace));
	// }

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

		// If the path has empty namespace segments, clean them up
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
	// const phpMatch = findMatchingBasePath(fullComponentPath, phpBasePaths, excludedDirectoryNames);
	const twigMatch = findMatchingBasePath(fullComponentPath, twigBasePaths, excludedDirectoryNames);
const phpMatch = [];
	// Step 5: Generate possible paths
	// const phpPossiblePaths = phpMatch.foundBasePath
	// 	? generatePossiblePaths(phpMatch.foundBasePath, phpComponentPaths, componentName, phpMatch.remainingNamespace, phpBasePaths)
	// 	: [];
	const phpPossiblePaths: string[] = [];

	// const twigPossiblePaths = generatePossiblePaths(twigMatch.foundBasePath, twigTemplatePaths, componentName, twigMatch.remainingNamespace, twigBasePaths);
	const twigPossiblePaths: string[] = generatePossiblePaths(twigMatch, twigTemplatePaths, componentName);
	vscode.window.showInformationMessage(`Twig possible paths: ${twigPossiblePaths.join(', ')}`);

	// Step 6: Find existing files
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		// vscode.window.showInformationMessage('No workspace folders found');
		return undefined;
	}

	const foundPhpFiles = findExistingFiles(phpPossiblePaths, workspaceFolders);
	const foundTwigFiles = findExistingFiles(twigPossiblePaths, workspaceFolders);

	if (foundPhpFiles.length === 0 && foundTwigFiles.length === 0) {
		vscode.window.showInformationMessage('No matching files found');
		return undefined;
	}

	// vscode.window.showInformationMessage(`Found ${foundPhpFiles.length} PHP files and ${foundTwigFiles.length} Twig files`);

	return {
		fullNamespace: remainingNamespace,
		componentName,
		phpFiles: foundPhpFiles,
		twigFiles: foundTwigFiles
	};
} 