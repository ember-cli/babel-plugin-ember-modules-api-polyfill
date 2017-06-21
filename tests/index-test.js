'use strict';
/* globals QUnit */

const describe = QUnit.module;
const it = QUnit.test;
const babel = require('babel-core');
const Plugin = require('../src');
const mapping = require('ember-modules-codemod/config/mapping');

function transform(source) {
  let result = babel.transform(source, {
    plugins: [
      [Plugin],
    ],
  });

  return result.code;
}

function matches(source, expected) {
  it(`${source}`, assert => {
    let actual = transform(source);

    assert.equal(actual, expected);
  });
}

// Ensure each of the config mappings is mapped correctly
Object.keys(mapping).forEach(global => {
  const imported = mapping[global];
  const importRoot = imported[0];

  // Only process @ember imports
  if (!importRoot.startsWith('@ember/')) {
    return;
  }

  let importName = imported[1];
  if (!importName) {
    importName = 'default';
  }
  const varName = importName === 'default' ? 'defaultModule' : importName;
  const localName = varName === 'defaultModule' ? varName : `{ ${varName} }`;

  describe(`ember-modules-api-polyfill-${importRoot}-with-${importName}`, () => {
    matches(
      `import ${localName} from '${importRoot}';`,
      `var ${varName} = Ember.${global};`
    );
  });
});

// Ensure mapping multiple imports makes multiple variables
describe(`ember-modules-api-polyfill-import-multiple`, () => {
  matches(
    `import { empty, notEmpty } from '@ember/object/computed';`,
    `var empty = Ember.computed.empty;
var notEmpty = Ember.computed.notEmpty;`
  );
});

// Ensure mapping a named aliased import
describe(`ember-modules-api-polyfill-named-as-alias`, () => {
  matches(
    `import { empty as isEmpty } from '@ember/object/computed';`,
    `var isEmpty = Ember.computed.empty;`
  );
});

// Ensure mapping a named and aliased import makes multiple named variables
describe(`ember-modules-api-polyfill-import-named-multiple`, () => {
  matches(
    `import { empty, notEmpty as foo } from '@ember/object/computed';`,
    `var empty = Ember.computed.empty;
var foo = Ember.computed.notEmpty;`
  );
});

// Ensure mapping the default as an alias works
describe(`ember-modules-api-polyfill-default-as-alias`, () => {
  matches(
    `import { default as foo } from '@ember/component';`,
    `var foo = Ember.Component;`
  );
});

// Ensure exception thrown for an invalid import
describe(`ember-modules-api-polyfill-invalid-import`, () => {
  it('throws an error for missing import', assert => {
    assert.throws(() => {
      let input = `import foo from '@ember/foobar';`;
      transform(input);
    }, '1 | import foo from \'@ember/foobar\';');
  });
});

// Ensure exception thrown for an invalid named import
describe(`ember-modules-api-polyfill-invalid-named-import`, () => {
  it('throws an error for missing named import', assert => {
    assert.throws(() => {
      let input = `import { foo } from '@ember/component';`;
      transform(input);
    }, '1 | import { foo } from \'@ember/foobar\';');
  });
});
