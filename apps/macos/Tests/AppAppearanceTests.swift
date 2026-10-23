import AppKit
import Testing
@testable import TodoTracker

struct AppAppearanceTests {
    @Test("Background tint defaults to the midpoint")
    func defaultTintOpacity() {
        #expect(AppAppearancePreferences.defaultTintOpacity == 0.5)
    }

    @Test("Tint opacity supports the full clear to solid range")
    func clampsTintOpacity() {
        #expect(AppAppearancePreferences.clampedTintOpacity(-0.2) == 0)
        #expect(AppAppearancePreferences.clampedTintOpacity(0.2) == 0.2)
        #expect(AppAppearancePreferences.clampedTintOpacity(0.72) == 0.72)
        #expect(AppAppearancePreferences.clampedTintOpacity(1.2) == 1)
    }

    @Test("The removed Solid preset migrates to a fully opaque tint")
    func migratesLegacySolidStyle() {
        #expect(
            AppAppearancePreferences.migratedTintOpacity(
                0.55,
                legacyStyleRaw: AppAppearancePreferences.legacySolidStyleRawValue
            ) == 1
        )
        #expect(
            AppAppearancePreferences.migratedTintOpacity(
                0.55,
                legacyStyleRaw: "subtle"
            ) == 0.55
        )
    }

    @MainActor
    @Test("Native windows are prepared for behind-window material")
    func preparesNativeWindow() {
        let window = NSWindow()
        window.isOpaque = true
        window.backgroundColor = .black

        AppWindowPresentation.prepareForTranslucency(window)

        #expect(!window.isOpaque)
        #expect(window.backgroundColor == .clear)
    }
}
