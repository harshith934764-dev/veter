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
