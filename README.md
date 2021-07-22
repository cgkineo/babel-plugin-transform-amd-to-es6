# babel-plugin-transform-amd-to-es6

> Convert umd to amd  
> Replace amd `define`/`require`/`return` with `import`/`export default`  
> Allow ES6 modules to register `export default` with `requirejs` client-side  

## Credits

https://github.com/buxlabs/amd-to-es6  
This module has been converted to use babel 7 ast  

https://github.com/buxlabs/abstract-syntax-tree  
This module provided some essential traversal code  

## Install

Using npm:

```sh
npm install --save-dev babel-plugin-transform-amd-to-es6
```

or using yarn:

```sh
yarn add babel-plugin-transform-amd-to-es6 --dev
```

## Usage

1. You will need to rework your module ids so that they match up to filenames.
Things like requirejs's path, shim and map directives need to be resolved on a per-project basis.
Module bundlers provide module resolution override interfaces.
2. To register ES6 modules with requirejs client-side, you need to specify a function to be
called by the ES6 code to define its `export default` as an requirejs module. The default function name is `__AMD`.
You need to include some code like this to make it work client-side:
```js
// Allow ES export default to be exported as amd modules
window.__AMD = function(id, value) {
  window.define(id, function() { return value; }); // define for external use
  window.require([id]); // force module to load
  return value; // return for export
};
```
With options:
```js
plugins: [
  [
    'transform-amd-to-es6',
    {
      umdToAMDModules: false, // false by default
      amdToES6Modules: true, // true by default
      amdDefineES6Modules: true, // false by default
      ignoreNestedRequires: true, // false by default
      defineFunctionName: '__AMD', // __AMD by default
      defineModuleId: (moduleId) => { // No default provided
        // convert filenames to client-side module ids
      },
      ignores: [] // don't transform packages included here
    }
  ]
]
```
