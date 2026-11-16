cmake_minimum_required(VERSION 4.0)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-cargo REQUIRED PATHS node_modules/cmake-cargo)
find_package(cmake-napi REQUIRED PATHS node_modules/cmake-napi)
find_package(cmake-npm REQUIRED PATHS node_modules/cmake-npm)

project(bare_bundle_compress C)

add_crate()

add_bare_module(bare_bundle_compress)

target_sources(
  ${bare_bundle_compress}
  PRIVATE
    binding.c
)

target_link_libraries(
  ${bare_bundle_compress}
  PRIVATE
    bare_bundle_compress
)

add_napi_module(bare_bundle_compress_napi)

target_sources(
  ${bare_bundle_compress_napi}
  PRIVATE
    binding.c
)

target_compile_definitions(
  ${bare_bundle_compress_napi}
  PRIVATE
    NAPI_VERSION=9
    NAPI_EXPERIMENTAL
)

resolve_node_module(bare-compat-napi compat)

target_include_directories(
  ${bare_bundle_compress_napi}
  PRIVATE
    "${compat}/include"
)

target_link_libraries(
  ${bare_bundle_compress_napi}
  PRIVATE
    bare_bundle_compress
)
