'use strict';

const babel6 = require('babel-core');
const babel7 = require('@babel/core');
const Plugin = require('../src');
const mapping = require('ember-rfc176-data');

function transform(source, _plugins) {
  let plugins = _plugins || [[Plugin]];

  let result = babel6.transform(source, {
    plugins,
  });

  return result.code;
}

function transform7(source, _plugins) {
  let plugins = _plugins || [[Plugin]];

  let result = babel7.transformSync(source, { plugins });

  return result.code;
}

function transformWithPresetEnv(source, _plugins) {
  let plugins = [].concat([[Plugin]], _plugins || []);
  let result = babel7.transformSync(source, {
    plugins,

    presets: [['@babel/preset-env', { targets: { ie: '8' }, modules: false }]],
  });

  return result.code;
}

function matches(source, expected, only) {
  (only ? it.only : it)(`${source}`, () => {
    let actual = transform(source);

    expect(actual).toEqual(expected);
  });
}

// Ensure each of the config mappings is mapped correctly
mapping.forEach((exportDefinition) => {
  const importRoot = exportDefinition.module;

  let importName = exportDefinition.export;
  if (!importName) {
    importName = 'default';
  }
  const varName = importName === 'default' ? 'defaultModule' : importName;
  const localName = varName === 'defaultModule' ? varName : `{ ${varName} }`;

  describe(`${importRoot}`, () => {
    const source = `import ${localName} from '${importRoot}';var _x = ${varName}`;
    const expected = `var _x = ${exportDefinition.global};`;

    describe('babel@6', () => {
      it(`${source}`, () => {
        let actual = transform(source);

        expect(actual).toEqual(expected);
      });
    });

    describe('babel@7', () => {
      it(`${source}`, () => {
        let actual = transform7(source);

        expect(actual).toEqual(expected);
      });
    });
  });
});

// Ensure it works in complex scopes
describe(`ember-modules-api-polyfill-import-complex-scopes`, () => {
  matches(
    `import { isEmpty } from '@ember/utils';
var _x = someArray.every(item => isEmpty(item));
var _y = someOtherArray.some((isEmpty, idx) => isEmpty(idx));`,
    `
var _x = someArray.every(item => Ember.isEmpty(item));
var _y = someOtherArray.some((isEmpty, idx) => isEmpty(idx));`
  );
});

// Ensure mapping without reference just removes the line
describe(`ember-modules-api-polyfill-import-without-reference`, () => {
  matches(`import { empty } from '@ember/object/computed';`, ``);
});

// Ensure mapping multiple imports makes multiple variables
describe(`ember-modules-api-polyfill-import-multiple`, () => {
  matches(
    `import { empty, notEmpty } from '@ember/object/computed';var _x = empty;var _y = notEmpty;`,
    `var _x = Ember.computed.empty;var _y = Ember.computed.notEmpty;`
  );
});

// Ensure jQuery and RSVP imports work
describe(`ember-modules-api-polyfill-named-as-alias`, () => {
  matches(
    `import jQuery from 'jquery'; import RSVP from 'rsvp';var $ = jQuery;var _y = RSVP`,
    `var $ = Ember.$;var _y = Ember.RSVP;`
  );
});

// Ensure mapping a named aliased import
describe(`ember-modules-api-polyfill-named-as-alias`, () => {
  matches(
    `import { empty as isEmpty } from '@ember/object/computed';var _x = isEmpty;`,
    `var _x = Ember.computed.empty;`
  );
});

// Ensure mapping a named and aliased import makes multiple named variables
describe(`ember-modules-api-polyfill-import-named-multiple`, () => {
  matches(
    `import { empty, notEmpty as foo } from '@ember/object/computed';var _x = empty;var _y = foo;`,
    `var _x = Ember.computed.empty;var _y = Ember.computed.notEmpty;`
  );
});

// Ensure mapping the default as an alias works
describe(`ember-modules-api-polyfill-default-as-alias`, () => {
  matches(
    `import { default as foo } from '@ember/component';var _x = foo;`,
    `var _x = Ember.Component;`
  );
});

