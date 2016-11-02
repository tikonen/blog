
#include "util.h"

#include <iostream>

int main(int argc, char* argv[])
{
    // raw to string
    std::cout << util::str("foo: ", 1, "!=", .2f) << std::endl; // foo: 1!=0.2

    // index formatting
    std::cout << util::format("Hello World!") << std::endl;
    std::cout << util::format("Hello {0}!", "World") << std::endl;
    std::cout << util::format("{0} {1}!", "Hello", "World") << std::endl;
    std::cout << util::format("{0} + {1} = {2}", 1, 2, 3) << std::endl;

    // parametric formatting, alias to std::make_pair
    using util::_p;

    std::cout << util::format("Hello {what}!", _p("what", "World")) << std::endl;
    //std::cout << util::format("Hello {what}!", std::make_pair("what", "World")) << std::endl;
    std::cout << util::format("{word} {other}!", _p("word", "World"), _p("other", "World")) << std::endl;
    std::cout << util::format("{a} + {b} = {c}", _p("a", 1), _p("b", 2), _p("c", 3)) << std::endl; // 1 + 2 = 3

    // mixed
    std::cout << util::format("{a} + {b} = {0}", 5, _p("a", 3), _p("b", 2)) << std::endl; // 3 + 2 = 5

    return 0;
}
