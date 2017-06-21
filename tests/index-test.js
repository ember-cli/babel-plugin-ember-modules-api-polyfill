'use strict';
/* globals QUnit */

const describe = QUnit.module;
const it = QUnit.test;

const babel = require('babel-core');

const Plugin = require('../src');

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

describe('ember-modules-api-polyfill', () => {
  matches(
    `import Component from '@ember/component';`,
    `var Component = Ember.Component;`
  );
});
