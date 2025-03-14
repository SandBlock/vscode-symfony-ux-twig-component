# VSCode Symfony UX Twig Component

This extension enhances the development experience when working with Symfony UX Twig Components in Visual Studio Code.

## Features

### Syntax Highlighting

The extension provides custom syntax highlighting for Symfony UX Twig Components:

- The `twig` keyword in component tags is highlighted in purple
- Component namespaces are highlighted in blue
- Component names are highlighted in red

Example:
```twig
<twig:Shared:Layout size="small">
```

### Clickable Components

Click on either the namespace part or the component name in a Twig component tag to navigate to the corresponding PHP class or Twig template file. For example, in `<twig:Content:Menu:MenuItemCard />`, you can click on either `Content:Menu` or `MenuItemCard` to navigate.

When you click on a component tag:
- If both the PHP component file and Twig template file are found, a quick pick menu will appear allowing you to choose which file(s) to open
- If only one file is found (either the PHP component or Twig template), it will open directly

#### Modifier Key + Click Navigation

There are two ways to use the modifier key with click navigation:

1. **Keyboard Shortcut**: 
   - On macOS: Press ⌘F12 (Cmd+F12) when your cursor is on a component tag
   - On Windows/Linux: Press Alt+F12 when your cursor is on a component tag
   
   This will show the quick pick menu with options to:
   - Open the PHP component file
   - Open the Twig template file
   - Open both files in separate tabs

2. **Context Menu**: Right-click on a component tag and select "Navigate to Twig Component" from the context menu.

This is useful when you want to choose which file to open, even if only one file type is found.

The extension will search for the component in the configured locations (see Extension Settings).

### Formatting

The extension ensures that attributes in Twig component tags are formatted with each attribute on a separate line, making your templates more readable:

Before formatting:
```twig
<twig:Content:Menu:MenuItemCard routeName="{{ menuItem.routeName }}" title="{{ menuItem.title }}" routeParams="{{ mergedParams }}" />
```

After formatting:
```twig
<twig:Content:Menu:MenuItemCard
    routeName="{{ menuItem.routeName }}"
    title="{{ menuItem.title }}"
    routeParams="{{ mergedParams }}"
/>
```

The formatter works alongside other formatters, so you can use it in combination with other Twig or HTML formatters.

## Requirements

- Visual Studio Code 1.96.0 or higher
- A Symfony project using Symfony UX Twig Components

## Extension Settings

This extension contributes the following settings:

### Base Paths and Component Paths

The extension uses a two-level configuration approach:

1. **Base Paths**: Define the root directories where your components are located
2. **Component Paths**: Define the relative paths from the base paths to the actual component files

When you use a component like `<twig:App:Menu:MenuItemCard />`, the extension:
1. Matches the namespace prefix (e.g., `App`) with the configured base paths
2. Removes the matched part from the namespace
3. Uses the remaining namespace parts and component name to find the file

#### PHP Component Settings

* `symfonyUxTwigComponent.phpBasePaths`: Base paths for PHP component files
* `symfonyUxTwigComponent.phpComponentPaths`: Relative paths from base paths to PHP component files

Default PHP base paths:
```json
[
  "src"
]
```

Default PHP component paths:
```json
[
  "Twig/Component/${namespace}/${componentName}.php",
  "Components/${namespace}/${componentName}.php",
  "Twig/Components/${namespace}/${componentName}.php"
]
```

#### Twig Template Settings

* `symfonyUxTwigComponent.twigBasePaths`: Base paths for Twig template files
* `symfonyUxTwigComponent.twigTemplatePaths`: Relative paths from base paths to Twig template files

Default Twig base paths:
```json
[
  "templates"
]
```

Default Twig template paths:
```json
[
  "components/${namespace}/${componentName}.html.twig",
  "twig/components/${namespace}/${componentName}.html.twig",
  "${namespace}/${componentName}.html.twig",
  "components/${namespace}/${componentName}.html.twig"
]
```

