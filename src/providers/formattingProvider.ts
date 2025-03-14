import * as vscode from 'vscode';
import { TWIG_COMPONENT_REGEX, TWIG_ATTRIBUTE_REGEX, FORMATTING_STYLES } from '../utils/constants';
import { getFormattingConfig } from '../utils/config';

// Formatting provider for Twig components
export class TwigComponentFormattingProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
	provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): vscode.TextEdit[] {
		// Get configuration
		const config = getFormattingConfig();
		
		if (!config.enabled) {
			return [];
		}
		
		// Format the entire document
		const range = new vscode.Range(
			new vscode.Position(0, 0),
			document.lineAt(document.lineCount - 1).range.end
		);
		return this.formatTwigComponents(document, range, options);
	}

	provideDocumentRangeFormattingEdits(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): vscode.TextEdit[] {
		// Get configuration
		const config = getFormattingConfig();
		
		if (!config.enabled) {
			return [];
		}
		
		return this.formatTwigComponents(document, range, options);
	}

	public formatTwigComponents(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions
	): vscode.TextEdit[] {
		const edits: vscode.TextEdit[] = [];
		const text = document.getText(range);
		
		// First check for flattened components that need formatting
		// We'll use a different approach to find flattened components
		const lines = text.split('\n');
		
		// Process each line to find flattened components
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Reset the regex for each line
			const componentRegex = new RegExp(TWIG_COMPONENT_REGEX.source, TWIG_COMPONENT_REGEX.flags);
			let match;
			
			// Look for component tags in this line
			while ((match = componentRegex.exec(line)) !== null) {
				const namespace = match[1];
				const component = match[2];
				const startChar = match.index;
				
				// Find the end of the tag on this line
				const tagEndIndex = line.indexOf('>', startChar + match[0].length);
				if (tagEndIndex === -1) {
					continue; // No closing bracket on this line
				}
				
				// Extract the tag text
				const tagText = line.substring(startChar, tagEndIndex + 1);
				
				// Count attributes
				const attributes: string[] = [];
				const attributeRegex = new RegExp(TWIG_ATTRIBUTE_REGEX.source, TWIG_ATTRIBUTE_REGEX.flags);
				let attrMatch;
				
				while ((attrMatch = attributeRegex.exec(tagText)) !== null) {
					attributes.push(attrMatch[0].trim());
				}
				
				// Format the tag if it has attributes
				if (attributes.length > 0) {
					const tag = {
						namespace,
						component,
						startLine: i + range.start.line,
						startChar,
						endLine: i + range.start.line,
						endChar: tagEndIndex + 1,
						attributes
					};
					
					this.formatTag(document, tag, edits, options);
				}
			}
		}
		
		// Now handle multi-line tags
		let currentTag: { 
			namespace: string, 
			component: string, 
			startLine: number, 
			startChar: number,
			attributes: string[],
			endLine?: number,
			endChar?: number
		} | null = null;
		
		// First pass: identify all component tags and their attributes
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// If we're not currently tracking a tag, look for a new one
			if (!currentTag) {
				// Reset the regex
				const componentRegex = new RegExp(TWIG_COMPONENT_REGEX.source, TWIG_COMPONENT_REGEX.flags);
				const match = componentRegex.exec(line);
				
				if (match) {
					// Found a new tag
					currentTag = {
						namespace: match[1],
						component: match[2],
						startLine: i + range.start.line,
						startChar: match.index,
						attributes: []
					};
					
					// Check if the tag ends on this line
					const tagEndIndex = line.indexOf('>', match.index + match[0].length);
					if (tagEndIndex !== -1) {
						currentTag.endLine = i + range.start.line;
						currentTag.endChar = tagEndIndex + 1;
						
						// Extract attributes
						const tagText = line.substring(match.index, tagEndIndex + 1);
						const attributeRegex = new RegExp(TWIG_ATTRIBUTE_REGEX.source, TWIG_ATTRIBUTE_REGEX.flags);
						let attributeMatch;
						
						while ((attributeMatch = attributeRegex.exec(tagText)) !== null) {
							currentTag.attributes.push(attributeMatch[0].trim());
						}
						
						// Format the tag if it has attributes
						if (currentTag.attributes.length > 0) {
							this.formatTag(document, currentTag, edits, options);
						}
						
						currentTag = null;
					}
				}
			} else {
				// We're tracking a tag, look for the end
				const tagEndIndex = line.indexOf('>');
				if (tagEndIndex !== -1) {
					currentTag.endLine = i + range.start.line;
					currentTag.endChar = tagEndIndex + 1;
					
					// Extract attributes from this line
					const attributeRegex = new RegExp(TWIG_ATTRIBUTE_REGEX.source, TWIG_ATTRIBUTE_REGEX.flags);
					let attributeMatch;
					
					while ((attributeMatch = attributeRegex.exec(line)) !== null) {
						currentTag.attributes.push(attributeMatch[0].trim());
					}
					
					// Format the tag if it has attributes
					if (currentTag.attributes.length > 0) {
						this.formatTag(document, currentTag, edits, options);
					}
					
					currentTag = null;
				} else {
					// Still in the tag, collect attributes
					const attributeRegex = new RegExp(TWIG_ATTRIBUTE_REGEX.source, TWIG_ATTRIBUTE_REGEX.flags);
					let attributeMatch;
					
					while ((attributeMatch = attributeRegex.exec(line)) !== null) {
						currentTag.attributes.push(attributeMatch[0].trim());
					}
				}
			}
		}
		
		return edits;
	}
	
	private formatTag(
		document: vscode.TextDocument,
		tag: { 
			namespace: string, 
			component: string, 
			startLine: number, 
			startChar: number,
			attributes: string[],
			endLine?: number,
			endChar?: number
		},
		edits: vscode.TextEdit[],
		options: vscode.FormattingOptions
	): void {
		if (!tag.endLine || !tag.endChar) {
			return;
		}
		
		// Get configuration
		const config = getFormattingConfig();
		
		// Get the full tag text
		let fullTagText = '';
		if (tag.startLine === tag.endLine) {
			// Single line tag
			const line = document.lineAt(tag.startLine).text;
			fullTagText = line.substring(tag.startChar, tag.endChar);
		} else {
			// Multi-line tag
			const startLine = document.lineAt(tag.startLine).text;
			fullTagText = startLine.substring(tag.startChar);
			
			for (let i = tag.startLine + 1; i < tag.endLine; i++) {
				fullTagText += '\n' + document.lineAt(i).text;
			}
			
			const endLine = document.lineAt(tag.endLine).text;
			fullTagText += '\n' + endLine.substring(0, tag.endChar);
		}
		
		// Get the leading whitespace from the line
		const startLine = document.lineAt(tag.startLine);
		const leadingWhitespace = startLine.text.substring(0, startLine.firstNonWhitespaceCharacterIndex);
		
		// Check if this is a self-closing tag or a tag with content
		const isSelfClosing = fullTagText.trim().endsWith('/>');
		
		// Determine if we should use single-line or multi-line formatting
		const tagStart = `<twig:${tag.namespace}:${tag.component}`;
		let formattedText = '';
		
		// Check if we should use single-line formatting
		// 1. If the component has fewer attributes than the minimum required for multi-line
		// 2. If the total length of the component is less than the maximum line length
		const shouldUseSingleLine = 
			tag.attributes.length < config.minAttributesMultiline || 
			(tagStart.length + tag.attributes.reduce((sum, attr) => sum + attr.length + 1, 0) + (isSelfClosing ? 3 : 1)) < config.maxLineLength;
		
		if (shouldUseSingleLine && config.formattingStyle !== FORMATTING_STYLES.MULTILINE) {
			// Format as a single line
			formattedText = tagStart;
			
			// Add attributes on the same line with spaces between them
			for (const attr of tag.attributes) {
				formattedText += ' ' + attr;
			}
			
			// Add closing tag
			if (isSelfClosing) {
				formattedText += ' />';
			} else {
				formattedText += '>';
			}
		} else {
			// Format with attributes on separate lines
			formattedText = tagStart;
			
			// Add attributes on separate lines with proper indentation
			for (const attr of tag.attributes) {
				formattedText += '\n' + leadingWhitespace + '    ' + attr;
			}
			
			// Add closing tag on its own line
			if (isSelfClosing) {
				formattedText += '\n' + leadingWhitespace + '/>';
			} else {
				formattedText += '\n' + leadingWhitespace + '>';
			}
		}
		
		// Create the range to replace
		const replaceRange = new vscode.Range(
			new vscode.Position(tag.startLine, tag.startChar),
			new vscode.Position(tag.endLine, tag.endChar)
		);
		
		edits.push(vscode.TextEdit.replace(replaceRange, formattedText));
	}
}

// Register formatting providers
export function registerFormattingProviders(context: vscode.ExtensionContext): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];
	
	// Get formatting configuration
	const config = getFormattingConfig();
	
	if (config.enabled) {
		// Register the document formatting provider for Twig components
		const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
			{ language: 'twig' },
			new TwigComponentFormattingProvider()
		);
		disposables.push(formattingProvider);

		// Register a separate document range formatting provider for Twig components
		const rangeFormattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
			{ language: 'twig' },
			new TwigComponentFormattingProvider()
		);
		disposables.push(rangeFormattingProvider);
	}
	
	return disposables;
} 