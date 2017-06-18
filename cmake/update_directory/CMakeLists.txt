cmake_minimum_required(VERSION 3.7.0)
project(Dummy)

set(_target Dummy)
add_executable(${_target} src/dummy.c)

set(source_dir "${CMAKE_CURRENT_SOURCE_DIR}/configs")
set(dest_dir "$<TARGET_FILE_DIR:${_target}>")

# Copy changed files from config to the binary folder after
# a successful build
add_custom_command(TARGET ${_target}
  POST_BUILD
  COMMAND ${CMAKE_COMMAND}
    -Dsrc_dir="${source_dir}"
    -Ddst_dir="${dest_dir}"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/update_directory.cmake"
)
