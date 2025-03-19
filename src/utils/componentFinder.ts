import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { debugLog, getConfiguredPaths } from './config';
import { TWIG_COMPONENT_NAMESPACE_REGEX } from './constants';

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

	// Handle empty namespace case - try to find a matching base path
	if (!fullNamespace) {
		debugLog('Empty namespace detected, searching for best base path');
		// Try to find a base path that is a direct component path
		for (const basePath of basePaths) {
			const cleanBasePath = basePath.replace(/\/+$/, '');
			const basePathParts = cleanBasePath.split('/');
			const lastPart = basePathParts[basePathParts.length - 1];
			
			// If the last part of the path is not in excluded directories, it might be a component namespace
			if (lastPart && !excludedDirectoryNames.includes(lastPart.toLowerCase())) {
				debugLog(`Found potential direct component base path: ${cleanBasePath}`);
				return { matchedBasePath: cleanBasePath, remainingNamespace: "" };
			}
		}
		// If no direct component path found, use the first base path
		debugLog(`No direct component path found, using first base path: ${basePaths[0]}`);
		return { matchedBasePath: basePaths[0], remainingNamespace: "" };
	}

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

	// If no match found, try each base path directly
	for (const basePath of basePaths) {
		const cleanBasePath = basePath.replace(/\/+$/, '');
		const basePathParts = cleanBasePath.split('/');
		const lastPart = basePathParts[basePathParts.length - 1];
		
		// If the last part of the path is not in excluded directories, it might be a component namespace
		if (lastPart && !excludedDirectoryNames.includes(lastPart.toLowerCase())) {
			debugLog(`Found potential direct component base path: ${cleanBasePath}`);
			return { matchedBasePath: cleanBasePath, remainingNamespace: fullNamespace };
		}
	}

	// If still no match found, return the full namespace
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
	const startIndex = line.indexOf('<twig:') + '<twig:'.length;
	const namespace = match[1] || ''; // Handle empty namespace
	const component = match[2];

	// Calculate positions based on whether there's a namespace
	const namespaceStart = namespace ? line.indexOf(namespace, startIndex) : startIndex;
	const namespaceEnd = namespace ? namespaceStart + namespace.length : startIndex;
	const componentStart = line.indexOf(component, namespace ? namespaceEnd + 1 : startIndex);
	const componentEnd = componentStart + component.length;

	debugLog(`Namespace position: ${namespaceStart}-${namespaceEnd}, Component position: ${componentStart}-${componentEnd}, cursor position: ${position.character}`);

	// Check if cursor is on either the namespace or component name
	const isOnNamespace = namespace ? (position.character >= namespaceStart && position.character <= namespaceEnd) : false;
	const isOnComponent = position.character >= componentStart && position.character <= componentEnd;

	if (!isOnNamespace && !isOnComponent) {
		debugLog('Cursor not on namespace or component name');
		return undefined;
	}

	debugLog(`Full namespace: ${namespace}, Component name: ${component}`);

	// Get configured paths
	const { phpBasePaths, phpComponentPaths, twigBasePaths, twigTemplatePaths } = getConfiguredPaths();

	debugLog(`PHP base paths: ${JSON.stringify(phpBasePaths)}`);
	debugLog(`PHP component paths: ${JSON.stringify(phpComponentPaths)}`);
	debugLog(`Twig base paths: ${JSON.stringify(twigBasePaths)}`);
	debugLog(`Twig template paths: ${JSON.stringify(twigTemplatePaths)}`);

	// Parse the namespace and match with base paths
	const phpResult = parseComponentNamespace(namespace, phpBasePaths);
	const twigResult = parseComponentNamespace(namespace, twigBasePaths);

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
			// For direct components, try both with and without namespace replacement
			if (!namespace) {
				// Try direct path
				const directPath = path.join(
					phpResult.matchedBasePath,
					componentPath
						.replace('${namespace}', '')
						.replace('${componentName}', component)
						.replace(/\/+/g, '/') // Clean up any double slashes
				);
				phpPossiblePaths.push(directPath);
				debugLog(`Added direct PHP path: ${directPath}`);

				// Try with base path as namespace
				const basePathParts = phpResult.matchedBasePath.split('/');
				const lastPart = basePathParts[basePathParts.length - 1];
				if (lastPart) {
					const withBasePath = path.join(
						phpResult.matchedBasePath,
						componentPath
							.replace('${namespace}', lastPart)
							.replace('${componentName}', component)
							.replace(/\/+/g, '/') // Clean up any double slashes
					);
					phpPossiblePaths.push(withBasePath);
					debugLog(`Added PHP path with base: ${withBasePath}`);
				}
			} else {
				// Normal namespace handling
				const resolvedPath = path.join(
					phpResult.matchedBasePath,
					componentPath
						.replace('${namespace}', phpResult.remainingNamespace ? phpResult.remainingNamespace.replace(/:/g, '/') : '')
						.replace('${componentName}', component)
						.replace(/\/+/g, '/') // Clean up any double slashes
				);
				phpPossiblePaths.push(resolvedPath);
				debugLog(`Added PHP path: ${resolvedPath}`);
			}
		}
	}

	// Add Twig paths
	if (twigResult.matchedBasePath) {
		for (const templatePath of twigTemplatePaths) {
			// For direct components, try both with and without namespace replacement
			if (!namespace) {
				// Try direct path
				const directPath = path.join(
					twigResult.matchedBasePath,
					templatePath
						.replace('${namespace}', '')
						.replace('${componentName}', component)
						.replace(/\/+/g, '/') // Clean up any double slashes
				);
				twigPossiblePaths.push(directPath);
				debugLog(`Added direct Twig path: ${directPath}`);

				// Try with base path as namespace
				const basePathParts = twigResult.matchedBasePath.split('/');
				const lastPart = basePathParts[basePathParts.length - 1];
				if (lastPart) {
					const withBasePath = path.join(
						twigResult.matchedBasePath,
						templatePath
							.replace('${namespace}', lastPart)
							.replace('${componentName}', component)
							.replace(/\/+/g, '/') // Clean up any double slashes
					);
					twigPossiblePaths.push(withBasePath);
					debugLog(`Added Twig path with base: ${withBasePath}`);
				}
			} else {
				// Normal namespace handling
				const resolvedPath = path.join(
					twigResult.matchedBasePath,
					templatePath
						.replace('${namespace}', twigResult.remainingNamespace ? twigResult.remainingNamespace.replace(/:/g, '/') : '')
						.replace('${componentName}', component)
						.replace(/\/+/g, '/') // Clean up any double slashes
				);
				twigPossiblePaths.push(resolvedPath);
				debugLog(`Added Twig path: ${resolvedPath}`);
			}
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
						.replace('${namespace}', namespace ? namespace.replace(/:/g, '/') : '')
						.replace('${componentName}', component)
						.replace(/\/+/g, '/') // Clean up any double slashes
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
						.replace('${namespace}', namespace ? namespace.replace(/:/g, '/') : '')
						.replace('${componentName}', component)
						.replace(/\/+/g, '/') // Clean up any double slashes
				);
				twigPossiblePaths.push(resolvedPath);
				debugLog(`Added fallback Twig path: ${resolvedPath}`);
			}
		}
	}

	// Add direct template paths for components
	for (const basePath of twigBasePaths) {
		// Add path with components directory
		const directPath = path.join(
			basePath,
			'components',
			namespace ? namespace.replace(/:/g, '/') : '',
			`${component}.html.twig`
		).replace(/\/+/g, '/'); // Clean up any double slashes
		twigPossiblePaths.push(directPath);
		debugLog(`Added direct Twig path: ${directPath}`);

		// For components without namespace, also try without the components directory
		if (!namespace) {
			const simplePath = path.join(basePath, `${component}.html.twig`);
			twigPossiblePaths.push(simplePath);
			debugLog(`Added simplified Twig path: ${simplePath}`);
		}
	}

	// Try additional template path patterns for complex structures
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
								.replace('${namespace}', phpResult.remainingNamespace ? phpResult.remainingNamespace.replace(/:/g, '/') : '')
								.replace('${componentName}', component)
								.replace(/\/+/g, '/') // Clean up any double slashes
						);
						twigPossiblePaths.push(resolvedPath);
						debugLog(`Added additional Twig path: ${resolvedPath}`);
					}
				}
			}
		}

		// Try simplified paths for components without namespace or when other attempts fail
		for (const basePath of twigBasePaths) {
			if (!namespace || 
				basePath.includes(namespace.replace(/:/g, '/')) ||
				basePath.toLowerCase().includes(namespace.replace(/:/g, '/').toLowerCase())) {
				const simplePath = path.join(basePath, `${component}.html.twig`);
				twigPossiblePaths.push(simplePath);
				debugLog(`Added simplified Twig path: ${simplePath}`);
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

	// If no files found, return undefined
	if (foundPhpFiles.length === 0 && foundTwigFiles.length === 0) {
		debugLog('No matching files found');
		return undefined;
	}

	return {
		fullNamespace: namespace,
		componentName: component,
		phpFiles: foundPhpFiles,
		twigFiles: foundTwigFiles
	};
} 