cmake_minimum_required ( VERSION 3.0.2 )

project ( pathtracer )

find_package ( embree 2.12 REQUIRED )
include_directories ( ${EMBREE_INCLUDE_DIRS} )

find_package ( OpenMP REQUIRED )
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")

# Find *all* shaders.
file(GLOB_RECURSE SHADERS
    "${CMAKE_CURRENT_SOURCE_DIR}/*.vert"
    "${CMAKE_CURRENT_SOURCE_DIR}/*.frag"
)
# Separate filter for shaders.
source_group("Shaders" FILES ${SHADERS})

# Build and link executable.
add_executable ( pathtracer
    main.cpp
    Pathtracer.cpp
    sampling.cpp
    HDRImage.cpp
    embree.cpp
    material.cpp
    ${SHADERS}
    )

target_link_libraries ( pathtracer labhelper ${EMBREE_LIBRARIES} )
config_build_output()
