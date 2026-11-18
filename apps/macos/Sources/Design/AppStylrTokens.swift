// Generated from tokens/app-stylr.json by npm run build. Do not edit.

import SwiftUI

public enum AppStylrTokens {
  public static let version = "1.4.1"

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

  public enum Appearance: String, Sendable { case dark, light }

  public enum Accent: String, Sendable {
    case sage = "mint"
    case ember
    case slate = "blue"
    case royal
    case amber
    case monochrome
  }

  public enum SurfaceTone: String, Sendable { case lighter, normal, darker }

  public static func theme(appearance: Appearance = .dark, accent: Accent = .sage, tone: SurfaceTone = .normal) -> Theme {
    let base: Theme
    switch (appearance, accent) {
    case (.dark, .sage): base = dark
    case (.light, .sage): base = light
    case (.dark, .ember): base = Accents.Ember.dark
    case (.light, .ember): base = Accents.Ember.light
    case (.dark, .slate): base = Accents.Blue.dark
    case (.light, .slate): base = Accents.Blue.light
    case (.dark, .royal): base = Accents.Royal.dark
    case (.light, .royal): base = Accents.Royal.light
    case (.dark, .amber): base = Accents.Amber.dark
    case (.light, .amber): base = Accents.Amber.light
    case (.dark, .monochrome): base = Accents.Monochrome.dark
    case (.light, .monochrome): base = Accents.Monochrome.light
    }
    switch (tone, appearance) {
    case (.lighter, .dark):
      return Theme(
        canvas: Color(red: 0.094118, green: 0.094118, blue: 0.105882),
        sidebar: Color(red: 0.113725, green: 0.113725, blue: 0.12549),
        surface: Color(red: 0.133333, green: 0.133333, blue: 0.145098),
        surfaceRaised: Color(red: 0.176471, green: 0.176471, blue: 0.192157),
        border: Color(red: 0.231373, green: 0.231373, blue: 0.25098),
        borderStrong: Color(red: 0.529412, green: 0.529412, blue: 0.556863),
        text: base.text,
        textMuted: base.textMuted,
        accent: base.accent,
        accentText: base.accentText,
        accentStrong: base.accentStrong,
        link: base.link,
        focus: base.focus,
        selected: base.selected,
        selectedText: base.selectedText,
        success: base.success,
        successSurface: base.successSurface,
        warning: base.warning,
        warningSurface: base.warningSurface,
        danger: base.danger,
        dangerSurface: base.dangerSurface,
        info: base.info,
        infoSurface: base.infoSurface
      )
    case (.lighter, .light):
      return Theme(
        canvas: Color(red: 0.988235, green: 0.992157, blue: 0.988235),
        sidebar: Color(red: 0.956863, green: 0.968627, blue: 0.964706),
        surface: Color(red: 1, green: 1, blue: 1),
        surfaceRaised: Color(red: 1, green: 1, blue: 1),
        border: Color(red: 0.878431, green: 0.909804, blue: 0.898039),
        borderStrong: Color(red: 0.419608, green: 0.494118, blue: 0.509804),
        text: base.text,
        textMuted: base.textMuted,
        accent: base.accent,
        accentText: base.accentText,
        accentStrong: base.accentStrong,
        link: base.link,
        focus: base.focus,
        selected: base.selected,
        selectedText: base.selectedText,
        success: base.success,
        successSurface: base.successSurface,
        warning: base.warning,
        warningSurface: base.warningSurface,
        danger: base.danger,
        dangerSurface: base.dangerSurface,
        info: base.info,
        infoSurface: base.infoSurface
      )
    case (.darker, .dark):
      return Theme(
        canvas: Color(red: 0.027451, green: 0.027451, blue: 0.035294),
        sidebar: Color(red: 0.043137, green: 0.043137, blue: 0.05098),
        surface: Color(red: 0.062745, green: 0.062745, blue: 0.070588),
        surfaceRaised: Color(red: 0.098039, green: 0.098039, blue: 0.109804),
        border: Color(red: 0.141176, green: 0.141176, blue: 0.156863),
        borderStrong: Color(red: 0.435294, green: 0.435294, blue: 0.462745),
        text: base.text,
        textMuted: base.textMuted,
        accent: base.accent,
        accentText: base.accentText,
        accentStrong: base.accentStrong,
        link: base.link,
        focus: base.focus,
        selected: base.selected,
        selectedText: base.selectedText,
        success: base.success,
        successSurface: base.successSurface,
        warning: base.warning,
        warningSurface: base.warningSurface,
        danger: base.danger,
        dangerSurface: base.dangerSurface,
        info: base.info,
        infoSurface: base.infoSurface
      )
    case (.darker, .light):
      return Theme(
        canvas: Color(red: 0.913725, green: 0.937255, blue: 0.92549),
        sidebar: Color(red: 0.882353, green: 0.913725, blue: 0.898039),
        surface: Color(red: 0.941176, green: 0.960784, blue: 0.94902),
        surfaceRaised: Color(red: 0.968627, green: 0.980392, blue: 0.976471),
        border: Color(red: 0.760784, green: 0.811765, blue: 0.792157),
        borderStrong: Color(red: 0.321569, green: 0.419608, blue: 0.443137),
        text: base.text,
        textMuted: base.textMuted,
        accent: base.accent,
        accentText: base.accentText,
        accentStrong: base.accentStrong,
        link: base.link,
        focus: base.focus,
        selected: base.selected,
        selectedText: base.selectedText,
        success: base.success,
        successSurface: base.successSurface,
        warning: base.warning,
        warningSurface: base.warningSurface,
        danger: base.danger,
        dangerSurface: base.dangerSurface,
        info: base.info,
        infoSurface: base.infoSurface
      )
    default: return base
    }
  }

