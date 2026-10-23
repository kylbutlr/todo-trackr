#!/usr/bin/env python3
"""Install a signed Todo Trackr bundle without downgrading or quitting running apps."""
import argparse
from datetime import datetime
from pathlib import Path
import plistlib
import re
import subprocess
import sys
import tempfile
import uuid

APP_ID = "com.kylbutlr.todotracker"
APP_NAME = "Todo Trackr.app"
LEGACY_NAME = "Todo Tracker.app"


def metadata(bundle):
    try:
        with (bundle / "Contents/Info.plist").open("rb") as file:
            info = plistlib.load(file)
        version = info["CFBundleShortVersionString"]
        build = info["CFBundleVersion"]
        if info.get("CFBundleIdentifier") != APP_ID:
            raise ValueError("unexpected application identifier")
        if not isinstance(version, str) or not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version):
            raise ValueError("version must be major.minor.patch")
        if not isinstance(build, str) or not re.fullmatch(r"[1-9]\d*", build):
            raise ValueError("build must be a positive integer")
        return tuple(map(int, version.split("."))), int(build), version
    except (OSError, KeyError, ValueError, plistlib.InvalidFileException) as error:
        raise ValueError(f"Cannot verify version metadata in {bundle}: {error}") from error


def check_versions(candidate, installed_paths):
    candidate_version, candidate_build, candidate_label = metadata(candidate)
    expected_build = candidate_version[0] * 1_000_000 + candidate_version[1] * 1_000 + candidate_version[2]
    if any(part > 999 for part in candidate_version) or candidate_build != expected_build:
        raise ValueError("Candidate version and build do not follow Todo Trackr's release numbering.")
    for installed in installed_paths:
        if not installed.exists():
            continue
        version, build, label = metadata(installed)
        if candidate_version < version or candidate_build < build:
            raise ValueError(f"Refusing downgrade: candidate {candidate_label} ({candidate_build}) is older than {installed.name} {label} ({build}). Existing app was not changed.")
        if candidate_version == version or candidate_build == build:
            raise ValueError(f"Refusing same-version replacement: candidate {candidate_label} ({candidate_build}), installed {label} ({build}). Increment the release version; existing app was not changed.")
    return candidate_version, candidate_build, candidate_label


def verify_signature(bundle, run):
    run(["codesign", "--verify", "--deep", "--strict", str(bundle)], check=True)
    details = run(["codesign", "--display", "--verbose=4", str(bundle)], check=True, capture_output=True, text=True)
    if "Signature=adhoc" in details.stderr:
        raise ValueError("Refusing an ad hoc signed app. Use the persistent Todo Trackr signing identity.")


def require_stopped(run):
    result = run(["pgrep", "-x", "TodoTracker"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode == 0:
        raise ValueError("Todo Trackr is running. Quit Todo Trackr, then run the installer again. No app was replaced or quit.")
    if result.returncode != 1:
        raise ValueError("Could not verify that Todo Trackr is stopped. No app was replaced.")


def install(candidate, directory, *, run=subprocess.run, launch=True):
    candidate = Path(candidate).resolve()
    directory = Path(directory).expanduser().resolve()
    installed = directory / APP_NAME
    existing = [installed, directory / LEGACY_NAME]
    expected = check_versions(candidate, existing)
    verify_signature(candidate, run)
    require_stopped(run)
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / ".todo-trackr-install.lock"
    try:
        lock.mkdir()
    except FileExistsError as error:
        raise ValueError(f"Another installation may be active. Inspect {lock} before retrying.") from error
    try:
        # Stage and verify the complete copy before moving any existing application.
        with tempfile.TemporaryDirectory(prefix=".todo-trackr-stage-", dir=directory) as temporary:
            staged = Path(temporary) / APP_NAME
            run(["ditto", str(candidate), str(staged)], check=True)
            verify_signature(staged, run)
            if check_versions(staged, existing) != expected:
                raise ValueError("Candidate metadata changed during copying. Existing app was not changed.")
            require_stopped(run)
            backups = []
            try:
                for current in existing:
                    if current.exists():
                        backup = directory / f"{current.stem} backup {datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}.app"
                        current.rename(backup)
                        backups.append((current, backup))
                staged.rename(installed)
            except BaseException:
                for current, backup in reversed(backups):
                    if not current.exists() and backup.exists():
                        backup.rename(current)
                raise
            for _, backup in backups:
                print(f"Previous app preserved at {backup}")
        print(f"Installed Todo Trackr {expected[2]} (build {expected[1]}) at {installed}")
    finally:
        lock.rmdir()
    if launch:
        run(["open", str(installed)], check=True)
    return installed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("directory", nargs="?", type=Path, default=Path.home() / "Applications")
    parser.add_argument("--check-only", action="store_true", help="Check versions and signature without installing or launching")
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()
    try:
        if args.check_only:
            result = check_versions(args.bundle, [args.directory / APP_NAME, args.directory / LEGACY_NAME])
            verify_signature(args.bundle, subprocess.run)
            print(f"Install preflight passed: {result[2]} (build {result[1]})")
        else:
            install(args.bundle, args.directory, launch=not args.no_open)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
