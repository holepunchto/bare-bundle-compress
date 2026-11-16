const Bundle = require('bare-bundle')
const binding = require('#binding')

module.exports = function compress(bundle, opts = {}) {
  const {
    whitespace = true,
    comments = true,
    mangle = true,
    compress = true,
    keepNames = true,
    defines = {}
  } = opts

  if (!Bundle.isBundle(bundle)) bundle = Bundle.from(bundle)

  let flags = 0

  if (whitespace) flags |= binding.WHITESPACE
  if (comments) flags |= binding.COMMENTS
  if (mangle) flags |= binding.MANGLE
  if (compress) flags |= binding.COMPRESS
  if (keepNames) flags |= binding.KEEP_NAMES

  const pairs = []

  for (const [key, value] of Object.entries(defines)) pairs.push(key, value)

  const input = bundle.toBuffer()

  const result = binding.compress(input.buffer, input.byteOffset, input.byteLength, flags, pairs)

  if (result.diagnostics) throw createError(bundle, result.diagnostics)

  return Bundle.from(Buffer.from(result.buffer))
}

function createError(bundle, diagnostics) {
  const [first] = diagnostics

  let message = first.message

  if (first.url) {
    const { line, column } = position(bundle.read(first.url), first.start)

    message += ` at ${first.url}:${line}:${column}`
  }

  if (diagnostics.length > 1) message += ` (and ${diagnostics.length - 1} more)`

  const err = new SyntaxError(message)
  err.diagnostics = diagnostics
  return err
}

function position(source, offset) {
  let line = 1
  let column = 1

  for (let i = 0; i < offset && i < source.byteLength; i++) {
    if (source[i] === 0x0a) {
      line++
      column = 1
    } else {
      column++
    }
  }

  return { line, column }
}
