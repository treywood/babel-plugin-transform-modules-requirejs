# babel-plugin-transform-modules-requirejs

A modified version of Babel's [AMD Module plugin](https://github.com/babel/babel/tree/master/packages/babel-plugin-transform-es2015-modules-amd) that removes the 'export' argument from **define**'s factory method and returns the exports:

```javascript
import Foo from 'foo';

export default {
  myFoo: new Foo('bar')
}
```

Generates:

```javascript
define(['foo'], function (_foo) {
  'use strict';

  var exports = {};
  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  var _foo2 = _interopRequireDefault(_foo);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  exports.default = {
    myFoo: new _foo2.default('bar')
  };
  return exports.default;
});
```
