const test = require('brittle')
const Bundle = require('bare-bundle')
const compile = require('bare-bundle-compile')
const compress = require('.')

test('compressed bundle evaluates to the same exports', (t) => {
  const bundle = new Bundle()
    .write(
      '/main.js',
      `
      // Sum the values exported by the dependency.
      const dependency = require('./values')
      let total = 0
      for (const value of dependency.values) total += value
      module.exports = { total, greeting: dependency.greet('bare') }
      `,
      { main: true, imports: { './values': '/values.js' } }
    )
    .write(
      '/values.js',
      `
      function greet(name) {
        return 'hello ' + name
      }
      exports.values = [1, 2, 3]
      exports.greet = greet
      `
    )

  const compressed = compress(bundle)

  t.snapshot(sources(compressed))
  t.alike(eval(compile(compressed)).exports, { total: 6, greeting: 'hello bare' })
})

test('top-level bindings of CommonJS modules are mangled', (t) => {
  const bundle = new Bundle().write(
    '/main.js',
    `
    const someLongTopLevelName = Math.random()
    if (someLongTopLevelName > 2) return
    module.exports = someLongTopLevelName
    `,
    { main: true }
  )

  t.snapshot(sources(compress(bundle)))
})

test('class and function names are kept unless keepNames is false', (t) => {
  const bundle = new Bundle().write(
    '/main.js',
    `
    module.exports = class ScriptModule {
      static create() {
        return new ScriptModule()
      }
    }
    module.exports.load = function load() {}
    `,
    { main: true }
  )

  t.snapshot(sources(compress(bundle)))
  t.snapshot(sources(compress(bundle, { keepNames: false })))
})

test('defines replace globals and remove the branches they decide', (t) => {
  const bundle = new Bundle().write(
    '/main.js',
    `
    if (process.env.NODE_ENV === 'production') module.exports = 'quiet'
    else module.exports = require('./debug')
    `,
    { main: true }
  )

  const compressed = compress(bundle, {
    defines: { 'process.env.NODE_ENV': '"production"' }
  })

  t.snapshot(sources(compressed))
})

test('JSON keeps whitespace inside strings, assets and other files are untouched', (t) => {
  const asset = '  const   untouched = 1  '
  const text = 'some   text\n'

  const bundle = new Bundle()
    .write('/main.js', 'module.exports = 1', { main: true })
    .write('/data.json', '{ "key": "a  b \\" c" ,\n "list": [ 1, 2 ] }\n')
    .write('/asset.js', asset, { asset: true })
    .write('/notes.txt', text)

  const compressed = compress(bundle)

  t.is(compressed.read('/data.json').toString(), '{"key":"a  b \\" c","list":[1,2]}')
  t.is(compressed.read('/asset.js').toString(), asset)
  t.is(compressed.read('/notes.txt').toString(), text)
  t.alike(compressed.assets, ['/asset.js'])
})

test('recorded types decide how files are compressed', (t) => {
  const bundle = new Bundle()
    .write('/main.js', 'export const answer = 6 * 7', { main: true, type: 'module' })
    .write('/template.js', 'const   kept = 1\n', { type: 'text' })
    .write('/data.json', '{ "kept": true }\n', { type: 'text' })
    .write('/bin', 'const answer = 6 * 7\nmodule.exports = answer', { type: 'script' })

  const compressed = compress(bundle)

  t.snapshot(sources(compressed))
  t.snapshot(Object.fromEntries([...compressed.keys()].map((key) => [key, compressed.type(key)])))
})

test('compressing never introduces syntax newer than the target', (t) => {
  const bundle = new Bundle().write(
    '/main.js',
    'module.exports = (a, b) => (a === null || a === undefined ? b : a)',
    { main: true }
  )

  t.ok(compress(bundle).read('/main.js').toString().includes('??'))
  t.absent(compress(bundle, { target: 'es2019' }).read('/main.js').toString().includes('??'))
})

test('unknown targets are rejected', (t) => {
  const bundle = new Bundle().write('/main.js', 'module.exports = 1', { main: true })

  t.exception.all(() => compress(bundle, { target: 'es5' }), /Unknown target 'es5'/)
})

test('syntax errors report the module and position', (t) => {
  const bundle = new Bundle()
    .write('/main.js', 'module.exports = 1', { main: true })
    .write('/broken.js', 'const a = 1\nconst = 2\n')

  try {
    compress(bundle)
    t.fail('should throw')
  } catch (err) {
    t.ok(err instanceof SyntaxError)
    t.snapshot(err.message)
    t.snapshot(err.diagnostics)
  }
})

function sources(bundle) {
  return Object.fromEntries([...bundle].map(([key, data]) => [key, data.toString()]))
}
