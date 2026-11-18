import SwiftUI

enum DesignTokens {
    private static let theme = AppStylrTokens.dark

    static let ink = AppStylrTokens.Brand.ink
    static let charcoal = AppStylrTokens.Brand.charcoal
    static let slate = AppStylrTokens.Brand.slate
    static let steel = AppStylrTokens.Brand.steel
    static let sage = AppStylrTokens.Brand.sage
    static let mint = AppStylrTokens.Brand.mint

    // Todo Trackr is dark-first. Both clients adapt the same pinned App Stylr theme.
    static let canvas = theme.canvas
    static let sidebar = theme.sidebar
    static let surface = theme.surface
    static let surfaceRaised = theme.surfaceRaised
    static let border = theme.border
    static let borderStrong = theme.borderStrong
    static let text = theme.text
    static let textMuted = theme.textMuted
    static let action = theme.accent
    static let actionStrong = theme.accentStrong
    static let selected = theme.selected
    static let success = theme.success
    static let warning = theme.warning
    static let danger = theme.danger
    static let dangerSurface = theme.dangerSurface
    static let priorityLowest = theme.textMuted
    static let priorityHighest = theme.danger

    static func sans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        // The bundled variable font registers its native family name as Geist on macOS.
        .custom("Geist", size: size).weight(weight)
    }

    static func mono(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .custom(AppStylrTokens.Typography.monoFamily, size: size).weight(weight)
    }
}
