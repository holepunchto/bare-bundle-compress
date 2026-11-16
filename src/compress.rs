use oxc::allocator::Allocator;
use oxc::codegen::{Codegen, CodegenOptions, CommentOptions};
use oxc::diagnostics::OxcDiagnostic;
use oxc::minifier::{
    CompressOptions, CompressOptionsKeepNames, MangleOptions, MangleOptionsKeepNames, Minifier,
    MinifierOptions,
};
use oxc::parser::{ParseOptions, Parser};
use oxc::semantic::SemanticBuilder;
use oxc::span::SourceType;
use oxc::transformer_plugins::{ReplaceGlobalDefines, ReplaceGlobalDefinesConfig};

use crate::bundle::{Bundle, Data};

pub const WHITESPACE: u32 = 1 << 0;
pub const COMMENTS: u32 = 1 << 1;
pub const MANGLE: u32 = 1 << 2;
pub const COMPRESS: u32 = 1 << 3;
pub const KEEP_NAMES: u32 = 1 << 4;

pub struct Options {
    pub flags: u32,
    pub defines: Vec<(String, String)>,
}

struct Pipeline {
    flags: u32,
    defines: Option<ReplaceGlobalDefinesConfig>,
}

impl Pipeline {
    fn new(options: &Options) -> Result<Self, Vec<Diagnostic>> {
        let defines = if options.defines.is_empty() {
            None
        } else {
            let config = ReplaceGlobalDefinesConfig::new(&options.defines).map_err(|errors| {
                errors
                    .iter()
                    .map(|error| Diagnostic::new("", format!("Invalid define: {}", error.message)))
                    .collect::<Vec<_>>()
            })?;

            Some(config)
        };

        Ok(Pipeline {
            flags: options.flags,
            defines,
        })
    }
}

pub struct Diagnostic {
    pub url: String,
    pub start: u32,
    pub end: u32,
    pub message: String,
}

impl Diagnostic {
    fn new(url: &str, message: impl Into<String>) -> Self {
        Diagnostic {
            url: url.into(),
            start: 0,
            end: 0,
            message: message.into(),
        }
    }

    fn from_oxc(url: &str, diagnostic: &OxcDiagnostic) -> Self {
        let span = diagnostic.labels.first().map(|label| label.span());

        Diagnostic {
            url: url.into(),
            start: span.map_or(0, |span| span.start),
            end: span.map_or(0, |span| span.end),
            message: diagnostic.message.to_string(),
        }
    }
}

pub fn compress(input: &[u8], options: &Options) -> Result<Vec<u8>, Vec<Diagnostic>> {
    let mut bundle = Bundle::parse(input).map_err(|message| vec![Diagnostic::new("", message)])?;

    let pipeline = Pipeline::new(options)?;

    let assets: Vec<String> = bundle.assets().map(String::from).collect();

    let mut allocator = Allocator::default();
    let mut diagnostics = Vec::new();

    for file in &mut bundle.files {
        if assets.contains(&file.url) {
            continue;
        }

        let source_type = match handling(file.kind.as_deref(), &file.url) {
            Handling::JavaScript(source_type) => source_type,
            Handling::Json => {
                if options.flags & WHITESPACE != 0 {
                    file.data = Data::Owned(strip_json_whitespace(file.data.as_bytes()));
                }

                continue;
            }
            Handling::Verbatim => continue,
        };

        let Ok(source) = std::str::from_utf8(file.data.as_bytes()) else {
            diagnostics.push(Diagnostic::new(&file.url, "Module is not valid UTF-8"));
            continue;
        };

        allocator.reset();

        match compress_module(&allocator, source, source_type, &pipeline) {
            Ok(code) => file.data = Data::Owned(code.into_bytes()),
            Err(errors) => diagnostics.extend(
                errors
                    .iter()
                    .map(|error| Diagnostic::from_oxc(&file.url, error)),
            ),
        }
    }

    if diagnostics.is_empty() {
        Ok(bundle.serialize())
    } else {
        Err(diagnostics)
    }
}

