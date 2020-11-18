/* eslint-disable */

import EmberObject from '@ember/object';
import Evented from '@ember/object/evented';

export default class TestObject extends EmberObject.extend(Evented) {
  foo() {
    console.log('foo');
  }
};

const instance = TestObject.create();
instance.foo();