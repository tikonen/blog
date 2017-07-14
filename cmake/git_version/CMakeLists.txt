cmake_minimum_required(VERSION 3.7.0)
project(Main)

set(_target Main)
add_executable(${_target} src/main.c)

add_custom_command(TARGET ${_target}
  PRE_BUILD
  COMMAND ${CMAKE_COMMAND}
    -Dlocal_dir="${CMAKE_CURRENT_SOURCE_DIR}"
    -Doutput_dir="${CMAKE_CURRENT_BINARY_DIR}"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/gitversion.cmake"
)

# for generated gitversion.h
target_include_directories(${_target} PRIVATE ${CMAKE_BINARY_DIR})
