// Generated from tokens/app-stylr.json by npm run build. Do not edit.

import SwiftUI

public enum AppStylrTokens {
  public static let version = "1.2.0"

  public enum Brand {
    public static let ink = Color(red: 0.066667, green: 0.066667, blue: 0.066667)
    public static let charcoal = Color(red: 0.180392, green: 0.192157, blue: 0.207843)
    public static let slate = Color(red: 0.286275, green: 0.329412, blue: 0.356863)
    public static let steel = Color(red: 0.392157, green: 0.482353, blue: 0.505882)
    public static let sage = Color(red: 0.513725, green: 0.643137, blue: 0.639216)
    public static let mint = Color(red: 0.662745, green: 0.807843, blue: 0.760784)
  }

  public struct Theme: Sendable {
    public let canvas: Color
    public let sidebar: Color
    public let surface: Color
    public let surfaceRaised: Color
    public let border: Color
    public let borderStrong: Color
    public let text: Color
    public let textMuted: Color
    public let accent: Color
    public let accentText: Color
    public let accentStrong: Color
    public let link: Color
    public let focus: Color
    public let selected: Color
    public let selectedText: Color
    public let success: Color
    public let successSurface: Color
    public let warning: Color
    public let warningSurface: Color
    public let danger: Color
    public let dangerSurface: Color
    public let info: Color
    public let infoSurface: Color
  }

  public static let dark = Theme(
      canvas: Color(red: 0.054902, green: 0.054902, blue: 0.062745),
      sidebar: Color(red: 0.070588, green: 0.070588, blue: 0.078431),
      surface: Color(red: 0.082353, green: 0.082353, blue: 0.090196),
      surfaceRaised: Color(red: 0.12549, green: 0.12549, blue: 0.137255),
      border: Color(red: 0.164706, green: 0.164706, blue: 0.180392),
      borderStrong: Color(red: 0.454902, green: 0.454902, blue: 0.47451),
      text: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
      textMuted: Color(red: 0.654902, green: 0.654902, blue: 0.682353),
      accent: Color(red: 0.662745, green: 0.807843, blue: 0.760784),
      accentText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
      accentStrong: Color(red: 0.764706, green: 0.890196, blue: 0.85098),
      link: Color(red: 0.662745, green: 0.807843, blue: 0.760784),
      focus: Color(red: 0.662745, green: 0.807843, blue: 0.760784),
      selected: Color(red: 0.14902, green: 0.239216, blue: 0.223529),
      selectedText: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
      success: Color(red: 0.509804, green: 0.827451, blue: 0.654902),
      successSurface: Color(red: 0.090196, green: 0.192157, blue: 0.14902),
      warning: Color(red: 0.94902, green: 0.768627, blue: 0.435294),
      warningSurface: Color(red: 0.207843, green: 0.168627, blue: 0.094118),
      danger: Color(red: 1, green: 0.568627, blue: 0.537255),
      dangerSurface: Color(red: 0.219608, green: 0.12549, blue: 0.121569),
      info: Color(red: 0.662745, green: 0.807843, blue: 0.760784),
      infoSurface: Color(red: 0.109804, green: 0.188235, blue: 0.176471)
  )

