import AppKit
import Foundation

enum WebReviewLauncher {
    static let chromeBundleIdentifier = "com.google.Chrome"
    static let baseURL = URL(string: "https://todotrackr.netlify.app")!

    static func destinationURL(for summary: ReviewSummary) -> URL {
        let connection = summary.sources.granola > 0
            ? "granola"
            : summary.sources.shortcut > 0
                ? "shortcut"
                : nil
        guard let connection else { return baseURL }

        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "view", value: "connection:\(connection)")]
        return components.url!
    }

    @MainActor
    static func open(_ summary: ReviewSummary, workspace: NSWorkspace = .shared) {
        let url = destinationURL(for: summary)
        guard let chromeURL = workspace.urlForApplication(withBundleIdentifier: chromeBundleIdentifier) else {
            workspace.open(url)
            return
        }

        workspace.open(
            [url],
            withApplicationAt: chromeURL,
            configuration: NSWorkspace.OpenConfiguration()
        ) { _, error in
            if error != nil {
                Task { @MainActor in
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }
}
