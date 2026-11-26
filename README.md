# bare-bundle-compress

Minify the modules of a Bare bundle. The compressor takes a bundle and returns a new bundle, so it fits between bundling and either writing a `.bundle` file or compiling the bundle with `bare-bundle-compile`. It is meant to run at build time.

```
npm i bare-bundle-compress
```

## Usage

```js
const Bundle = require('bare-bundle')
const compress = require('bare-bundle-compress')

const bundle = new Bundle().write('/main.js', 'const answer = 6 * 7\nmodule.exports = answer', {
  main: true
})

compress(bundle).read('/main.js').toString()
// 'module.exports=42;'
```

The compressed modules use the newest syntax that makes them smaller, such as `??` in place of a comparison with `null`. To run them on an engine without it, set `target` to the newest ECMAScript version that the engine supports, from `'es2015'` to `'esnext'`, the default. Syntax that the modules already use is left as it is, so lower it first with <https://github.com/holepunchto/bare-bundle-lower>.

## License

Apache-2.0
