// Regex to match Twig component tags with optional namespace
export const TWIG_COMPONENT_REGEX = /<twig:(?:([A-Za-z0-9_:]+):)?([A-Za-z0-9_]+)(?:\s|\/?>|$)/g;
export const TWIG_COMPONENT_NAMESPACE_REGEX = /<twig:(?:([A-Za-z0-9_:]+):)?([A-Za-z0-9_]+)(?:\s|\/?>|$)/;

// Regex to match Twig component attributes, including those with Twig variables
export const TWIG_ATTRIBUTE_REGEX = /\s+([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|"{{[^}]*}}"|'{{[^}]*}}'|"{{[^}]*}}"|'{{[^}]*}}')/g;

// Regex to detect flattened components (all on one line with multiple attributes)
export const FLATTENED_COMPONENT_REGEX = /<twig:[A-Za-z0-9_:]+:[A-Za-z0-9_]+\s+[a-zA-Z0-9_-]+=(?:"[^"]*"|'[^']*')\s+[a-zA-Z0-9_-]+=(?:"[^"]*"|'[^']*')/g;

// File extensions for component files
export const COMPONENT_FILE_EXTENSIONS = {
    PHP: '.php',
    TWIG: '.html.twig'
};

// Default paths for component files
export const DEFAULT_COMPONENT_PATHS = [
    'src/Components',
    'templates/components'
];

// Configuration section name
export const CONFIG_SECTION = 'symfony-ux-twig-component';

// Configuration keys
export const CONFIG_KEYS = {
    ENABLED: 'symfony-ux-twig-component.enabled',
    FORMATTING_STYLE: 'symfony-ux-twig-component.formattingStyle',
    COMPONENT_PATHS: 'symfony-ux-twig-component.componentPaths',
    PHP_BASE_PATHS: 'symfony-ux-twig-component.phpBasePaths',
    PHP_COMPONENT_PATHS: 'symfony-ux-twig-component.phpComponentPaths',
    TWIG_BASE_PATHS: 'symfony-ux-twig-component.twigBasePaths',
    TWIG_TEMPLATE_PATHS: 'symfony-ux-twig-component.twigTemplatePaths',
    EXCLUDED_DIRECTORY_NAMES: 'symfony-ux-twig-component.excludedDirectoryNames',
    FALLBACK_TEMPLATE_DIRS: 'symfony-ux-twig-component.fallbackTemplateDirs',
    DEBUG: 'symfony-ux-twig-component.debug',
    RUN_LAST: 'symfony-ux-twig-component.runLast',
    TIMEOUT: 'symfony-ux-twig-component.timeout',
    MAX_LINE_LENGTH: 'symfony-ux-twig-component.maxLineLength',
    MIN_ATTRIBUTES_MULTILINE: 'symfony-ux-twig-component.minAttributesMultiline'
};

// Formatting styles
export const FORMATTING_STYLES = {
    MULTILINE: 'multiline',
    SINGLE_LINE: 'singleLine'
};

// Default values
export const DEFAULT_VALUES = {
    MAX_LINE_LENGTH: 120,
    MIN_ATTRIBUTES_MULTILINE: 2
}; 