import AppKit
import Foundation
import Testing
@testable import TodoTracker

@MainActor
struct MiniDashboardWindowControllerTests {
    @Test("Mini Trackr defaults to always on top")
    func defaultsToAlwaysOnTop() {
        let defaults = makeDefaults()
        let panel = NSPanel()
        let controller = MiniDashboardWindowController(
            defaults: defaults,
            panelFactory: { panel }
        )

        controller.open()

        #expect(controller.isAlwaysOnTop)
        #expect(panel.level == .floating)
        #expect(panel.isFloatingPanel)
        #expect(panel.collectionBehavior.contains(.canJoinAllSpaces))
        #expect(panel.collectionBehavior.contains(.fullScreenAuxiliary))
        #expect(!panel.hidesOnDeactivate)
    }

    @Test("Always on top preference can be disabled and persists")
    func disablesAlwaysOnTop() {
        let defaults = makeDefaults()
        let panel = NSPanel()
        let controller = MiniDashboardWindowController(
            defaults: defaults,
            panelFactory: { panel }
        )
        controller.open()
        panel.isFloatingPanel = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        controller.toggleAlwaysOnTop()

        #expect(!controller.isAlwaysOnTop)
        #expect(panel.level == .normal)
        #expect(!panel.isFloatingPanel)
        #expect(!panel.collectionBehavior.contains(.canJoinAllSpaces))
        #expect(!panel.collectionBehavior.contains(.fullScreenAuxiliary))
        #expect(panel.collectionBehavior.contains(.managed))
        #expect(!panel.hidesOnDeactivate)
        #expect(defaults.bool(forKey: MiniDashboardWindowController.alwaysOnTopDefaultsKey) == false)

        panel.orderOut(nil)
        controller.open()

        #expect(panel.level == .normal)
        #expect(!panel.isFloatingPanel)
        #expect(!panel.collectionBehavior.contains(.canJoinAllSpaces))
        #expect(!panel.collectionBehavior.contains(.fullScreenAuxiliary))
        #expect(panel.collectionBehavior.contains(.managed))
        #expect(!panel.hidesOnDeactivate)
    }

    @Test("Opening Mini Trackr reuses the same panel")
    func reusesPanel() {
        let defaults = makeDefaults()
        var factoryCallCount = 0
        let panel = NSPanel()
        let controller = MiniDashboardWindowController(
            defaults: defaults,
            panelFactory: {
                factoryCallCount += 1
                return panel
            }
        )

        controller.open()
        panel.orderOut(nil)
        controller.open()

        #expect(factoryCallCount == 1)
        #expect(panel.isVisible)
    }

    private func makeDefaults() -> UserDefaults {
        let suiteName = "MiniDashboardWindowControllerTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        return defaults
    }
}
