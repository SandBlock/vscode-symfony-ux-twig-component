// Regex to match Twig component tags with multi-level namespaces
export const TWIG_COMPONENT_REGEX = /<twig:([A-Za-z0-9_]+):([A-Za-z0-9_]+)/g;
export const TWIG_COMPONENT_NAMESPACE_REGEX = /<twig:([A-Za-z0-9_:]+):([A-Za-z0-9_]+)/;

// Regex to match Twig component attributes, including those with Twig variables
export const TWIG_ATTRIBUTE_REGEX = /([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|"{{[^}]*}}"|'{{[^}]*}}'|{{[^}]*}})/g;

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
    ENABLED: 'enabled',
    FORMATTING_STYLE: 'formattingStyle',
    COMPONENT_PATHS: 'componentPaths',
    DEBUG: 'debug',
    RUN_LAST: 'runLast',
    TIMEOUT: 'timeout'
};

// Formatting styles
export const FORMATTING_STYLES = {
    MULTILINE: 'multiline',
    SINGLE_LINE: 'singleLine'
}; 