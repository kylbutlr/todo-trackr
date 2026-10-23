import AppKit
import Sparkle
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    static var onDidFinishLaunching: (() -> Void)?
    static var onShouldReopen: (() -> Void)?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.accessory)
        Self.onDidFinishLaunching?()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            NSApplication.shared.windows
                .filter { $0.title == "Todo Trackr" }
                .forEach {
                    $0.isReleasedWhenClosed = false
                }
        }
    }

    func applicationWillTerminate(_ notification: Notification) { ConnectionTelemetry.recorder.flush(cleanShutdown: true) }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        Self.onShouldReopen?()
        return false
    }
}

@main
struct TodoTrackerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store: TaskStore
    @StateObject private var quickCaptureController: GlobalQuickCaptureController
    private let updaterController: SPUStandardUpdaterController
    private let workspaceWindowController: WorkspaceWindowController
    private let miniDashboardWindowController: MiniDashboardWindowController
    private let menuBarController: MenuBarController
    private let updatesEnabled: Bool

    init() {
        FontRegistration.registerBundledFonts()
        let store = TaskStore()
        let quickCaptureController = GlobalQuickCaptureController()
        let workspaceWindowController = WorkspaceWindowController(store: store)
        let shouldEnableUpdates = Bundle.main.bundleURL.pathExtension == "app"
            && Bundle.main.object(forInfoDictionaryKey: "SUFeedURL") != nil
        let updaterController = SPUStandardUpdaterController(
            startingUpdater: shouldEnableUpdates,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )

        _store = StateObject(wrappedValue: store)
        _quickCaptureController = StateObject(wrappedValue: quickCaptureController)
        updatesEnabled = shouldEnableUpdates
        self.updaterController = updaterController
        self.workspaceWindowController = workspaceWindowController
        let miniDashboardWindowController = MiniDashboardWindowController(
            store: store,
            workspaceWindowController: workspaceWindowController
        )
        self.miniDashboardWindowController = miniDashboardWindowController
        store.setTaskSurfaceVisibilityProvider {
            [weak workspaceWindowController, weak miniDashboardWindowController] in
            workspaceWindowController?.isVisible == true || miniDashboardWindowController?.isVisible == true
        }
        store.startAutoRefresh()
        let menuBarController = MenuBarController(
            store: store,
            workspaceWindowController: workspaceWindowController,
            miniDashboardWindowController: miniDashboardWindowController,
            quickCaptureController: quickCaptureController,
            checkForUpdates: { updaterController.checkForUpdates(nil) },
            updatesEnabled: shouldEnableUpdates
        )
        self.menuBarController = menuBarController
        AppDelegate.onDidFinishLaunching = {
            menuBarController.start()
        }
        AppDelegate.onShouldReopen = { workspaceWindowController.open() }
    }

    var body: some Scene {
        WindowGroup("Todo Trackr", id: "workspace") {
            ContentView()
                .environmentObject(store)
                .font(DesignTokens.sans(14))
                .preferredColorScheme(.dark)
                .frame(minWidth: 380, minHeight: 620)
                .background(WorkspaceWindowReader(register: workspaceWindowController.register))
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1_120, height: 720)
        .commands {
            CommandGroup(replacing: .appSettings) {}
            CommandGroup(after: .appInfo) {
                Button("Check for Updates…") {
                    updaterController.checkForUpdates(nil)
                }
                .disabled(!updatesEnabled)
            }
        }

    }
}