  public struct TypeStyle: Sendable {
    public let size: CGFloat
    public let lineHeight: CGFloat
    public let weight: Int
    public let letterSpacing: CGFloat
  }

  public enum Accents {
    public static let names: [String: String] = [
      "mint": "Sage",
      "ember": "Ember",
      "blue": "Slate",
      "royal": "Royal",
      "amber": "Amber",
      "monochrome": "Monochrome"
    ]

    public enum Ember {
      public static let dark = Theme(
        canvas: Color(red: 0.054902, green: 0.054902, blue: 0.062745),
        sidebar: Color(red: 0.070588, green: 0.070588, blue: 0.078431),
        surface: Color(red: 0.082353, green: 0.082353, blue: 0.090196),
        surfaceRaised: Color(red: 0.12549, green: 0.12549, blue: 0.137255),
        border: Color(red: 0.164706, green: 0.164706, blue: 0.180392),
        borderStrong: Color(red: 0.454902, green: 0.454902, blue: 0.47451),
        text: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        textMuted: Color(red: 0.654902, green: 0.654902, blue: 0.682353),
        accent: Color(red: 0.937255, green: 0.545098, blue: 0.486275),
        accentText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        accentStrong: Color(red: 1, green: 0.701961, blue: 0.647059),
        link: Color(red: 0.937255, green: 0.545098, blue: 0.486275),
        focus: Color(red: 0.937255, green: 0.545098, blue: 0.486275),
        selected: Color(red: 0.258824, green: 0.168627, blue: 0.152941),
        selectedText: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        success: Color(red: 0.509804, green: 0.827451, blue: 0.654902),
        successSurface: Color(red: 0.090196, green: 0.192157, blue: 0.14902),
        warning: Color(red: 0.94902, green: 0.768627, blue: 0.435294),
        warningSurface: Color(red: 0.207843, green: 0.168627, blue: 0.094118),
        danger: Color(red: 1, green: 0.568627, blue: 0.537255),
        dangerSurface: Color(red: 0.219608, green: 0.12549, blue: 0.121569),
        info: Color(red: 0.937255, green: 0.545098, blue: 0.486275),
        infoSurface: Color(red: 0.219608, green: 0.141176, blue: 0.12549)
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
        accent: Color(red: 0.627451, green: 0.266667, blue: 0.207843),
        accentText: Color(red: 1, green: 1, blue: 1),
        accentStrong: Color(red: 0.470588, green: 0.188235, blue: 0.145098),
        link: Color(red: 0.627451, green: 0.266667, blue: 0.207843),
        focus: Color(red: 0.627451, green: 0.266667, blue: 0.207843),
        selected: Color(red: 0.964706, green: 0.87451, blue: 0.85098),
        selectedText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        success: Color(red: 0.184314, green: 0.419608, blue: 0.309804),
        successSurface: Color(red: 0.909804, green: 0.960784, blue: 0.929412),
        warning: Color(red: 0.541176, green: 0.352941, blue: 0),
        warningSurface: Color(red: 1, green: 0.956863, blue: 0.839216),
        danger: Color(red: 0.639216, green: 0.227451, blue: 0.196078),
        dangerSurface: Color(red: 0.988235, green: 0.921569, blue: 0.913725),
        info: Color(red: 0.627451, green: 0.266667, blue: 0.207843),
        infoSurface: Color(red: 0.968627, green: 0.905882, blue: 0.886275)
      )
    }

