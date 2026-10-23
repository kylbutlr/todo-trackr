import Foundation
import Testing
@testable import TodoTracker

struct WebReviewLauncherTests {
    @Test("Routes Granola reviews to the Granola connection")
    func granolaDestination() {
        let summary = ReviewSummary(
            generatedAt: .now,
            total: 3,
            sources: .init(granola: 2, shortcut: 1)
        )

        #expect(WebReviewLauncher.destinationURL(for: summary).absoluteString == "https://todotrackr.netlify.app?view=connection:granola")
    }

    @Test("Routes Shortcut-only reviews to the Shortcut connection")
    func shortcutDestination() {
        let summary = ReviewSummary(
            generatedAt: .now,
            total: 2,
            sources: .init(granola: 0, shortcut: 2)
        )

        #expect(WebReviewLauncher.destinationURL(for: summary).absoluteString == "https://todotrackr.netlify.app?view=connection:shortcut")
    }
}
