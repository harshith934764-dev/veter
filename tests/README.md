# Veter Core 1.0 reliability tests

This folder contains automated regression tests for the Core 1.0 compiler source in `downloads/veter_core_1_0.cpp`.

## Requirements

- Python 3
- `g++` with C++20 support available on PATH

## Run

From the repository root:

```bash
python tests/test_core_1_0.py
```

The test runner compiles the compiler into a temporary directory and runs isolated `.vtr` programs. It does not overwrite the compiler executable or source files in the repository.

## Covered cases

- Arithmetic precedence and parentheses
- Unary negative numbers
- Six comparison operators
- Logical AND, OR and NOT
- Counted and condition-controlled loops
- String concatenation
- Console input
- Undefined variables
- Division by zero
- Mixed number/text comparison rejection
- Signed 64-bit addition overflow

These tests cover the console/bytecode compiler path, not the separate website-builder path or the native Windows UI runtime. A passing test suite is evidence for these cases only; it is not proof that every language feature is complete.
