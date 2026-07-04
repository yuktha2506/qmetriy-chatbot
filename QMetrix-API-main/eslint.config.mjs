import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
    { languageOptions: { globals: globals.node } },

    pluginJs.configs.recommended,

    {
        rules: {
            'quotes': ['error', 'single'],              // Enforce single quotes
            'semi': ['error', 'always'],                // Enforce semicolons
            'indent': ['error', 4],                     // Enforce 4 spaces for indentation
            'no-var': 'error',                          // Disallow var
            'prefer-const': 'error',                    // Prefer const for variables not reassigned
            'eqeqeq': ['error', 'always'],              // Require strict equality
            'curly': ['error', 'all'],                  // Enforce curly braces for all control blocks
            'arrow-spacing': ['error', {                // Enforce spacing around arrows in arrow functions
                'before': true,
                'after': true,
            }],
            'object-curly-spacing': ['error', 'always'],  // Enforce spacing inside curly braces
            'max-len': ['error', {                      // Limit line length for readability
                'code': 200,
                'ignoreComments': true,
            }],
            'no-multiple-empty-lines': ['error', {      // Disallow multiple empty lines
                'max': 1,
                'maxEOF': 0,
            }],
            'callback-return': 'error',                 // Enforce return in callbacks
            'handle-callback-err': 'error',             // Require error handling in callbacks
            'no-console': ['warn', { 'allow': ['warn', 'error'] }],
            'no-process-exit': 'error',                  // Disallow use of process.exit()
        },
    },
];