  public static let light = Theme(
      canvas: Color(red: 0.968627, green: 0.980392, blue: 0.976471),
      sidebar: Color(red: 0.933333, green: 0.956863, blue: 0.94902),
      surface: Color(red: 1, green: 1, blue: 1),
      surfaceRaised: Color(red: 1, green: 1, blue: 1),
      border: Color(red: 0.847059, green: 0.894118, blue: 0.878431),
      borderStrong: Color(red: 0.392157, green: 0.482353, blue: 0.505882),
      text: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
      textMuted: Color(red: 0.286275, green: 0.329412, blue: 0.356863),
      accent: Color(red: 0.180392, green: 0.192157, blue: 0.207843),
      accentText: Color(red: 1, green: 1, blue: 1),
      accentStrong: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
      link: Color(red: 0.192157, green: 0.368627, blue: 0.352941),
      focus: Color(red: 0.192157, green: 0.368627, blue: 0.352941),
      selected: Color(red: 0.662745, green: 0.807843, blue: 0.760784),
      selectedText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
      success: Color(red: 0.184314, green: 0.419608, blue: 0.309804),
      successSurface: Color(red: 0.909804, green: 0.960784, blue: 0.929412),
      warning: Color(red: 0.541176, green: 0.352941, blue: 0),
      warningSurface: Color(red: 1, green: 0.956863, blue: 0.839216),
      danger: Color(red: 0.639216, green: 0.227451, blue: 0.196078),
      dangerSurface: Color(red: 0.988235, green: 0.921569, blue: 0.913725),
      info: Color(red: 0.192157, green: 0.368627, blue: 0.352941),
      infoSurface: Color(red: 0.901961, green: 0.94902, blue: 0.937255)
  )

  public struct TypeStyle: Sendable {
    public let size: CGFloat
    public let lineHeight: CGFloat
    public let weight: Int
    public let letterSpacing: CGFloat
  }

  public enum Typography {
    public static let sansFamily = "Geist Sans"
    public static let monoFamily = "Geist Mono"

    public static let display = TypeStyle(
      size: 40,
      lineHeight: 44,
      weight: 700,
      letterSpacing: -0.8
    )

    public static let heading1 = TypeStyle(
      size: 32,
      lineHeight: 38,
      weight: 700,
      letterSpacing: -0.64
    )

    public static let heading2 = TypeStyle(
      size: 26,
      lineHeight: 32,
      weight: 650,
      letterSpacing: -0.52
    )

    public static let heading3 = TypeStyle(
      size: 20,
      lineHeight: 26,
      weight: 600,
      letterSpacing: -0.4
    )

    public static let body = TypeStyle(
      size: 16,
      lineHeight: 24,
      weight: 400,
      letterSpacing: 0
    )

    public static let small = TypeStyle(
      size: 14,
      lineHeight: 20,
      weight: 400,
      letterSpacing: 0
    )

    public static let label = TypeStyle(
      size: 13,
      lineHeight: 16,
      weight: 500,
      letterSpacing: 0
    )

    public static let monoMetadata = TypeStyle(
      size: 12,
      lineHeight: 16,
      weight: 500,
      letterSpacing: 0
    )
  }

  public enum Spacing {
    public static let space4: CGFloat = 4
    public static let space8: CGFloat = 8
    public static let space12: CGFloat = 12
    public static let space16: CGFloat = 16
    public static let space24: CGFloat = 24
    public static let space32: CGFloat = 32
    public static let space48: CGFloat = 48
    public static let space64: CGFloat = 64
  }

  public enum Radius {
    public static let button: CGFloat = 9
    public static let control: CGFloat = 8
    public static let card: CGFloat = 12
    public static let dialog: CGFloat = 16
  }

  public enum Size {
    public static let control: CGFloat = 44
    public static let controlCompact: CGFloat = 40
    public static let readingWidthCharacters = 68
  }

  public enum Motion {
    public static let controlMilliseconds = 160
    public static let panelMilliseconds = 240
    public static let syncPulseMilliseconds = 1200
  }

  public enum GameProfile {
    public static let minimumViewportWidth: CGFloat = 1024
    public static let controlHeight: CGFloat = 48
    public static let primaryControlHeight: CGFloat = 58
    public static let readingTextSize: CGFloat = 14
    public static let readingLineHeight: CGFloat = 21
    public static let labelTextSize: CGFloat = 12
    public static let labelLineHeight: CGFloat = 16
    public static let disclosureSummaryHeight: CGFloat = 76
    public static let disclosureToggleSize: CGFloat = 32
  }

  public enum Icon {
    public static let canvas: CGFloat = 1024
    public static let square: CGFloat = 840
    public static let inset: CGFloat = 92
    public static let radius: CGFloat = 190
    public static let safeAreaPercent: CGFloat = 9
    public static let gradientAngleDegrees: Double = 135
  }
}