// Ensure reexporting things works
describe(`ember-modules-api-polyfill-reexport`, () => {
  matches(
    `export { default } from '@ember/component';`,
    `export default Ember.Component;`
  );

  matches(
    `export { default as Component } from '@ember/component';`,
    `export var Component = Ember.Component;`
  );

  matches(
    `export { computed } from '@ember/object';`,
    `export var computed = Ember.computed;`
  );

  matches(
    `export { computed as foo } from '@ember/object';`,
    `export var foo = Ember.computed;`
  );

  matches(`export var foo = 42;`, `export var foo = 42;`);

  it(`throws an error for wildcard imports`, () => {
    let input = `import * as debug from '@ember/debug';`;

    expect(() => {
      transform(input, [[Plugin]]);
    }).toThrow(
      /Using `import \* as debug from '@ember\/debug'` is not supported/
    );
  });

  it(`throws an error for wildcard exports`, () => {
    let input = `export * from '@ember/object/computed';`;

    expect(() => {
      transform(input, [[Plugin]]);
    }).toThrow(
      /Wildcard exports from @ember\/object\/computed are currently not possible/
    );
  });

  matches(`export * from 'foo';`, `export * from 'foo';`);
});

// Ensure unknown exports are not removed
describe(`unknown imports from known module`, () => {
  it(`allows disallowing import paths`, () => {
    let input = `import { derp } from '@ember/object/computed';`;

    expect(() => {
      transform(input, [[Plugin]]);
    }).toThrow(/@ember\/object\/computed does not have a derp export/);
  });
});

describe(`import then export`, () => {
  matches(
    `import { capitalize } from '@ember/string';
export { capitalize };`,
    `var capitalize = Ember.String.capitalize;

export { capitalize };`
  );
  matches(
    `import { capitalize, camelize } from '@ember/string';
    camelize("a thing");
    capitalize("another thing");
    export { capitalize };`,
    `var capitalize = Ember.String.capitalize;

Ember.String.camelize("a thing");
capitalize("another thing");
export { capitalize };`
  );
});

describe('options', () => {
  describe('ignore', () => {
    it(`allows ignoring import paths`, () => {
      let input = `import { assert } from '@ember/debug';`;
      let actual = transform(input, [[Plugin, { ignore: ['@ember/debug'] }]]);

      expect(actual).toEqual(input);
    });

    it(`allows ignoring specific named imports`, () => {
      let input = `import { assert, inspect } from '@ember/debug';var _x = inspect`;
      let actual = transform(input, [
        [
          Plugin,
          { ignore: { '@ember/debug': ['assert', 'warn', 'deprecate'] } },
        ],
      ]);

      expect(actual).toEqual(
        `import { assert } from '@ember/debug';var _x = Ember.inspect;`
      );
    });

    it('does not error when ignore is not present', () => {
      let input = `import { assert, inspect } from '@ember/debug';var _x = assert; var _y = inspect;`;
      let actual = transform(input, [[Plugin, { ignore: {} }]]);

      expect(actual).toEqual(`var _x = Ember.assert;var _y = Ember.inspect;`);
    });
  });

  describe('useEmberModule', () => {
    it('does not add Ember import when no Ember related imports are needed', () => {
      let input = `console.log('hi mom!');`;
      let actual = transform(input, [[Plugin, { useEmberModule: true }]]);

      expect(actual).toEqual(input);
    });

    it(`adds the ember import when used in sub-modules`, () => {
      let input = `import Component from '@ember/component';export default class extends Component {}`;
      let actual = transform(input, [[Plugin, { useEmberModule: true }]]);
      let expected = `import _Ember from 'ember';\nexport default class extends _Ember.Component {}`;

      expect(actual).toEqual(expected);
    });

    it(`keeps the ember import`, () => {
      let input = `import Ember from 'ember';let x = Ember;`;
      let actual = transform(input, [[Plugin, { useEmberModule: true }]]);

      expect(actual).toEqual(input);
    });

    it(`reuses a pre-existing ember import`, () => {
      let input = `import Ember from 'ember'; import Component from '@ember/component'; export default class extends Component {}`;
      let actual = transform(input, [[Plugin, { useEmberModule: true }]]);
      let expected = `import Ember from 'ember';export default class extends Ember.Component {}`;

      expect(actual).toEqual(expected);
    });

    it(`keeps the ember import when renamed`, () => {
      let input = `import BestFramework from 'ember';let x = BestFramework;`;
      let actual = transform(input, [[Plugin, { useEmberModule: true }]]);

      expect(actual).toEqual(input);
    });

    it(`import then export`, () => {
      let input = `import mbr from 'ember';export const Ember = mbr;`;
      let actual = transform(input, [[Plugin, { useEmberModule: true }]]);

      expect(actual).toEqual(input);
    });
  });
});

