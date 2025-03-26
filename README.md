# VSCode Symfony UX Twig Component

A Visual Studio Code extension for working with Symfony UX Twig Components. This extension provides navigation and syntax highlighting for Twig components in Symfony UX projects.

## Features

### Navigation to Component Files

You can navigate to the PHP class and Twig template files for a component by clicking on the component name in a Twig file. This makes it easy to jump between the component implementation and its usage.

### Syntax Highlighting

The extension provides syntax highlighting for Twig components, making it easier to distinguish them from regular HTML tags.

### Component Autocompletion

Get intelligent autocompletion for your Twig components while typing. The extension will suggest available components based on your current input.

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the Quick Open dialog
3. Type `ext install SanderVerschoor.vscode-symfony-ux-twig-component` and press Enter

### Manual Installation

1. Download the latest `.vsix` file from the [releases page](https://github.com/SandBlock/vscode-symfony-ux-twig-component/releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette
4. Type "Install from VSIX" and select the downloaded file

### Requirements

- Visual Studio Code 1.96.0 or higher
- A Symfony UX project with Twig components
- PHP 8.1 or higher (for Symfony UX components)

## Configuration

The extension provides the following configuration options:

### Basic Configuration

```json
{
    "symfony-ux-twig-component.enabled": true,
    "symfony-ux-twig-component.componentPaths": [
        "src/Components",
        "templates/components"
    ]
}
```

### Advanced Configuration

```json
{
    "symfony-ux-twig-component.enabled": true,
    "symfony-ux-twig-component.componentPaths": [
        {
            "path": "src/Components",
            "namespace": "App\\Components",
            "templateDir": "templates/components"
        }
    ],
    "symfony-ux-twig-component.excludedDirectoryNames": ["src", "templates", "components"],
    "symfony-ux-twig-component.fallbackTemplateDirs": ["templates"],
    "symfony-ux-twig-component.debug": false
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable or disable the Twig component extension |
| `componentPaths` | array/object | ["src/Components", "templates/components"] | Base paths for component files |
| `excludedDirectoryNames` | array | ["src", "templates", "components"] | Directory names to exclude when parsing namespaces |
| `fallbackTemplateDirs` | array | ["templates"] | Fallback template directories to search in |
| `debug` | boolean | false | Enable debug logging for the extension |

## Common Use Cases

### 1. Component Navigation

1. Place your cursor on a component name
2. Hold `Cmd` (macOS) or `Ctrl` (Windows/Linux) and click
3. Choose to open the component file, template file, or both

### 2. Component Autocompletion

1. Start typing `<twig:`
2. Type the first few letters of your component name
3. Select from the suggested components

## Troubleshooting

### Common Issues

1. **Components not showing up in autocompletion**
   - Check if your component paths are correctly configured
   - Verify that your components are in the correct directories
   - Try reloading VS Code window

2. **Navigation not working**
   - Ensure you're clicking on a valid component name
   - Check if the component file exists in the configured paths
   - Verify file permissions

### Debug Mode

Enable debug mode to get more detailed information:

```json
{
    "symfony-ux-twig-component.debug": true
}
```

Check the Output panel (View > Output) and select "Symfony UX Twig Component" from the dropdown to see debug messages.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This extension is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.