    public enum Blue {
      public static let dark = Theme(
        canvas: Color(red: 0.054902, green: 0.054902, blue: 0.062745),
        sidebar: Color(red: 0.070588, green: 0.070588, blue: 0.078431),
        surface: Color(red: 0.082353, green: 0.082353, blue: 0.090196),
        surfaceRaised: Color(red: 0.12549, green: 0.12549, blue: 0.137255),
        border: Color(red: 0.164706, green: 0.164706, blue: 0.180392),
        borderStrong: Color(red: 0.454902, green: 0.454902, blue: 0.47451),
        text: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        textMuted: Color(red: 0.654902, green: 0.654902, blue: 0.682353),
        accent: Color(red: 0.607843, green: 0.713725, blue: 0.8),
        accentText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        accentStrong: Color(red: 0.756863, green: 0.831373, blue: 0.890196),
        link: Color(red: 0.607843, green: 0.713725, blue: 0.8),
        focus: Color(red: 0.607843, green: 0.713725, blue: 0.8),
        selected: Color(red: 0.160784, green: 0.223529, blue: 0.266667),
        selectedText: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        success: Color(red: 0.509804, green: 0.827451, blue: 0.654902),
        successSurface: Color(red: 0.090196, green: 0.192157, blue: 0.14902),
        warning: Color(red: 0.94902, green: 0.768627, blue: 0.435294),
        warningSurface: Color(red: 0.207843, green: 0.168627, blue: 0.094118),
        danger: Color(red: 1, green: 0.568627, blue: 0.537255),
        dangerSurface: Color(red: 0.219608, green: 0.12549, blue: 0.121569),
        info: Color(red: 0.607843, green: 0.713725, blue: 0.8),
        infoSurface: Color(red: 0.113725, green: 0.172549, blue: 0.211765)
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
        accent: Color(red: 0.243137, green: 0.372549, blue: 0.470588),
        accentText: Color(red: 1, green: 1, blue: 1),
        accentStrong: Color(red: 0.168627, green: 0.27451, blue: 0.360784),
        link: Color(red: 0.243137, green: 0.372549, blue: 0.470588),
        focus: Color(red: 0.243137, green: 0.372549, blue: 0.470588),
        selected: Color(red: 0.87451, green: 0.909804, blue: 0.937255),
        selectedText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        success: Color(red: 0.184314, green: 0.419608, blue: 0.309804),
        successSurface: Color(red: 0.909804, green: 0.960784, blue: 0.929412),
        warning: Color(red: 0.541176, green: 0.352941, blue: 0),
        warningSurface: Color(red: 1, green: 0.956863, blue: 0.839216),
        danger: Color(red: 0.639216, green: 0.227451, blue: 0.196078),
        dangerSurface: Color(red: 0.988235, green: 0.921569, blue: 0.913725),
        info: Color(red: 0.243137, green: 0.372549, blue: 0.470588),
        infoSurface: Color(red: 0.905882, green: 0.933333, blue: 0.952941)
      )
    }