enum Handling {
    JavaScript(SourceType),
    Json,
    Verbatim,
}

fn handling(kind: Option<&str>, url: &str) -> Handling {
    match kind {
        Some("script") => Handling::JavaScript(SourceType::cjs()),
        Some("module") => Handling::JavaScript(SourceType::mjs()),
        Some("json") => Handling::Json,
        Some(_) => Handling::Verbatim,
        None => handling_for_extension(url),
    }
}

// Without a recorded type, a '.js' file may be either CommonJS or an ES module,
// so let the parser decide from the presence of module syntax.
fn handling_for_extension(url: &str) -> Handling {
    if url.ends_with(".cjs") {
        Handling::JavaScript(SourceType::cjs())
    } else if url.ends_with(".mjs") {
        Handling::JavaScript(SourceType::mjs())
    } else if url.ends_with(".js") {
        Handling::JavaScript(SourceType::unambiguous())
    } else if url.ends_with(".json") {
        Handling::Json
    } else {
        Handling::Verbatim
    }
}

fn compress_module(
    allocator: &Allocator,
    source: &str,
    source_type: SourceType,
    pipeline: &Pipeline,
) -> Result<String, Vec<OxcDiagnostic>> {
    let flags = pipeline.flags;

    let options = ParseOptions {
        allow_return_outside_function: true,
        ..ParseOptions::default()
    };

    let parsed = Parser::new(allocator, source, source_type)
        .with_options(options)
        .parse();

    if parsed.diagnostics.has_errors() {
        return Err(parsed.diagnostics.into_iter().collect());
    }

    let mut program = parsed.program;

    // Bare evaluates every module that is not an ES module inside a function
    // wrapper, so its top-level bindings are local and safe to mangle.
    if !program.source_type.is_module() {
        program.source_type = SourceType::cjs();
    }

    let checked = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&program);

    if checked.diagnostics.has_errors() {
        return Err(checked.diagnostics.into_iter().collect());
    }

    if let Some(config) = &pipeline.defines {
        let scoping = checked.semantic.into_scoping();
        let _ = ReplaceGlobalDefines::new(allocator, config.clone()).build(scoping, &mut program);
    }

    let keep_names = flags & KEEP_NAMES != 0;

    let mangle = MangleOptions {
        keep_names: MangleOptionsKeepNames {
            function: keep_names,
            class: keep_names,
        },
        ..MangleOptions::default()
    };

    let compress = CompressOptions {
        keep_names: CompressOptionsKeepNames {
            function: keep_names,
            class: keep_names,
        },
        ..CompressOptions::smallest()
    };

    let minified = Minifier::new(MinifierOptions {
        mangle: (flags & MANGLE != 0).then_some(mangle),
        mangle_properties: None,
        compress: (flags & COMPRESS != 0).then_some(compress),
    })
    .minify(allocator, &mut program);

    let options = CodegenOptions {
        minify: flags & WHITESPACE != 0,
        comments: if flags & COMMENTS != 0 {
            CommentOptions::disabled()
        } else {
            CommentOptions::default()
        },
        ..CodegenOptions::default()
    };

    Ok(Codegen::new()
        .with_options(options)
        .with_scoping(minified.scoping)
        .build(&program)
        .code)
}

fn strip_json_whitespace(input: &[u8]) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len());
    let mut in_string = false;
    let mut escaped = false;

    for &c in input {
        if in_string {
            if escaped {
                escaped = false;
            } else if c == b'\\' {
                escaped = true;
            } else if c == b'"' {
                in_string = false;
            }
        } else if c == b'"' {
            in_string = true;
        } else if matches!(c, b' ' | b'\t' | b'\n' | b'\r') {
            continue;
        }

        output.push(c);
    }

    output
}
