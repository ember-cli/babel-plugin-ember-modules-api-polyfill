'use strict';

module.exports = function(babel) {
  let t = babel.types;

  return {
    name: 'ember-modules-api-polyfill',

    visitor: {
      ImportDeclaration(path) {
        let node = path.node;
        let replacements = [];

        if (node.source.value === '@ember/component') {
          node.specifiers.forEach(specifier => {
            let name = specifier.local;

            if (specifier.type === 'ImportDefaultSpecifier') {
              replacements.push(
                t.variableDeclaration('var', [
                  t.variableDeclarator(
                    name,
                    t.memberExpression(t.identifier('Ember'), t.identifier('Component'))
                  ),
                ])
              );
            }
          });

          if (replacements.length > 0) {
            path.replaceWithMultiple(replacements);
          }
        }
      },
    },
  };
};
