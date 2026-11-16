/* eslint-disable */

exports['top-level bindings of CommonJS modules are mangled - should match snapshot - 0'] = {
  '/main.js': 'const e=Math.random();if(e>2)return;module.exports=e;'
}

exports['defines replace globals and remove the branches they decide - should match snapshot - 0'] =
  {
    '/main.js': 'module.exports=`quiet`;'
  }

exports['syntax errors report the module and position - should match snapshot - 0'] =
  'Unexpected token at /broken.js:2:7'

exports['syntax errors report the module and position - should match snapshot - 1'] = [
  {
    url: '/broken.js',
    start: 18,
    end: 19,
    message: 'Unexpected token'
  }
]

exports['recorded types decide how files are compressed - should match snapshot - 0'] = {
  '/bin': 'module.exports=42;',
  '/data.json': '{ "kept": true }\n',
  '/main.js': 'export const answer=42;',
  '/template.js': 'const   kept = 1\n'
}

exports['recorded types decide how files are compressed - should match snapshot - 1'] = {
  '/bin': 'script',
  '/data.json': 'text',
  '/main.js': 'module',
  '/template.js': 'text'
}

exports['compressed bundle evaluates to the same exports - should match snapshot - 0'] = {
  '/main.js':
    'const e=require("./values");let t=0;for(let n of e.values)t+=n;module.exports={total:t,greeting:e.greet(`bare`)};',
  '/values.js': 'function greet(e){return`hello `+e}exports.values=[1,2,3],exports.greet=greet;'
}

exports['class and function names are kept unless keepNames is false - should match snapshot - 0'] =
  {
    '/main.js':
      'module.exports=class ScriptModule{static create(){return new ScriptModule}},module.exports.load=function load(){};'
  }

exports['class and function names are kept unless keepNames is false - should match snapshot - 1'] =
  {
    '/main.js':
      'module.exports=class e{static create(){return new e}},module.exports.load=function(){};'
  }

/* eslint-enable */