    public enum Royal {
      public static let dark = Theme(
        canvas: Color(red: 0.054902, green: 0.054902, blue: 0.062745),
        sidebar: Color(red: 0.070588, green: 0.070588, blue: 0.078431),
        surface: Color(red: 0.082353, green: 0.082353, blue: 0.090196),
        surfaceRaised: Color(red: 0.12549, green: 0.12549, blue: 0.137255),
        border: Color(red: 0.164706, green: 0.164706, blue: 0.180392),
        borderStrong: Color(red: 0.454902, green: 0.454902, blue: 0.47451),
        text: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        textMuted: Color(red: 0.654902, green: 0.654902, blue: 0.682353),
        accent: Color(red: 0.678431, green: 0.627451, blue: 0.803922),
        accentText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        accentStrong: Color(red: 0.807843, green: 0.764706, blue: 0.898039),
        link: Color(red: 0.678431, green: 0.627451, blue: 0.803922),
        focus: Color(red: 0.678431, green: 0.627451, blue: 0.803922),
        selected: Color(red: 0.207843, green: 0.184314, blue: 0.270588),
        selectedText: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        success: Color(red: 0.509804, green: 0.827451, blue: 0.654902),
        successSurface: Color(red: 0.090196, green: 0.192157, blue: 0.14902),
        warning: Color(red: 0.94902, green: 0.768627, blue: 0.435294),
        warningSurface: Color(red: 0.207843, green: 0.168627, blue: 0.094118),
        danger: Color(red: 1, green: 0.568627, blue: 0.537255),
        dangerSurface: Color(red: 0.219608, green: 0.12549, blue: 0.121569),
        info: Color(red: 0.678431, green: 0.627451, blue: 0.803922),
        infoSurface: Color(red: 0.168627, green: 0.14902, blue: 0.223529)
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
        accent: Color(red: 0.4, green: 0.317647, blue: 0.505882),
        accentText: Color(red: 1, green: 1, blue: 1),
        accentStrong: Color(red: 0.286275, green: 0.215686, blue: 0.372549),
        link: Color(red: 0.4, green: 0.317647, blue: 0.505882),
        focus: Color(red: 0.4, green: 0.317647, blue: 0.505882),
        selected: Color(red: 0.913725, green: 0.890196, blue: 0.945098),
        selectedText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        success: Color(red: 0.184314, green: 0.419608, blue: 0.309804),
        successSurface: Color(red: 0.909804, green: 0.960784, blue: 0.929412),
        warning: Color(red: 0.541176, green: 0.352941, blue: 0),
        warningSurface: Color(red: 1, green: 0.956863, blue: 0.839216),
        danger: Color(red: 0.639216, green: 0.227451, blue: 0.196078),
        dangerSurface: Color(red: 0.988235, green: 0.921569, blue: 0.913725),
        info: Color(red: 0.4, green: 0.317647, blue: 0.505882),
        infoSurface: Color(red: 0.941176, green: 0.92549, blue: 0.964706)
      )
    }

