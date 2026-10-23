import SwiftUI

struct AppearanceControlsView: View {
    @AppStorage(AppAppearancePreferences.backgroundStyleKey)
    private var legacyStyleRaw = AppAppearancePreferences.glassStyleRawValue
    @AppStorage(AppAppearancePreferences.tintOpacityKey)
    private var tintOpacity = AppAppearancePreferences.defaultTintOpacity
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var tintBinding: Binding<Double> {
        Binding(
            get: {
                AppAppearancePreferences.migratedTintOpacity(
                    tintOpacity,
                    legacyStyleRaw: legacyStyleRaw
                )
            },
            set: {
                legacyStyleRaw = AppAppearancePreferences.glassStyleRawValue
                tintOpacity = AppAppearancePreferences.clampedTintOpacity($0)
            }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Background")
                    .font(DesignTokens.sans(13, weight: .semibold))
                    .foregroundStyle(DesignTokens.text)
                Text("Control how much of the desktop shows through Todo Trackr.")
                    .font(DesignTokens.sans(11))
                    .foregroundStyle(DesignTokens.textMuted)
            }

            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Text("Background Tint")
                    Spacer()
                    Text("\(Int(tintBinding.wrappedValue * 100))%")
                        .font(DesignTokens.mono(10))
                        .foregroundStyle(DesignTokens.textMuted)
                }
                .font(DesignTokens.sans(11, weight: .medium))
                .foregroundStyle(DesignTokens.text)

                Slider(
                    value: tintBinding,
                    in: AppAppearancePreferences.tintOpacityRange,
                    step: 0.05
                )
                .disabled(reduceTransparency)

                HStack {
                    Text("Clear")
                    Spacer()
                    Text("Solid")
                }
                .font(DesignTokens.mono(9))
                .foregroundStyle(DesignTokens.textMuted)
            }

            if reduceTransparency {
                Label("macOS Reduce Transparency is on, so Todo Trackr is using a solid background.", systemImage: "accessibility")
                    .font(DesignTokens.sans(10))
                    .foregroundStyle(DesignTokens.textMuted)
            }
        }
        .padding(16)
        .frame(width: 320)
        .appSurfaceBackground(.surfaceRaised)
    }
}