describe(`import from 'ember'`, () => {
  matches(`import Ember from 'ember';var _x = Ember;`, `var _x = Ember;`);
  matches(`import Em from 'ember'; var _x = Em;`, `var _x = Ember;`);
  matches(`import Asdf from 'ember';var _x = Asdf;`, `var _x = Ember;`);
  matches(`import './foo';`, `import './foo';`);
});

describe(`import without specifier is removed`, () => {
  matches(`import 'ember';`, ``);
  matches(`import '@ember/component';`, ``);
});

describe('when used with @babel/preset-env', () => {
  it('generally works', () => {
    let source = `
      import Application from '@ember/application';

      export default Application.extend({});
    `;
    let actual = transformWithPresetEnv(source);

    expect(actual).toEqual(`export default Ember.Application.extend({});`);
  });

  it('does not have issues with ember-google-maps style helper', () => {
    let source = `
import { computed, getProperties } from '@ember/object';
import ObjectProxy from '@ember/object/proxy';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';

let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);

let position = computed('lat', 'lng', function() {
  const { lat, lng } = getProperties(this, 'lat', 'lng');
  return (lat && lng) ? new google.maps.LatLng(lat, lng) : undefined;
});

function position2() {
  return computed('lat', 'lng', function() {
    const { lat, lng } = getProperties(this, 'lat', 'lng');
    return (lat && lng) ? new google.maps.LatLng(lat, lng) : undefined;
  });
}

function computedPromise(...args) {
  let func = args.pop();
  return computed(...args, function() {
    return ObjectPromiseProxy.create({
      promise: func.apply(this)
    });
  });
}

export { computedPromise, position };
`;

    let actual = transformWithPresetEnv(source);

    expect(actual).toEqual(
      `var ObjectPromiseProxy = Ember.ObjectProxy.extend(Ember.PromiseProxyMixin);
var position = Ember.computed('lat', 'lng', function () {
  var _Ember$getProperties = Ember.getProperties(this, 'lat', 'lng'),
      lat = _Ember$getProperties.lat,
      lng = _Ember$getProperties.lng;

  return lat && lng ? new google.maps.LatLng(lat, lng) : undefined;
});

function position2() {
  return Ember.computed('lat', 'lng', function () {
    var _Ember$getProperties2 = Ember.getProperties(this, 'lat', 'lng'),
        lat = _Ember$getProperties2.lat,
        lng = _Ember$getProperties2.lng;

    return lat && lng ? new google.maps.LatLng(lat, lng) : undefined;
  });
}

function computedPromise() {
  var _Ember;

  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  var func = args.pop();
  return (_Ember = Ember).computed.apply(_Ember, args.concat([function () {
    return ObjectPromiseProxy.create({
      promise: func.apply(this)
    });
  }]));
}

export { computedPromise, position };`
    );
  });
});

