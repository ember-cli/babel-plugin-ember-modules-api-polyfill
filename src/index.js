'use strict';

const mapping = require('ember-modules-codemod/config/mapping');

module.exports = function(babel) {
  const t = babel.types;

  // Flips the codemod mapping into an 'import' indexed object, that exposes the
  // default import as well as named imports, e.g. import {foo} from 'bar'
  const reverseMapping = {};
  Object.keys(mapping).forEach(global => {
    const imported = mapping[global];
    const importRoot = imported[0];
    let importName = imported[1];
    if (!importName) {
      importName = 'default';
    }

    if (!reverseMapping[importRoot]) {
      reverseMapping[importRoot] = {};
    }

    reverseMapping[importRoot][importName] = global;
  });

  return {
    name: 'ember-modules-api-polyfill',
    visitor: {
      ImportDeclaration(path) {
        let node = path.node;
        let replacements = [];

        // Ignore non @ember imports
        if (!importRoot.startsWith('@ember/')) {
          return;
        }

        // Ensure this is a valid module
        if (!reverseMapping[node.source.value]) {
          throw path.buildCodeFrameError(`${node.source.value} is not a valid import`);
        }

        // This is the mapping to use for the import statement
        const mapping = reverseMapping[node.source.value];

        // Iterate all the specifiers and attempt to locate their mapping
        node.specifiers.forEach(specifier => {
          let importName;

          // imported is the name of the module being imported, e.g. import foo from bar
          const imported = specifier.imported;

          // local is the name of the module in the current scope, this is usually the same
          // as the imported value, unless the module is aliased
          const local = specifier.local;

          // We only care about these 2 specifiers
          if (
            specifier.type !== 'ImportDefaultSpecifier' &&
            specifier.type !== 'ImportSpecifier'
          ) {
            return;
          }

          // Determine the import name, either default or named
          if (specifier.type === 'ImportDefaultSpecifier') {
            importName = 'default';
          } else {
            importName = imported.name;
          }

          // Extract the global mapping
          const global = mapping[importName];

          // Ensure the module being imported exists
          if (!global) {
            throw path.buildCodeFrameError(`${node.source.value} does not have a ${importName} import`);
          }

          // Repalce the node with a new `var name = Ember.something`
          replacements.push(
            t.variableDeclaration('var', [
              t.variableDeclarator(
                local,
                t.memberExpression(t.identifier('Ember'), t.identifier(global))
              ),
            ])
          );
        });

        if (replacements.length > 0) {
          path.replaceWithMultiple(replacements);
        }
      },
    },
  };
};
