import AppKit
import SwiftUI

enum AppAppearancePreferences {
    // Retained to migrate the removed Solid, Subtle, and Glass preset control.
    static let backgroundStyleKey = "todo-trackr.appearance.background-style"
    static let tintOpacityKey = "todo-trackr.appearance.tint-opacity"
    static let glassStyleRawValue = "glass"
    static let legacySolidStyleRawValue = "solid"
    static let defaultTintOpacity = 0.5
    static let tintOpacityRange = 0.0...1.0

    static func clampedTintOpacity(_ opacity: Double) -> Double {
        min(max(opacity, tintOpacityRange.lowerBound), tintOpacityRange.upperBound)
    }

    static func migratedTintOpacity(_ opacity: Double, legacyStyleRaw: String) -> Double {
        guard legacyStyleRaw != legacySolidStyleRawValue else { return 1 }
        return clampedTintOpacity(opacity)
    }
}

enum AppSurfaceRole {
    case canvas
    case sidebar
    case surface
    case surfaceRaised

    var solidColor: Color {
        switch self {
        case .canvas: DesignTokens.canvas
        case .sidebar: DesignTokens.sidebar
        case .surface: DesignTokens.surface
        case .surfaceRaised: DesignTokens.surfaceRaised
        }
    }

    var glassColor: Color {
        switch self {
        case .canvas:
            .clear
        case .sidebar:
            DesignTokens.sidebar.opacity(0.72)
        case .surface:
            DesignTokens.surface.opacity(0.86)
        case .surfaceRaised:
            DesignTokens.surfaceRaised.opacity(0.9)
        }
    }
}

struct AppWindowBackground: View {
    @AppStorage(AppAppearancePreferences.backgroundStyleKey)
    private var legacyStyleRaw = AppAppearancePreferences.glassStyleRawValue
    @AppStorage(AppAppearancePreferences.tintOpacityKey)
    private var tintOpacity = AppAppearancePreferences.defaultTintOpacity
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        ZStack {
            if !reduceTransparency {
                NativeVisualEffectView()
            }

            DesignTokens.canvas.opacity(effectiveTintOpacity)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    private var effectiveTintOpacity: Double {
        guard !reduceTransparency else { return 1 }
        return AppAppearancePreferences.migratedTintOpacity(
            tintOpacity,
            legacyStyleRaw: legacyStyleRaw
        )
    }
}

private struct NativeVisualEffectView: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = .underWindowBackground
        view.blendingMode = .behindWindow
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = .underWindowBackground
        nsView.blendingMode = .behindWindow
        nsView.state = .active
    }
}

private struct AppSurfaceBackgroundModifier: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    let role: AppSurfaceRole

    func body(content: Content) -> some View {
        content.background(backgroundColor)
    }

    private var backgroundColor: Color {
        guard !reduceTransparency else { return role.solidColor }
        return role.glassColor
    }
}

extension View {
    func appSurfaceBackground(_ role: AppSurfaceRole) -> some View {
        modifier(AppSurfaceBackgroundModifier(role: role))
    }
}

enum AppWindowPresentation {
    @MainActor
    static func prepareForTranslucency(_ window: NSWindow) {
        window.isOpaque = false
        window.backgroundColor = .clear
    }
}
