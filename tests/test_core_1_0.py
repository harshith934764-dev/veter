#!/usr/bin/env python3
"""Regression tests for downloads/veter_core_1_0.cpp.

Run from the repository root:
    python tests/test_core_1_0.py

Requires a C++20 g++ compiler on PATH. Uses only the Python standard library.
"""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "downloads" / "veter_core_1_0.cpp"


class VeterCoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="veter-core-tests-")
        cls.work = Path(cls.temp.name)
        cls.exe = cls.work / ("veter.exe" if __import__("os").name == "nt" else "veter")
        build = subprocess.run(
            ["g++", "-std=c++20", "-Wall", "-Wextra", "-pedantic",
             str(SOURCE), "-o", str(cls.exe)],
            text=True, capture_output=True
        )
        if build.returncode:
            raise RuntimeError("Compiler build failed:\n" + build.stdout + build.stderr)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def run_veter(self, source, stdin=""):
        program = self.work / "case.vtr"
        program.write_text(source, encoding="utf-8")
        return subprocess.run(
            [str(self.exe), str(program)], input=stdin,
            text=True, capture_output=True
        )

    def test_multi_file_include_shares_functions(self):
        modules = self.work / "modules"
        modules.mkdir(exist_ok=True)
        (modules / "math.vtr").write_text(
            "do add(first, second)\\ngive first + second\\nend\\n",
            encoding="utf-8"
        )
        main = self.work / "multi_main.vtr"
        main.write_text(
            'include "modules/math.vtr"\\n'
            'remember total as add(20, 22)\\n'
            'display total\\n',
            encoding="utf-8"
        )
        result = subprocess.run([str(self.exe), str(main)], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "42\\n")

    def test_include_rejects_parent_directory_traversal(self):
        main = self.work / "unsafe_include.vtr"
        main.write_text('include "../outside.vtr"\\ndisplay "no"\\n', encoding="utf-8")
        result = subprocess.run([str(self.exe), str(main)], text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot use '.' or '..' segments", result.stderr)

    def test_arithmetic_precedence_and_parentheses(self):
        result = self.run_veter(
            "remember a as 10\nremember b as 3\n"
            "display a + b * 2\ndisplay (a + b) * 2\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "16\n26\n")

    def test_unary_negative_values(self):
        result = self.run_veter(
            "remember value as -7\ndisplay value\n"
            "display 5 + -2\ndisplay -(3 + 4)\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "-7\n3\n-7\n")

    def test_comparison_operators(self):
        source = (
            "remember a as 5\nremember b as 8\n"
            "choose when a == 5\ndisplay \"eq\"\nclose choice\n"
            "choose when a != b\ndisplay \"ne\"\nclose choice\n"
            "choose when a < b\ndisplay \"lt\"\nclose choice\n"
            "choose when a <= 5\ndisplay \"le\"\nclose choice\n"
            "choose when b > a\ndisplay \"gt\"\nclose choice\n"
            "choose when b >= 8\ndisplay \"ge\"\nclose choice\n"
        )
        result = self.run_veter(source)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "eq\nne\nlt\nle\ngt\nge\n")

    def test_logical_and_or_not(self):
        source = (
            "remember a as 5\nremember b as 8\n"
            "choose when a < b and not b < a\ndisplay \"and\"\nclose choice\n"
            "choose when a > b or b == 8\ndisplay \"or\"\nclose choice\n"
        )
        result = self.run_veter(source)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "and\nor\n")

    def test_counted_loop(self):
        result = self.run_veter(
            "remember n as 1\nrepeat 3 rounds\n"
            "display n\nrevise n as n + 1\nclose cycle\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "1\n2\n3\n")

    def test_while_loop(self):
        result = self.run_veter(
            "remember n as 1\nwhile n < 4\n"
            "display n\nrevise n as n + 1\nclose cycle\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "1\n2\n3\n")

    def test_string_concatenation(self):
        result = self.run_veter(
            'remember greeting as "Hello, " + "Veter"\ndisplay greeting\n'
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "Hello, Veter\n")

    def test_input(self):
        result = self.run_veter("ask for answer\ndisplay answer\n", "hello\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "hello\n")

    def test_function_call_before_definition(self):
        result = self.run_veter(
            "run greet\n"
            "do greet\n"
            'display "Hello from a Veter function"\n'
            "end\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "Hello from a Veter function\n")

    def test_function_can_call_another_function(self):
        result = self.run_veter(
            "run welcome\n"
            "do welcome\n"
            "run greet\n"
            'display "Welcome back"\n'
            "end\n"
            "do greet\n"
            'display "Hello"\n'
            "end\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "Hello\nWelcome back\n")

    def test_function_parameters_and_return_value(self):
        result = self.run_veter(
            "remember answer as add(10, 20)\n"
            "display answer\n"
            "do add(first, second)\n"
            "give first + second\n"
            "end\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "30\n")

    def test_function_arguments_can_be_expressions(self):
        result = self.run_veter(
            "remember answer as multiply(2 + 3, 4)\n"
            "display answer\n"
            "do multiply(left, right)\n"
            "give left * right\n"
            "end\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "20\n")

    def test_function_statement_call_discards_return_value(self):
        result = self.run_veter(
            "run greet(\"Veter\")\n"
            "do greet(name)\n"
            "display name\n"
            "give 99\n"
            "end\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "Veter\n")

    def test_function_argument_count_is_checked(self):
        result = self.run_veter(
            "run add(1)\n"
            "do add(first, second)\n"
            "give first + second\n"
            "end\n"
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expects 2 argument(s), got 1", result.stderr)

    def test_arrays_and_index_access(self):
        result = self.run_veter(
            'remember scores as array(10, 20, 30)\n'
            'display length(scores)\n'
            'display at(scores, 1)\n'
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "3\n20\n")

    def test_mixed_array_values_keep_their_own_types(self):
        result = self.run_veter(
            'remember items as array("red", 42, "blue")\n'
            'display length(items)\n'
            'display at(items, 0)\n'
            'display at(items, 1)\n'
            'display at(items, 2)\n'
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "3\nred\n42\nblue\n")

    def test_array_index_out_of_range_is_reported(self):
        result = self.run_veter(
            'remember items as array("first", "second")\n'
            'display at(items, 2)\n'
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("array index out of range", result.stderr)

    def test_negative_array_index_is_rejected(self):
        result = self.run_veter(
            'remember items as array(10, 20)\n'
            'display at(items, -1)\n'
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("array index out of range", result.stderr)

    def test_string_builtins(self):
        result = self.run_veter(
            'display upper("veter")\n'
            'display lower("HELLO")\n'
            'display length("language")\n'
            'display contains("veter language", "lang")\n'
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "VETER\nhello\n8\n1\n")

    def test_function_local_variables_and_recursion(self):
        result = self.run_veter(
            'display factorial(5)\n'
            'do factorial(n)\n'
            '    choose when n <= 1\n'
            '        give 1\n'
            '    close choice\n'
            '    remember previous as factorial(n - 1)\n'
            '    give n * previous\n'
            'end\n'
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "120\n")

    def test_unknown_function_is_reported(self):
        result = self.run_veter("run missing_function\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unknown function 'missing_function'", result.stderr)

    def test_undefined_variable_is_reported(self):
        result = self.run_veter("display missing\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("undefined variable", result.stderr)

    def test_division_by_zero_is_reported(self):
        result = self.run_veter("display 10 / 0\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("division by zero", result.stderr)

    def test_text_that_looks_numeric_is_not_a_number(self):
        result = self.run_veter('display "12" - 2\n')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expected a number, received text", result.stderr)

    def test_mixed_type_comparison_is_rejected(self):
        result = self.run_veter('choose when 1 == "1"\ndisplay "bad"\nclose choice\n')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot compare a number with text", result.stderr)

    def test_integer_overflow_is_reported(self):
        result = self.run_veter(
            "remember biggest as 9223372036854775807\n"
            "display biggest + 1\n"
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("integer overflow in addition", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
