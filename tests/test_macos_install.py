"""Runs the real installer entry point against disposable app bundles, never installed apps."""
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def bundle(path, version, build, identifier="com.kylbutlr.todotracker"):
    (path / "Contents").mkdir(parents=True)
    with (path / "Contents/Info.plist").open("wb") as file:
        plistlib.dump({"CFBundleShortVersionString": version, "CFBundleVersion": build,
                      "CFBundleIdentifier": identifier}, file)
    (path / "preserve-me").write_text(version)


class InstallerEntryPointTests(unittest.TestCase):
    def run_install(self, candidate_version, candidate_build, installed_version, installed_build, *, packaged=False):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        scripts = root / "scripts"
        scripts.mkdir()
        for name in ["install-macos.sh", "install-macos-bundle.py"]:
            if (ROOT / "scripts" / name).exists():
                shutil.copy2(ROOT / "scripts" / name, scripts / name)
        candidate = root / "candidate.app"
        bundle(candidate, candidate_version, candidate_build)
        destination = root / "Applications"
        destination.mkdir()
        installed = destination / "Todo Trackr.app"
        bundle(installed, installed_version, installed_build)
        build = scripts / "build-macos-app.sh"
        build.write_text('#!/usr/bin/env bash\nprintf "%s\\n" "$TEST_CANDIDATE"\n')
        build.chmod(0o755)
        commands = root / "commands"
        commands.mkdir()
        # Only test doubles can launch/copy here. These never control the workstation.
        for name, body in {
            "open": "exit 0",
            "ditto": 'cp -R "$1" "$2"',
            "codesign": "exit 0",
            "pgrep": "exit 1",
        }.items():
            path = commands / name
            path.write_text("#!/usr/bin/env bash\n" + body + "\n")
            path.chmod(0o755)
        arguments = ["--bundle", str(candidate), str(destination)] if packaged else [str(destination)]
        result = subprocess.run(["bash", str(scripts / "install-macos.sh"), *arguments],
                                env={**os.environ, "PATH": str(commands) + os.pathsep + os.environ["PATH"],
                                     "TEST_CANDIDATE": str(candidate)}, capture_output=True, text=True)
        return result, installed, destination

    def test_stale_checkout_cannot_replace_newer_installed_app(self):
        result, installed, destination = self.run_install("0.2.54", "2054", "0.2.67", "2067")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("downgrade", result.stderr.lower())
        self.assertEqual((installed / "preserve-me").read_text(), "0.2.67")
        self.assertEqual(len(list(destination.iterdir())), 1, "Refusal must happen before backup or replacement")

    def test_packaged_bundle_entry_point_also_rejects_downgrade(self):
        result, installed, destination = self.run_install("0.2.54", "2054", "0.2.67", "2067", packaged=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("downgrade", result.stderr.lower())
        self.assertEqual((installed / "preserve-me").read_text(), "0.2.67")
        self.assertEqual(len(list(destination.iterdir())), 1)


# Unit tests use the production install transaction with subprocesses replaced by local fakes.
import importlib.util
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("macos_installer", ROOT / "scripts/install-macos-bundle.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTransactionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.destination = self.root / "Applications"
        self.destination.mkdir()
        self.existing = self.destination / installer.APP_NAME
        bundle(self.existing, "0.2.67", "2067")
        self.candidate = self.root / "Candidate.app"
        bundle(self.candidate, "0.2.69", "2069")
        self.commands = []

    def fake_run(self, command, **kwargs):
        self.commands.append(command)
        if command[0] == "ditto":
            shutil.copytree(command[1], command[2], symlinks=True)
        return subprocess.CompletedProcess(command, 1 if command[0] == "pgrep" else 0, stdout="", stderr="Authority=Todo Trackr Local Code Signing")

    def change_metadata(self, path, **changes):
        plist = path / "Contents/Info.plist"
        with plist.open("rb") as file:
            info = plistlib.load(file)
        info.update(changes)
        with plist.open("wb") as file:
            plistlib.dump(info, file)

    def assert_preserved(self):
        self.assertEqual((self.existing / "preserve-me").read_text(), "0.2.67")
        self.assertEqual(list(self.destination.iterdir()), [self.existing])

    def test_successful_upgrade_preserves_backup_and_launches_only_installed_app(self):
        installer.install(self.candidate, self.destination, run=self.fake_run)
        self.assertEqual(installer.metadata(self.existing)[:2], ((0, 2, 69), 2069))
        backups = list(self.destination.glob("*backup*.app"))
        self.assertEqual(len(backups), 1)
        self.assertEqual((backups[0] / "preserve-me").read_text(), "0.2.67")
        self.assertEqual(self.commands[-1], ["open", str(self.existing.resolve())])
        self.assertFalse((self.destination / ".todo-trackr-install.lock").exists())

    def test_numeric_version_order_is_not_lexicographic(self):
        self.change_metadata(self.existing, CFBundleShortVersionString="0.2.9", CFBundleVersion="2009")
        self.change_metadata(self.candidate, CFBundleShortVersionString="0.2.10", CFBundleVersion="2010")
        installer.install(self.candidate, self.destination, run=self.fake_run, launch=False)
        self.assertEqual(installer.metadata(self.existing)[2], "0.2.10")
        self.assertFalse(any(command[0] == "open" for command in self.commands))

    def test_equal_version_cannot_hide_an_older_binary(self):
        self.change_metadata(self.candidate, CFBundleShortVersionString="0.2.67", CFBundleVersion="2067")
        with self.assertRaisesRegex(ValueError, "same-version"):
            installer.install(self.candidate, self.destination, run=self.fake_run)
        self.assert_preserved()
        self.assertEqual(self.commands, [])

    def test_version_and_build_must_both_move_forward(self):
        self.change_metadata(self.existing, CFBundleVersion="2070")
        with self.assertRaisesRegex(ValueError, "downgrade"):
            installer.install(self.candidate, self.destination, run=self.fake_run)
        self.assert_preserved()

    def test_inconsistent_candidate_numbering_is_rejected(self):
        self.change_metadata(self.candidate, CFBundleVersion="2054")
        with self.assertRaisesRegex(ValueError, "release numbering"):
            installer.install(self.candidate, self.destination, run=self.fake_run)
        self.assert_preserved()

    def test_unreadable_installed_metadata_fails_closed(self):
        (self.existing / "Contents/Info.plist").write_text("invalid")
        with self.assertRaisesRegex(ValueError, "Cannot verify"):
            installer.install(self.candidate, self.destination, run=self.fake_run)
        self.assert_preserved()

    def test_wrong_bundle_identifier_is_rejected(self):
        self.change_metadata(self.candidate, CFBundleIdentifier="some.other.app")
        with self.assertRaisesRegex(ValueError, "identifier"):
            installer.install(self.candidate, self.destination, run=self.fake_run)
        self.assert_preserved()

    def test_newer_legacy_install_is_checked_before_either_app_is_moved(self):
        legacy = self.destination / installer.LEGACY_NAME
        bundle(legacy, "0.2.70", "2070")
        with self.assertRaisesRegex(ValueError, "downgrade"):
            installer.install(self.candidate, self.destination, run=self.fake_run)
        self.assertTrue(self.existing.exists())
        self.assertTrue(legacy.exists())
        self.assertEqual(len(list(self.destination.iterdir())), 2)

    def test_signature_failure_preserves_installed_app(self):
        def failure(command, **kwargs):
            raise subprocess.CalledProcessError(1, command)
        with self.assertRaises(subprocess.CalledProcessError):
            installer.install(self.candidate, self.destination, run=failure)
        self.assert_preserved()

    def test_ad_hoc_signature_is_rejected(self):
        def adhoc(command, **kwargs):
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="Signature=adhoc")
        with self.assertRaisesRegex(ValueError, "ad hoc"):
            installer.install(self.candidate, self.destination, run=adhoc)
        self.assert_preserved()

    def test_running_app_is_never_replaced_or_quit(self):
        def running(command, **kwargs):
            if command[0] == "pgrep":
                return subprocess.CompletedProcess(command, 0)
            return self.fake_run(command, **kwargs)
        with self.assertRaisesRegex(ValueError, "running"):
            installer.install(self.candidate, self.destination, run=running)
        self.assert_preserved()

    def test_copy_failure_preserves_original(self):
        def copy_failure(command, **kwargs):
            if command[0] == "ditto":
                raise subprocess.CalledProcessError(1, command)
            return self.fake_run(command, **kwargs)
        with self.assertRaises(subprocess.CalledProcessError):
            installer.install(self.candidate, self.destination, run=copy_failure)
        self.assert_preserved()

    def test_failed_final_move_rolls_back_the_previous_app(self):
        rename = Path.rename
        def fail_staged_move(path, target):
            if path.parent.name.startswith(".todo-trackr-stage-"):
                raise OSError("fixture final-move failure")
            return rename(path, target)
        with patch.object(Path, "rename", fail_staged_move):
            with self.assertRaisesRegex(OSError, "final-move"):
                installer.install(self.candidate, self.destination, run=self.fake_run)
        self.assert_preserved()


if __name__ == "__main__":
    unittest.main()
