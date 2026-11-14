"""Profile boundaries use disposable bundles only; no workstation installation."""
import importlib.util
from pathlib import Path
import plistlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("installer", Path(__file__).resolve().parents[1] / "scripts/install-macos-bundle.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)

class ProfileProtectionTests(unittest.TestCase):
    def fixture(self, root, name, version, build, profile=None, receiver=False):
        bundle = root / name
        (bundle / "Contents/MacOS").mkdir(parents=True)
        info = {"CFBundleIdentifier": installer.APP_ID, "CFBundleShortVersionString": version, "CFBundleVersion": build}
        if profile is not None: info["TodoTrackrBuildProfile"] = profile
        (bundle / "Contents/Info.plist").write_bytes(plistlib.dumps(info))
        if receiver: (bundle / "Contents/MacOS/RadarNativeHost").touch()
        return bundle

    def test_public_cannot_replace_legacy_personal_installation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            public = self.fixture(root, "public.app", "1.2.0", "1002000", "public")
            personal = self.fixture(root, "personal.app", "1.1.0", "1001000", receiver=True)
            with self.assertRaisesRegex(ValueError, "different Todo Trackr build profile"):
                installer.check_versions(public, [personal])
            self.assertTrue((personal / "Contents/MacOS/RadarNativeHost").exists())

    def test_personal_cannot_replace_public_and_same_profile_upgrade_is_valid(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            personal = self.fixture(root, "personal.app", "1.2.0", "1002000", "personal", receiver=True)
            public = self.fixture(root, "public.app", "1.1.0", "1001000", "public")
            with self.assertRaisesRegex(ValueError, "different Todo Trackr build profile"):
                installer.check_versions(personal, [public])
            old = self.fixture(root, "old.app", "1.1.0", "1001000", "personal", receiver=True)
            self.assertEqual(installer.check_versions(personal, [old])[1], 1002000)

    def test_public_label_cannot_hide_private_receiver(self):
        with tempfile.TemporaryDirectory() as temp:
            bundle = self.fixture(Path(temp), "invalid.app", "1.2.0", "1002000", "public", receiver=True)
            with self.assertRaisesRegex(ValueError, "Invalid Todo Trackr build profile"):
                installer.build_profile(bundle)
