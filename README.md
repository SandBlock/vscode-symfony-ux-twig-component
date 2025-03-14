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

When you use a component like `<twig:Content:Menu:MenuItemCard />`, the extension:
1. Matches the namespace prefix (e.g., `Content`) with the configured base paths
2. Removes the matched part from the namespace
3. Uses the remaining namespace parts and component name to find the file

#### PHP Component Settings

* `symfonyUxTwigComponent.phpBasePaths`: Base paths for PHP component files
* `symfonyUxTwigComponent.phpComponentPaths`: Relative paths from base paths to PHP component files

Default PHP base paths:
```json
[
  "src/Content",
  "src/Portal/Shared",
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
  "templates/content",
  "templates/portal/shared",
  "templates"
]
```

Default Twig template paths:
```json
[
  "components/${namespace}/${componentName}.html.twig",
  "twig/components/${namespace}/${componentName}.html.twig",
  "${namespace}/${componentName}.html.twig"
]
```

### Example Configuration

For a project with the following structure:
```
src/
  Content/
    Twig/
      Component/
        Menu/
          MenuItemCard.php
templates/
  content/
    components/
      menu/
        MenuItemCard.html.twig
```

You would configure:
```json
"symfonyUxTwigComponent.phpBasePaths": ["src/Content"],
"symfonyUxTwigComponent.phpComponentPaths": ["Twig/Component/${namespace}/${componentName}.php"],
"symfonyUxTwigComponent.twigBasePaths": ["templates/content"],
"symfonyUxTwigComponent.twigTemplatePaths": ["components/${namespace}/${componentName}.html.twig"]
```

Then, when you use `<twig:Content:Menu:MenuItemCard />`:
1. The extension matches "Content" with "src/Content"
2. The remaining namespace is "Menu"
3. It looks for the component at "src/Content/Twig/Component/Menu/MenuItemCard.php"
4. It looks for the template at "templates/content/components/menu/MenuItemCard.html.twig"

## Known Issues

- The extension may not detect all possible locations of Twig component files by default. Use the configuration settings to add custom paths.

## Release Notes

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