The extension will also directly check for templates in:
```
templates/components/[full namespace]/[componentName].html.twig
templates_new/components/[full namespace]/[componentName].html.twig
```

For example, with a component `<twig:Content:Menu:MenuItem />`, it will check:
```
templates/components/Content/Menu/MenuItem.html.twig
templates_new/components/Content/Menu/MenuItem.html.twig
```

#### Additional Configuration Options

* `symfonyUxTwigComponent.excludedDirectoryNames`: Directory names to exclude when parsing namespaces from paths. These are typically infrastructure directories that don't represent logical namespaces.

Default excluded directory names:
```json
[
  "src",
  "templates",
  "components"
]
```

* `symfonyUxTwigComponent.fallbackTemplateDirs`: Fallback template directories to search when a template file can't be found using the standard paths.

Default fallback template directories:
```json
[
  "templates"
]
```

### Example Configuration

For a project with the following structure:
```
src/
  App/
    Twig/
      Component/
        Menu/
          MenuItemCard.php
templates/
  app/
    components/
      menu/
        MenuItemCard.html.twig
```

You would configure:
```json
"symfonyUxTwigComponent.phpBasePaths": ["src/App"],
"symfonyUxTwigComponent.phpComponentPaths": ["Twig/Component/${namespace}/${componentName}.php"],
"symfonyUxTwigComponent.twigBasePaths": ["templates/app"],
"symfonyUxTwigComponent.twigTemplatePaths": ["components/${namespace}/${componentName}.html.twig"]
```

Then, when you use `<twig:App:Menu:MenuItemCard />`:
1. The extension matches "App" with "src/App"
2. The remaining namespace is "Menu"
3. It looks for the component at "src/App/Twig/Component/Menu/MenuItemCard.php"
4. It looks for the template at "templates/app/components/menu/MenuItemCard.html.twig"

## Known Issues

- The extension may not detect all possible locations of Twig component files by default. Use the configuration settings to add custom paths.

## Release Notes

### 0.0.7

- Made the extension more generic by removing project-specific folder names
- Added new configuration options for excluded directory names and fallback template directories
- Updated default configuration to be more generic and usable by anyone
- Improved namespace parsing to be more flexible with different project structures
- Added direct support for templates in templates/components/[namespace]/[componentName].html.twig pattern
- Added platform-specific keyboard shortcuts:
  - macOS: ⌘F12 (Cmd+F12) to show the file selection menu
  - Windows/Linux: Alt+F12 to show the file selection menu
- Added context menu option to show the file selection menu

### 0.0.6

- Significantly improved template file detection for complex directory structures
- Added multiple fallback strategies for finding template files
- Enhanced namespace parsing with better support for multi-level namespaces
- Added more detailed logging for troubleshooting path resolution issues

### 0.0.5

- Fixed quick pick menu behavior: now only appears after clicking on component name (not on hover with Alt)
- Added context menu option for navigating to Twig components
- Improved menu positioning to appear closer to the cursor
- Enhanced user experience by showing all available options (component file, template file, or both)

### 0.0.4

- Improved quick pick menu to appear at the mouse position
- Enhanced namespace parsing for better template file navigation
- Added support for more complex directory structures

### 0.0.3

- Added quick pick menu when both component and template files are found
- User can now choose to open the component file, template file, or both files

### 0.0.2

- The formatter now works alongside other formatters
- Component and template file paths are now configurable with a two-level approach (base paths + relative paths)
- Fixed attribute formatting issues

### 0.0.1

Initial release of the VSCode Symfony UX Twig Component extension.

---

## Development

### Building the Extension

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 to open a new window with your extension loaded

### Packaging the Extension

```bash
npm install -g @vscode/vsce
vsce package
```

This will create a `.vsix` file that you can install in VS Code.

### Installing the Extension

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X)
3. Click on the "..." menu in the top-right corner
4. Select "Install from VSIX..."
5. Choose the `.vsix` file you created

## License

MIT
