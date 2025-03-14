import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TWIG_COMPONENT_NAMESPACE_REGEX } from './constants';
import { getConfiguredPaths, debugLog } from './config';

// Parse the namespace from a component tag and match it with base paths
export function parseComponentNamespace(fullNamespace: string, basePaths: string[]): {
	matchedBasePath: string | null,
	remainingNamespace: string
} {
	// Debug logging
	debugLog(`Parsing namespace: ${fullNamespace}`);
	debugLog(`Available base paths: ${JSON.stringify(basePaths)}`);

	// Get excluded directory names from configuration
	const { excludedDirectoryNames } = getConfiguredPaths();

	// Convert namespace format (e.g., "Content:Menu") to path format (e.g., "Content/Menu")
	const namespaceParts = fullNamespace.split(':');
	debugLog(`Namespace parts: ${JSON.stringify(namespaceParts)}`);

	// Try to match with base paths - first try exact matches
	for (const basePath of basePaths) {
		// Remove trailing slashes from base path
		const cleanBasePath = basePath.replace(/\/+$/, '');

		// Convert base path to namespace format for comparison
		const basePathParts = cleanBasePath.split('/');
		let basePathNamespace = '';

		// Skip empty parts and convert to namespace format
		for (const part of basePathParts) {
			if (part && !excludedDirectoryNames.includes(part.toLowerCase())) {
				basePathNamespace += (basePathNamespace ? ':' : '') + part;
			}
		}

		debugLog(`Base path: ${cleanBasePath}, converted to namespace: ${basePathNamespace}`);

		// Check for exact match (for cases like templates/components/Content)
		if (basePathNamespace && basePathNamespace === fullNamespace) {
			debugLog(`Exact match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
			return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
		}

		// Check if the namespace starts with the base path namespace
		if (basePathNamespace && fullNamespace.startsWith(basePathNamespace + ':')) {
			// Remove the matched part from the namespace
			const remainingNamespace = fullNamespace.substring(basePathNamespace.length + 1);
			debugLog(`Prefix match found! Base path: ${cleanBasePath}, remaining namespace: ${remainingNamespace}`);
			return { matchedBasePath: cleanBasePath, remainingNamespace };
		}

		// Check if the base path starts with the namespace (reverse match)
		if (basePathNamespace && basePathNamespace.startsWith(fullNamespace + ':')) {
			debugLog(`Reverse match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
			return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
		}

		// Check if the base path contains the full namespace
		if (basePathNamespace && basePathNamespace.includes(fullNamespace)) {
			debugLog(`Contained match found! Base path: ${cleanBasePath}, remaining namespace: ""`);
			return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
		}
	}

	// Try to match partial paths (for more complex directory structures)
	for (const basePath of basePaths) {
		const cleanBasePath = basePath.replace(/\/+$/, '');
		const basePathParts = cleanBasePath.split('/').filter(part => part && !excludedDirectoryNames.includes(part.toLowerCase()));

		// Try to match as many parts as possible from the beginning
		let matchedParts = 0;
		for (let i = 0; i < Math.min(basePathParts.length, namespaceParts.length); i++) {
			if (basePathParts[i].toLowerCase() === namespaceParts[i].toLowerCase()) {
				matchedParts++;
			} else {
				break;
			}
		}

		if (matchedParts > 0) {
			const remainingNamespace = namespaceParts.slice(matchedParts).join(':');
			debugLog(`Partial match found! Base path: ${cleanBasePath}, matched parts: ${matchedParts}, remaining namespace: ${remainingNamespace}`);
			return { matchedBasePath: cleanBasePath, remainingNamespace };
		}

		// Try to match parts in any order (for cases where the directory structure doesn't match the namespace exactly)
		const basePathPartsLower = basePathParts.map(part => part.toLowerCase());
		const matchedNamespaceParts: string[] = [];
		const unmatchedNamespaceParts: string[] = [];

		for (const part of namespaceParts) {
			if (basePathPartsLower.includes(part.toLowerCase())) {
				matchedNamespaceParts.push(part);
			} else {
				unmatchedNamespaceParts.push(part);
			}
		}

		if (matchedNamespaceParts.length > 0) {
			const remainingNamespace = unmatchedNamespaceParts.join(':');
			debugLog(`Partial unordered match found! Base path: ${cleanBasePath}, matched parts: ${matchedNamespaceParts.join(':')}, remaining namespace: ${remainingNamespace}`);
			return { matchedBasePath: cleanBasePath, remainingNamespace };
		}
	}

	// If no match found, return the full namespace
	debugLog(`No match found, using full namespace: ${fullNamespace}`);
	return { matchedBasePath: null, remainingNamespace: fullNamespace };
}

// Find component files based on the cursor position
export async function findComponentFiles(document: vscode.TextDocument, position: vscode.Position): Promise<{
	fullNamespace: string,
	componentName: string,
	phpFiles: vscode.Uri[],
	twigFiles: vscode.Uri[]
} | undefined> {
	const line = document.lineAt(position.line).text;
	debugLog(`Clicked line: ${line}`);

	const match = TWIG_COMPONENT_NAMESPACE_REGEX.exec(line);

	if (!match) {
		debugLog('No component tag match found in line');
		return undefined;
	}

	debugLog(`Component match: ${JSON.stringify(match)}`);

	// Get the positions of both namespace and component name
	const namespaceStart = line.indexOf(match[1], match.index + 6); // 6 is the length of "<twig:"
	const namespaceEnd = namespaceStart + match[1].length;

	const componentStart = line.indexOf(match[2], namespaceEnd + 1); // +1 for the colon
	const componentEnd = componentStart + match[2].length;

	debugLog(`Namespace position: ${namespaceStart}-${namespaceEnd}, Component position: ${componentStart}-${componentEnd}, cursor position: ${position.character}`);

	// Check if cursor is on either the namespace or component name
	const isOnNamespace = position.character >= namespaceStart && position.character <= namespaceEnd;
	const isOnComponent = position.character >= componentStart && position.character <= componentEnd;

	if (!isOnNamespace && !isOnComponent) {
		debugLog('Cursor not on namespace or component name');
		return undefined;
	}

	// Parse the component parts
	const fullNamespace = match[1];
	const componentName = match[2];

	debugLog(`Full namespace: ${fullNamespace}, Component name: ${componentName}`);

	// Get configured paths
	const { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths } = getConfiguredPaths();

	debugLog(`PHP base paths: ${JSON.stringify(phpBasePaths)}`);
	debugLog(`PHP component paths: ${JSON.stringify(phpComponentPaths)}`);
	debugLog(`Twig base paths: ${JSON.stringify(twigBasePaths)}`);
	debugLog(`Twig template paths: ${JSON.stringify(twigTemplatePaths)}`);

	// Parse the namespace and match with base paths
	const phpResult = parseComponentNamespace(fullNamespace, phpBasePaths);
	const twigResult = parseComponentNamespace(fullNamespace, twigBasePaths);

	debugLog(`PHP result: ${JSON.stringify(phpResult)}`);
	debugLog(`Twig result: ${JSON.stringify(twigResult)}`);

	// Search for the component in possible locations
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		debugLog('No workspace folders found');
		return undefined;
	}

	// Generate all possible paths
	const phpPossiblePaths: string[] = [];
	const twigPossiblePaths: string[] = [];

	// Add PHP paths
	if (phpResult.matchedBasePath) {
		for (const componentPath of phpComponentPaths) {
			const resolvedPath = path.join(
				phpResult.matchedBasePath,
				componentPath
					.replace('${namespace}', phpResult.remainingNamespace.replace(/:/g, '/'))
					.replace('${componentName}', componentName)
			);
			phpPossiblePaths.push(resolvedPath);
			debugLog(`Added PHP path: ${resolvedPath}`);
		}
	}

	// Add Twig paths
	if (twigResult.matchedBasePath) {
		for (const templatePath of twigTemplatePaths) {
			const resolvedPath = path.join(
				twigResult.matchedBasePath,
				templatePath
					.replace('${namespace}', twigResult.remainingNamespace.replace(/:/g, '/'))
					.replace('${componentName}', componentName)
			);
			twigPossiblePaths.push(resolvedPath);
			debugLog(`Added Twig path: ${resolvedPath}`);
		}
	}

	// If no base path matched, try all combinations
	if (!phpResult.matchedBasePath && !twigResult.matchedBasePath) {
		debugLog('No base path matched, trying all combinations');
		// For PHP
		for (const basePath of phpBasePaths) {
			for (const componentPath of phpComponentPaths) {
				const resolvedPath = path.join(
					basePath,
					componentPath
						.replace('${namespace}', fullNamespace.replace(/:/g, '/'))
						.replace('${componentName}', componentName)
				);
				phpPossiblePaths.push(resolvedPath);
				debugLog(`Added fallback PHP path: ${resolvedPath}`);
			}
		}

		// For Twig
		for (const basePath of twigBasePaths) {
			for (const templatePath of twigTemplatePaths) {
				const resolvedPath = path.join(
					basePath,
					templatePath
						.replace('${namespace}', fullNamespace.replace(/:/g, '/'))
						.replace('${componentName}', componentName)
				);
				twigPossiblePaths.push(resolvedPath);
				debugLog(`Added fallback Twig path: ${resolvedPath}`);
			}
		}
	}

	// Add direct template paths for the specific case of templates/components/[namespace]/[componentName].html.twig
	// This is a special case for the user's specific configuration
	for (const basePath of twigBasePaths) {
		const directPath = path.join(
			basePath,
			'components',
			fullNamespace.replace(/:/g, '/'),
			`${componentName}.html.twig`
		);
		twigPossiblePaths.push(directPath);
		debugLog(`Added direct Twig path: ${directPath}`);
	}

	// Try additional template path patterns for complex structures
	// This is a fallback for cases where the standard patterns don't work
	if (twigPossiblePaths.length === 0 || (twigResult.matchedBasePath === null && phpResult.matchedBasePath !== null)) {
		debugLog('Trying additional template path patterns');

		// Try to use the PHP namespace result to find the template
		if (phpResult.matchedBasePath) {
			// Extract the relevant part from the PHP base path
			const phpBasePart = phpResult.matchedBasePath.replace(/^src\//, '');
			debugLog(`Extracted PHP base part: ${phpBasePart}`);

			// Try to find matching template paths
			for (const basePath of twigBasePaths) {
				// Check if this base path might contain our component
				if (basePath.includes(phpBasePart) ||
					basePath.toLowerCase().includes(phpBasePart.toLowerCase())) {

					debugLog(`Found potential matching template base path: ${basePath}`);

					for (const templatePath of twigTemplatePaths) {
						const resolvedPath = path.join(
							basePath,
							templatePath
								.replace('${namespace}', phpResult.remainingNamespace.replace(/:/g, '/'))
								.replace('${componentName}', componentName)
						);
						twigPossiblePaths.push(resolvedPath);
						debugLog(`Added additional Twig path: ${resolvedPath}`);
					}
				}
			}
		}

		// Try with just the component name (for cases where the template is directly in the namespace directory)
		for (const basePath of twigBasePaths) {
			if (basePath.includes(fullNamespace.replace(/:/g, '/')) ||
				basePath.toLowerCase().includes(fullNamespace.replace(/:/g, '/').toLowerCase())) {

				const resolvedPath = path.join(basePath, `${componentName}.html.twig`);
				twigPossiblePaths.push(resolvedPath);
				debugLog(`Added simplified Twig path: ${resolvedPath}`);
			}
		}
	}

	debugLog(`Checking ${phpPossiblePaths.length + twigPossiblePaths.length} possible paths`);

	// Check all possible paths and find existing files
	const foundPhpFiles: vscode.Uri[] = [];
	const foundTwigFiles: vscode.Uri[] = [];

	for (const workspaceFolder of workspaceFolders) {
		// Check PHP files
		for (const possiblePath of phpPossiblePaths) {
			const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
			debugLog(`Checking PHP path: ${filePath}`);

			if (fs.existsSync(filePath)) {
				debugLog(`Found PHP file at: ${filePath}`);
				foundPhpFiles.push(vscode.Uri.file(filePath));
			}
		}

		// Check Twig files
		for (const possiblePath of twigPossiblePaths) {
			const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);
			debugLog(`Checking Twig path: ${filePath}`);

			if (fs.existsSync(filePath)) {
				debugLog(`Found Twig file at: ${filePath}`);
				foundTwigFiles.push(vscode.Uri.file(filePath));
			}
		}
	}

	// If we found PHP files but no Twig files, try a more aggressive search
	if (foundPhpFiles.length > 0 && foundTwigFiles.length === 0) {
		debugLog('Found PHP files but no Twig files, trying more aggressive search');

		// Get fallback template directories from configuration
		const { fallbackTemplateDirs } = getConfiguredPaths();

		// Try to find the template by searching for the component name in all template directories
		for (const workspaceFolder of workspaceFolders) {
			// Check in configured fallback template directories
			for (const templateDir of fallbackTemplateDirs) {
				const templateBasePath = path.join(workspaceFolder.uri.fsPath, templateDir);

				// Skip if the directory doesn't exist
				if (!fs.existsSync(templateBasePath)) {
					continue;
				}

				// Try to find the template by searching for files with the component name
				const searchPattern = `**/${componentName}.html.twig`;

				try {
					// This is a simplified version - in a real implementation, you'd use a proper glob search
					// For demonstration purposes, we're just showing the concept
					debugLog(`Would search for ${searchPattern} in ${templateBasePath}`);

					// For each twigBasePath, check if there's a file with the component name
					for (const basePath of twigBasePaths) {
						const possiblePath = path.join(basePath, `${componentName}.html.twig`);
						const filePath = path.join(workspaceFolder.uri.fsPath, possiblePath);

						debugLog(`Checking additional Twig path: ${filePath}`);

						if (fs.existsSync(filePath)) {
							debugLog(`Found Twig file at: ${filePath}`);
							foundTwigFiles.push(vscode.Uri.file(filePath));
						}

						// Check for the specific case of templates/components/[namespace]/[componentName].html.twig
						const componentsPath = path.join(basePath, 'components', fullNamespace.replace(/:/g, '/'), `${componentName}.html.twig`);
						const componentsFilePath = path.join(workspaceFolder.uri.fsPath, componentsPath);

						debugLog(`Checking specific components path: ${componentsFilePath}`);

						if (fs.existsSync(componentsFilePath)) {
							debugLog(`Found Twig file at: ${componentsFilePath}`);
							foundTwigFiles.push(vscode.Uri.file(componentsFilePath));
						}
					}
				} catch (error) {
					console.error(`Error searching for template: ${error}`);
				}
			}
		}
	}

	debugLog(`Found ${foundPhpFiles.length} PHP files and ${foundTwigFiles.length} Twig files`);

	// If no files found, return undefined
	if (foundPhpFiles.length === 0 && foundTwigFiles.length === 0) {
		debugLog('No matching files found');
		return undefined;
	}

	return {
		fullNamespace,
		componentName,
		phpFiles: foundPhpFiles,
		twigFiles: foundTwigFiles
	};
} 