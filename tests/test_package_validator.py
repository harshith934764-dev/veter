#!/usr/bin/env python3
"""Tests for the local Veter package manifest validator."""
from pathlib import Path
import json
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools" / "veter_pkg.cpp"


class PackageValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="veter-pkg-tests-")
        cls.work = Path(cls.temp.name)
        cls.exe = cls.work / "veter-pkg"
        result = subprocess.run(
            ["g++", "-std=c++20", "-Wall", "-Wextra", "-pedantic",
             str(SOURCE), "-o", str(cls.exe)],
            text=True, capture_output=True
        )
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def validate(self, manifest):
        path = self.work / "veter.package.json"
        path.write_text(json.dumps(manifest), encoding="utf-8")
        return subprocess.run([str(self.exe), "validate", str(path)],
                              text=True, capture_output=True)

    def valid_manifest(self):
        return {
            "name": "hello-world",
            "version": "1.2.3",
            "description": "A tiny Veter project",
            "entry": "src/main.vtr",
            "dependencies": {"math-kit": "2.0.1"}
        }

    def test_valid_manifest(self):
        result = self.validate(self.valid_manifest())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("hello-world@1.2.3", result.stdout)

    def test_missing_name_is_rejected(self):
        data = self.valid_manifest()
        del data["name"]
        result = self.validate(data)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("name", result.stderr)

    def test_invalid_package_name_is_rejected(self):
        data = self.valid_manifest()
        data["name"] = "Hello World"
        self.assertNotEqual(self.validate(data).returncode, 0)

    def test_invalid_version_is_rejected(self):
        data = self.valid_manifest()
        data["version"] = "1.2"
        self.assertNotEqual(self.validate(data).returncode, 0)

    def test_path_traversal_entry_is_rejected(self):
        data = self.valid_manifest()
        data["entry"] = "../outside.vtr"
        self.assertNotEqual(self.validate(data).returncode, 0)

    def test_absolute_entry_is_rejected(self):
        data = self.valid_manifest()
        data["entry"] = "/tmp/main.vtr"
        self.assertNotEqual(self.validate(data).returncode, 0)

    def test_invalid_dependency_version_is_rejected(self):
        data = self.valid_manifest()
        data["dependencies"]["math-kit"] = "^2.0"
        self.assertNotEqual(self.validate(data).returncode, 0)

    def test_dependencies_must_be_an_object(self):
        data = self.valid_manifest()
        data["dependencies"] = ["math-kit"]
        self.assertNotEqual(self.validate(data).returncode, 0)

    def test_malformed_json_is_rejected(self):
        path = self.work / "broken.json"
        path.write_text('{"name": "broken",', encoding="utf-8")
        result = subprocess.run([str(self.exe), "validate", str(path)],
                                text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)

    def test_wrong_arguments_show_usage(self):
        result = subprocess.run([str(self.exe)], text=True, capture_output=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("Usage:", result.stderr)


if __name__ == "__main__":
    unittest.main()
