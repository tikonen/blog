cmake_minimum_required(VERSION 3.6)

set(PROJECT_NAME variadicformat)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/bin")
project(${PROJECT_NAME} CXX)
add_compile_options(-std=c++11)
add_compile_options(-fno-exceptions)
set(CMAKE_CXX_COMPILER "clang++")

file(GLOB_RECURSE SRCS src/*.cpp)
file(GLOB_RECURSE HDRS src/*.h)

add_executable(${PROJECT_NAME} ${SRCS} ${HDRS})

