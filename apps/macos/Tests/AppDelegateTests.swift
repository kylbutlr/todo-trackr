import AppKit
import Testing
@testable import TodoTracker

@MainActor
@Suite(.serialized)
struct AppDelegateTests {
    @Test("Handles a Dock reopen request while the app remains running")
    func handlesDockReopenRequest() {
        let delegate = AppDelegate()
        var reopenCount = 0
        AppDelegate.onShouldReopen = { reopenCount += 1 }
        defer { AppDelegate.onShouldReopen = nil }

        #expect(delegate.responds(to: #selector(NSApplicationDelegate.applicationShouldHandleReopen(_:hasVisibleWindows:))))
        #expect(delegate.applicationShouldHandleReopen(NSApplication.shared, hasVisibleWindows: true) == false)
        #expect(reopenCount == 1)
    }

    @Test("Keeps the workspace visible when Todo Trackr is launched directly")
    func keepsWorkspaceVisibleOnDirectLaunch() async throws {
        let window = NSWindow()
        window.title = "Todo Trackr"
        window.isReleasedWhenClosed = false
        window.orderFront(nil)
        defer { window.close() }

        let delegate = AppDelegate()
        delegate.applicationDidFinishLaunching(
            Notification(name: NSApplication.didFinishLaunchingNotification, object: NSApplication.shared)
        )

        try await Task.sleep(for: .milliseconds(250))

        #expect(window.isVisible)
    }
}
