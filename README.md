# VSCode Symfony UX Twig Component

A Visual Studio Code extension for working with Symfony UX Twig Components. This extension provides formatting, navigation, and syntax highlighting for Twig components in Symfony UX projects.

## Features

### Twig Component Formatting

The extension automatically formats Twig components to ensure they are properly structured. It supports both single-line and multi-line formatting styles.

Example of formatted Twig component:

```twig
<twig:Content:Menu:MenuItemCard
    routename="app_home"
    title="Home"
    routeparams="{{ mergedParams }}"
>
```

### Navigation to Component Files

You can navigate to the PHP class and Twig template files for a component by clicking on the component name in a Twig file. This makes it easy to jump between the component implementation and its usage.

### Syntax Highlighting

The extension provides syntax highlighting for Twig components, making it easier to distinguish them from regular HTML tags.

## Configuration

The extension provides the following configuration options:

- `symfony-ux-twig-component.enabled`: Enable or disable the Twig component extension.
- `symfony-ux-twig-component.formattingStyle`: The formatting style to use for Twig components. 'multiline' puts attributes on separate lines, 'singleLine' keeps everything on one line.
- `symfony-ux-twig-component.componentPaths`: Base paths for component files. The extension will search for components in these directories.
- `symfony-ux-twig-component.debug`: Enable debug logging for the extension.
- `symfony-ux-twig-component.runLast`: Run the formatter last, after other formatters have run. This helps prevent other formatters from overriding the Twig component formatting.
- `symfony-ux-twig-component.timeout`: Timeout in milliseconds to wait before running the formatter after a document change or save.
- `symfony-ux-twig-component.maxLineLength`: Maximum line length for single-line components. Components with a single attribute will be kept on one line if the total length is less than this value (default: 120).
- `symfony-ux-twig-component.minAttributesMultiline`: Minimum number of attributes required to format a component with multiple lines. Components with fewer attributes will be kept on one line if the total length is less than maxLineLength (default: 2).

## Formatting

The extension provides formatting for Twig components. By default, components with multiple attributes are formatted with each attribute on a separate line:

```twig
<twig:Content:Menu:MenuItemCard
    routename="app_home"
    title="Home"
    routeparams="{{ mergedParams }}"
>
```

Components with a single attribute or fewer than the configured minimum number of attributes (default: 2) will be kept on a single line if the total length is less than the configured maximum line length (default: 120):

```twig
<twig:Content:Icon name="home">
```

## Commands

The extension provides the following commands:

- `symfony-ux-twig-component.navigateToComponent`: Navigate to the component files.
- `symfony-ux-twig-component.formatTwigComponents`: Format all Twig components in the current document.

## Keybindings

- `Cmd+Click` (macOS) or `Ctrl+Click` (Windows/Linux) on a component name to navigate to the component files.

## Requirements

- Visual Studio Code 1.96.0 or higher
- A Symfony UX project with Twig components

## Installation

1. Open VS Code
2. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the Quick Open dialog
3. Type `ext install vscode-symfony-ux-twig-component` and press Enter

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the MIT License.
