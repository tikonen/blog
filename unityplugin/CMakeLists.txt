cmake_minimum_required(VERSION 3.0.0)
project(ptest)

set(_target "ptest")

file(GLOB_RECURSE SRC ptest/*.h ptest/*.cpp)

add_library(${_target} SHARED ${SRC})
#add_library(libtest STATIC ${SRC})

#GENERATE_EXPORT_HEADER( ${_target}
#	EXPORT_FILE_NAME	exports/ptest_export.h
#)
#target_include_directories(${_target} PUBLIC ${CMAKE_BINARY_DIR}/exports)
target_include_directories(${_target} PUBLIC "$ENV{PROGRAMFILES}/Unity/Editor/Data/PluginAPI")

# Copy DLL to Unity plugin folder
add_custom_command(
	TARGET ${_target}
	POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
		"$<TARGET_FILE:${_target}>"
    	"${CMAKE_CURRENT_SOURCE_DIR}/TestPlugin/Assets/Plugins"
)


# libraries
install(TARGETS ${_target} 
	RUNTIME DESTINATION .)
#	LIBRARY DESTINATION lib
#	ARCHIVE DESTINATION lib)
