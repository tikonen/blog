cmake_minimum_required(VERSION 3.0.0)
project(precompiled)

set(_target precompiled)

set(_src_root_path ${CMAKE_SOURCE_DIR}/src)

include(cmake/vs_precompiled.cmake)

set(_sources ${_src_root_path}/main.cpp)

ADD_MSVC_PRECOMPILED_HEADER("stdafx.h" "stdafx.cpp" _sources)

add_executable(${_target} ${_sources})

target_compile_definitions (${_target} PUBLIC -D_UNICODE -DUNICODE)

# libraries
install(TARGETS ${_target}
  RUNTIME DESTINATION .)
