import AppKit
import Testing
@testable import TodoTracker

@MainActor
@Suite(.serialized)
struct WorkspaceWindowControllerTests {
    @Test("Opens an existing workspace window when registration has not happened yet")
    func opensExistingWorkspaceWindowBeforeRegistration() {
        let window = NSWindow()
        window.title = "Todo Trackr"
        window.isReleasedWhenClosed = false
        defer { window.close() }

        let controller = WorkspaceWindowController(activateApplication: {})
        controller.open()

        #expect(window.isVisible)
    }

    @Test("Creates and opens the workspace when SwiftUI has not materialized a window")
    func createsWorkspaceBeforeSwiftUIRegistration() {
        NSApp.windows
            .filter { $0.title == "Todo Trackr" }
            .forEach { $0.title = "Other Window" }

        var createdWindow: NSWindow?
        let controller = WorkspaceWindowController(activateApplication: {}, makeWindow: {
            let window = NSWindow()
            window.isReleasedWhenClosed = false
            createdWindow = window
            return window
        })

        controller.open()

        #expect(createdWindow?.isVisible == true)
    }

    @Test("Reopens the workspace after its last external window reference is released")
    func reopensWorkspaceAfterClose() {
        let controller = WorkspaceWindowController(activateApplication: {})
        weak var observedWindow: NSWindow?

        autoreleasepool {
            let window = NSWindow()
            window.isReleasedWhenClosed = false
            controller.register(window)
            observedWindow = window
            window.close()
        }

        controller.open()

        #expect(observedWindow != nil)
        #expect(observedWindow?.isVisible == true)
    }

    @Test("Reopens the registered workspace after its navigation title changes")
    func reopensWorkspaceWithChangedTitle() {
        let window = NSWindow()
        window.title = "Todo Trackr"
        let controller = WorkspaceWindowController(activateApplication: {})
        controller.register(window)

        window.title = "Inbox"
        window.orderOut(nil)
        controller.open()

        #expect(window.isVisible)
    }

    @Test("Registers the workspace with standard close and minimize controls")
    func registersStandardWindowControls() {
        let window = NSWindow()
        window.styleMask = [.borderless]
        window.titleVisibility = .hidden
        defer { window.close() }

        let controller = WorkspaceWindowController(activateApplication: {})
        controller.register(window)

        #expect(window.styleMask.contains(.titled))
        #expect(window.styleMask.contains(.closable))
        #expect(window.styleMask.contains(.miniaturizable))
        #expect(window.standardWindowButton(.closeButton)?.isHidden == false)
        #expect(window.standardWindowButton(.miniaturizeButton)?.isHidden == false)
    }

    @Test("Restores a minimized workspace before bringing it forward")
    func restoresMinimizedWorkspace() {
        let window = NSWindow()
        let controller = WorkspaceWindowController(activateApplication: {})
        controller.register(window)
        window.miniaturize(nil)

        controller.open()

        #expect(!window.isMiniaturized)
        #expect(window.isVisible)
    }
}
