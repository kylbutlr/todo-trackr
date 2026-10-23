#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 OUTPUT_DIRECTORY" >&2
    exit 64
fi

script_directory="$(cd "$(dirname "$0")" && pwd)"
repository_root="$(cd "$script_directory/.." && pwd)"
package_directory="$repository_root/apps/macos"
output_directory="$1"
application_name="Todo Trackr"
executable_name="TodoTracker"
signing_identity="${TODO_TRACKR_CODESIGN_IDENTITY:-Todo Trackr Local Code Signing}"

if [[ "$signing_identity" == "-" ]]; then
    echo "Ad hoc signing is disabled because it resets macOS privacy approvals after each update." >&2
    echo "Set TODO_TRACKR_CODESIGN_IDENTITY to a persistent Code Signing identity." >&2
    exit 1
elif ! security find-identity -v -p codesigning | grep -Fq "\"$signing_identity\""; then
    echo "Code Signing identity not found: $signing_identity" >&2
    echo "Create it in the login keychain or set TODO_TRACKR_CODESIGN_IDENTITY to another persistent identity." >&2
    exit 1
fi

mkdir -p "$output_directory"
output_directory="$(cd "$output_directory" && pwd)"
application_bundle="$output_directory/$application_name.app"

if [[ -e "$application_bundle" ]]; then
    echo "Refusing to overwrite existing bundle: $application_bundle" >&2
    exit 1
fi

source_info_plist="$package_directory/Resources/Info.plist"
application_version="${TODO_TRACKR_VERSION:-$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$source_info_plist")}"
application_build="${TODO_TRACKR_BUILD:-$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$source_info_plist")}"

swift build --configuration release --package-path "$package_directory" >&2
product_directory="$(swift build --configuration release --package-path "$package_directory" --show-bin-path 2>/dev/null)"
sparkle_framework="$product_directory/Sparkle.framework"

if [[ ! -d "$sparkle_framework" ]]; then
    echo "Sparkle.framework was not produced by Swift Package Manager." >&2
    exit 1
fi

contents_directory="$application_bundle/Contents"
mkdir -p "$contents_directory/MacOS" "$contents_directory/Frameworks" "$contents_directory/Resources"

cp "$product_directory/$executable_name" "$contents_directory/MacOS/$executable_name"
cp "$source_info_plist" "$contents_directory/Info.plist"
cp -R "$package_directory/Sources/Resources/Fonts" "$contents_directory/Resources/Fonts"
ditto "$sparkle_framework" "$contents_directory/Frameworks/Sparkle.framework"

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $application_version" "$contents_directory/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $application_build" "$contents_directory/Info.plist"

if [[ "${TODO_TRACKR_DISTRIBUTION:-source}" == "notarized" ]]; then
    /usr/libexec/PlistBuddy -c "Add :SUFeedURL string https://github.com/kylbutlr/todo-trackr/releases/latest/download/appcast.xml" "$contents_directory/Info.plist"
    /usr/libexec/PlistBuddy -c "Set :SUEnableAutomaticChecks true" "$contents_directory/Info.plist"
    /usr/libexec/PlistBuddy -c "Set :SUAllowsAutomaticUpdates true" "$contents_directory/Info.plist"
    /usr/libexec/PlistBuddy -c "Set :SUAutomaticallyUpdate true" "$contents_directory/Info.plist"
fi

master_icon="$output_directory/icon-master.png"
iconset_directory="$output_directory/TodoTracker.iconset"
mkdir -p "$iconset_directory"
swift "$repository_root/scripts/render-macos-icon.swift" "$master_icon"

while read -r filename pixels; do
    sips -z "$pixels" "$pixels" "$master_icon" --out "$iconset_directory/$filename" >/dev/null
done <<'SIZES'
icon_16x16.png 16
icon_16x16@2x.png 32
icon_32x32.png 32
icon_32x32@2x.png 64
icon_128x128.png 128
icon_128x128@2x.png 256
icon_256x256.png 256
icon_256x256@2x.png 512
icon_512x512.png 512
icon_512x512@2x.png 1024
SIZES

iconutil --convert icns "$iconset_directory" --output "$contents_directory/Resources/TodoTracker.icns"

codesign --force --timestamp=none --sign "$signing_identity" \
    "$contents_directory/MacOS/$executable_name"
codesign --force --timestamp=none --sign "$signing_identity" \
    "$application_bundle"
codesign --verify --deep --strict --verbose=2 "$application_bundle"

signature_details="$(codesign --display --verbose=4 "$application_bundle" 2>&1)"
if grep -Fq "Signature=adhoc" <<< "$signature_details"; then
    echo "Refusing to produce an ad hoc signed Todo Trackr app." >&2
    exit 1
fi

designated_requirement="$(codesign --display --requirements - "$application_bundle" 2>&1)"
if grep -Fq "designated => cdhash" <<< "$designated_requirement"; then
    echo "Refusing a code signature whose designated requirement changes with every build." >&2
    exit 1
fi

echo "$application_bundle"
