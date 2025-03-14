# Change Log

All notable changes to the "vscode-symfony-ux-twig-component" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.6] - 2024-11-14

- Significantly improved template file detection for complex directory structures
- Added multiple fallback strategies for finding template files
- Enhanced namespace parsing with better support for multi-level namespaces
- Added more detailed logging for troubleshooting path resolution issues

## [0.0.5] - 2024-11-14

- Fixed quick pick menu behavior: now only appears after clicking on component name (not on hover with Alt)
- Added context menu option for navigating to Twig components
- Improved menu positioning to appear closer to the cursor
- Enhanced user experience by showing all available options (component file, template file, or both)

## [0.0.4] - 2024-03-14

- Improved quick pick menu to appear at the mouse position
- Enhanced namespace parsing for better template file navigation
- Added support for more complex directory structures

## [0.0.3] - 2024-03-14

- Added quick pick menu when both component and template files are found
- User can now choose to open the component file, template file, or both files

## [0.0.2] - 2024-03-14

- The formatter now works alongside other formatters
- Completely redesigned configuration approach with base paths and relative component paths
- Added support for multi-level namespaces in component tags
- Improved navigation: now you can click on either the namespace or component name
- Fixed attribute formatting issues

## [0.0.1] - 2024-03-14

- Initial release
- Added syntax highlighting for Twig components
- Added clickable namespaces for navigation
- Added basic formatting for Twig component attributes