describe('when used with typescript', () => {
  // Example taken from Ember Data:
  // https://github.com/emberjs/data/blob/70b0c55e1a950bed1da64d0ecb4eaa0d5df92f9f/packages/store/addon/-private/system/fetch-manager.ts#L124
  // https://github.com/emberjs/data/blob/70b0c55e1a950bed1da64d0ecb4eaa0d5df92f9f/packages/store/addon/-private/system/fetch-manager.ts#L124
  // https://github.com/emberjs/data/blob/70b0c55e1a950bed1da64d0ecb4eaa0d5df92f9f/packages/store/addon/-private/system/fetch-manager.ts#L77
  it(`works when you use an import as both a type and as a TSQualifiedName value`, () => {
    let source = `
    import { default as RSVP, Promise } from 'rsvp';
    RSVP.Promise.resolve().then(() => {});
    function scheduleSave(identifier: RecordIdentifier, options: any = {}): RSVP.Promise<null | SingleResourceDocument> {
    }
    `;

    let actual = transform7(source, [
      require('@babel/plugin-transform-typescript'),
      Plugin,
    ]);

    expect(actual).toEqual(
      `Ember.RSVP.Promise.resolve().then(() => {});\n\nfunction scheduleSave(identifier, options = {}) {}`
    );
  });

  it(`works when you use an import as both a type and a TSDeclareFunction`, () => {
    let source = `
      import { capabilities } from '@ember/component';

      declare module '@ember/component' {
        export function capabilities(
        );
      }
   `;

    let actual = transform7(source, [
      require('@babel/plugin-transform-typescript'),
      Plugin,
    ]);

    expect(actual).toEqual(``);
  });

  it('works when type casting', () => {
    let source = `
      import { addObserver } from '@ember/object/observers';
      (addObserver as any)();
   `;

    let actual = transform7(source, [
      '@babel/plugin-transform-typescript',
      Plugin,
    ]);

    expect(actual).toEqual(`Ember.addObserver();`);
  });

  it('works for type assertions', () => {
    let source = `
      import { addObserver } from '@ember/object/observers';
      <foo>addObserver();
   `;

    let actual = transform7(source, [
      '@babel/plugin-transform-typescript',
      Plugin,
    ]);

    expect(actual).toEqual(`Ember.addObserver();`);
  });

  it('works for non-null expression', () => {
    let source = `
      import { addObserver } from '@ember/object/observers';
      addObserver!();
   `;

    let actual = transform7(source, [
      '@babel/plugin-transform-typescript',
      Plugin,
    ]);

    expect(actual).toEqual(`Ember.addObserver();`);
  });
});

describe('when used with native classes and decorators', () => {
  it('allows "action" to be used as a variable name', () => {
    let source = `
import { action } from '@ember/object';
import Controller from '@ember/controller';

export default class MyController extends Controller {
  @action
  addAction(action) {
    this.actions.pushObject(action);
  }
}
`;

    let actual = transform7(source, [
      [Plugin],
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ]);

    expect(actual).toEqual(`var _dec, _class;

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

let MyController = (_dec = Ember._action, (_class = class MyController extends Ember.Controller {
  addAction(action) {
    this.actions.pushObject(action);
  }

}, (_applyDecoratedDescriptor(_class.prototype, "addAction", [_dec], Object.getOwnPropertyDescriptor(_class.prototype, "addAction"), _class.prototype)), _class));
export { MyController as default };`);
  });
});

describe('when used with babel-plugin-istanbul', () => {
  // babel-plugin-istanbul won't run on <= Node 6
  const majorVersion = parseInt(process.version.match(/^v(\d+)\./)[1], 10);
  const runOrSkip = majorVersion > 6 ? it : it.skip;

  runOrSkip('works with mixins', () => {
    let source = `
      import EmberObject from '@ember/object';
      import Evented from '@ember/object/evented';

      const TestObject = EmberObject.extend(Evented);
      export default TestObject;
    `;

    let actual = babel7.transformSync(source, {
      filename: 'istanbul-should-cover.js',
      plugins: [require('babel-plugin-istanbul'), Plugin],
    }).code;

    expect(actual).toContain('Ember.Object.extend(Ember.Evented)');
  });

  runOrSkip('works with classes that extend from mixins', () => {
    let source = `
      import EmberObject from '@ember/object';
      import Evented from '@ember/object/evented';

      export default class TestObject extends EmberObject.extend(Evented) {};
    `;

    let actual = babel7.transformSync(source, {
      filename: 'istanbul-should-cover.js',
      plugins: [require('babel-plugin-istanbul'), Plugin],
    }).code;

    expect(actual).toContain(
      'export default class TestObject extends (Ember.Object.extend(Ember.Evented)) {}'
    );
  });
});