    public enum Amber {
      public static let dark = Theme(
        canvas: Color(red: 0.054902, green: 0.054902, blue: 0.062745),
        sidebar: Color(red: 0.070588, green: 0.070588, blue: 0.078431),
        surface: Color(red: 0.082353, green: 0.082353, blue: 0.090196),
        surfaceRaised: Color(red: 0.12549, green: 0.12549, blue: 0.137255),
        border: Color(red: 0.164706, green: 0.164706, blue: 0.180392),
        borderStrong: Color(red: 0.454902, green: 0.454902, blue: 0.47451),
        text: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        textMuted: Color(red: 0.654902, green: 0.654902, blue: 0.682353),
        accent: Color(red: 0.784314, green: 0.701961, blue: 0.560784),
        accentText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        accentStrong: Color(red: 0.878431, green: 0.811765, blue: 0.698039),
        link: Color(red: 0.784314, green: 0.701961, blue: 0.560784),
        focus: Color(red: 0.784314, green: 0.701961, blue: 0.560784),
        selected: Color(red: 0.227451, green: 0.196078, blue: 0.152941),
        selectedText: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        success: Color(red: 0.509804, green: 0.827451, blue: 0.654902),
        successSurface: Color(red: 0.090196, green: 0.192157, blue: 0.14902),
        warning: Color(red: 0.94902, green: 0.768627, blue: 0.435294),
        warningSurface: Color(red: 0.207843, green: 0.168627, blue: 0.094118),
        danger: Color(red: 1, green: 0.568627, blue: 0.537255),
        dangerSurface: Color(red: 0.219608, green: 0.12549, blue: 0.121569),
        info: Color(red: 0.784314, green: 0.701961, blue: 0.560784),
        infoSurface: Color(red: 0.184314, green: 0.160784, blue: 0.121569)
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
        accent: Color(red: 0.47451, green: 0.380392, blue: 0.247059),
        accentText: Color(red: 1, green: 1, blue: 1),
        accentStrong: Color(red: 0.341176, green: 0.266667, blue: 0.168627),
        link: Color(red: 0.47451, green: 0.380392, blue: 0.247059),
        focus: Color(red: 0.47451, green: 0.380392, blue: 0.247059),
        selected: Color(red: 0.933333, green: 0.901961, blue: 0.85098),
        selectedText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        success: Color(red: 0.184314, green: 0.419608, blue: 0.309804),
        successSurface: Color(red: 0.909804, green: 0.960784, blue: 0.929412),
        warning: Color(red: 0.541176, green: 0.352941, blue: 0),
        warningSurface: Color(red: 1, green: 0.956863, blue: 0.839216),
        danger: Color(red: 0.639216, green: 0.227451, blue: 0.196078),
        dangerSurface: Color(red: 0.988235, green: 0.921569, blue: 0.913725),
        info: Color(red: 0.47451, green: 0.380392, blue: 0.247059),
        infoSurface: Color(red: 0.960784, green: 0.941176, blue: 0.905882)
      )
    }

