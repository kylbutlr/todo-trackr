import CoreText
import Foundation

enum FontRegistration {
    static func registerBundledFonts() {
        let filenames = ["Geist-Variable", "GeistMono-Variable"]
        let appFontsDirectory = Bundle.main.resourceURL?.appendingPathComponent("Fonts")
        let sourceFontsDirectory = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Resources/Fonts")

        for filename in filenames {
            let relativePath = "\(filename).ttf"
            let candidates = [appFontsDirectory, sourceFontsDirectory]
                .compactMap { $0?.appendingPathComponent(relativePath) }
            guard let url = candidates.first(where: { FileManager.default.fileExists(atPath: $0.path) }) else {
                continue
            }

            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}
