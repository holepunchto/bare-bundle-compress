import Buffer from 'bare-buffer'
import Bundle from 'bare-bundle'

type CompressTarget =
  | 'es2015'
  | 'es2016'
  | 'es2017'
  | 'es2018'
  | 'es2019'
  | 'es2020'
  | 'es2021'
  | 'es2022'
  | 'es2023'
  | 'es2024'
  | 'esnext'

interface CompressOptions {
  /**
   * Remove insignificant whitespace from modules and JSON files (default `true`).
   */
  whitespace?: boolean
  /**
   * Remove comments from modules (default `true`).
   */
  comments?: boolean
  /**
   * Shorten the names of local bindings, including the top-level bindings of CommonJS modules
   * (default `true`).
   */
  mangle?: boolean
  /**
   * Fold constants and remove dead code (default `true`).
   */
  compress?: boolean
  /**
   * Keep the `name` of classes and functions, which inspection output and stack traces show
   * (default `true`). Turning it off saves a little more but changes what such output prints.
   */
  keepNames?: boolean
  /**
   * The newest ECMAScript version whose syntax the compressed modules may use (default `'esnext'`).
   * Compressing never introduces syntax newer than the target, though it leaves syntax that the
   * modules already use as it is.
   */
  target?: CompressTarget
  /**
   * Global expressions to replace before compressing, mapped to the JavaScript source of their
   * replacement, such as `{ 'process.env.NODE_ENV': '"production"' }`.
   */
  defines?: Record<string, string>
}

interface CompressDiagnostic {
  url: string
  start: number
  end: number
  message: string
}

/**
 * Compress the modules of `bundle` and return a new bundle. Each file is handled according to the
 * `type` recorded for it in the bundle header, or its extension if none is recorded: `script` and
 * `module` files are minified, `json` files have their whitespace removed, and other files are left
 * untouched. Files listed as assets are always left untouched.
 * @throws {SyntaxError} a module cannot be parsed. The error has a `diagnostics` property listing
 * every problem found.
 */
declare function compress(bundle: Bundle | Buffer, opts?: CompressOptions): Bundle

declare namespace compress {
  export { type CompressTarget, type CompressOptions, type CompressDiagnostic }
}

export = compress