    public enum Monochrome {
      public static let dark = Theme(
        canvas: Color(red: 0.054902, green: 0.054902, blue: 0.062745),
        sidebar: Color(red: 0.070588, green: 0.070588, blue: 0.078431),
        surface: Color(red: 0.082353, green: 0.082353, blue: 0.090196),
        surfaceRaised: Color(red: 0.12549, green: 0.12549, blue: 0.137255),
        border: Color(red: 0.164706, green: 0.164706, blue: 0.180392),
        borderStrong: Color(red: 0.454902, green: 0.454902, blue: 0.47451),
        text: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        textMuted: Color(red: 0.654902, green: 0.654902, blue: 0.682353),
        accent: Color(red: 0.160784, green: 0.160784, blue: 0.180392),
        accentText: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        accentStrong: Color(red: 0.235294, green: 0.235294, blue: 0.266667),
        link: Color(red: 0.694118, green: 0.694118, blue: 0.721569),
        focus: Color(red: 0.580392, green: 0.580392, blue: 0.611765),
        selected: Color(red: 0.12549, green: 0.12549, blue: 0.141176),
        selectedText: Color(red: 0.960784, green: 0.956863, blue: 0.952941),
        success: Color(red: 0.509804, green: 0.827451, blue: 0.654902),
        successSurface: Color(red: 0.090196, green: 0.192157, blue: 0.14902),
        warning: Color(red: 0.94902, green: 0.768627, blue: 0.435294),
        warningSurface: Color(red: 0.207843, green: 0.168627, blue: 0.094118),
        danger: Color(red: 1, green: 0.568627, blue: 0.537255),
        dangerSurface: Color(red: 0.219608, green: 0.12549, blue: 0.121569),
        info: Color(red: 0.694118, green: 0.694118, blue: 0.721569),
        infoSurface: Color(red: 0.145098, green: 0.145098, blue: 0.160784)
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
        accent: Color(red: 0.952941, green: 0.952941, blue: 0.960784),
        accentText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        accentStrong: Color(red: 0.890196, green: 0.890196, blue: 0.905882),
        link: Color(red: 0.333333, green: 0.333333, blue: 0.360784),
        focus: Color(red: 0.411765, green: 0.411765, blue: 0.443137),
        selected: Color(red: 0.941176, green: 0.941176, blue: 0.94902),
        selectedText: Color(red: 0.066667, green: 0.066667, blue: 0.066667),
        success: Color(red: 0.184314, green: 0.419608, blue: 0.309804),
        successSurface: Color(red: 0.909804, green: 0.960784, blue: 0.929412),
        warning: Color(red: 0.541176, green: 0.352941, blue: 0),
        warningSurface: Color(red: 1, green: 0.956863, blue: 0.839216),
        danger: Color(red: 0.639216, green: 0.227451, blue: 0.196078),
        dangerSurface: Color(red: 0.988235, green: 0.921569, blue: 0.913725),
        info: Color(red: 0.333333, green: 0.333333, blue: 0.360784),
        infoSurface: Color(red: 0.937255, green: 0.937255, blue: 0.94902)
      )
    }
  }

  public enum Typography {
    public static let sansFamily = "Geist Sans"
    public static let monoFamily = "Geist Mono"

    public static let display = TypeStyle(
      size: 36,
      lineHeight: 40,
      weight: 500,
      letterSpacing: -1.08
    )

    public static let heading1 = TypeStyle(
      size: 28,
      lineHeight: 34,
      weight: 600,
      letterSpacing: -0.56
    )

    public static let heading2 = TypeStyle(
      size: 22,
      lineHeight: 28,
      weight: 600,
      letterSpacing: -0.44
    )

    public static let heading3 = TypeStyle(
      size: 17,
      lineHeight: 23,
      weight: 600,
      letterSpacing: -0.17
    )

    public static let body = TypeStyle(
      size: 15,
      lineHeight: 23,
      weight: 400,
      letterSpacing: 0
    )

    public static let small = TypeStyle(
      size: 13,
      lineHeight: 19,
      weight: 400,
      letterSpacing: 0
    )

    public static let label = TypeStyle(
      size: 12,
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
    public static let button: CGFloat = 4
    public static let control: CGFloat = 4
    public static let card: CGFloat = 8
    public static let dialog: CGFloat = 12
  }

  public enum Size {
    public static let control: CGFloat = 44
    public static let controlCompact: CGFloat = 40
    public static let readingWidthCharacters = 68
  }

  public enum Motion {
    public static let controlMilliseconds = 140
    public static let panelMilliseconds = 200
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
    public static let background = Color(red: 0.14902, green: 0.14902, blue: 0.14902)
    public static let foreground = Color(red: 0.960784, green: 0.960784, blue: 0.960784)
    public static let canvas: CGFloat = 1024
    public static let square: CGFloat = 1024
    public static let inset: CGFloat = 0
    public static let radius: CGFloat = 160
    public static let safeAreaPercent: CGFloat = 9
    public static let gradientAngleDegrees: Double = 135
    public static let monochromeGradientAngleDegrees: Double = 135
    public static let monochromeGradientStops: [Gradient.Stop] = [
      .init(color: Color(red: 0.219608, green: 0.219608, blue: 0.219608), location: 0),
      .init(color: Color(red: 0.12549, green: 0.12549, blue: 0.12549), location: 1)
    ]
  }
}
