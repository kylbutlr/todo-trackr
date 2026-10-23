import AppKit
import SwiftUI

@MainActor
final class MenuBarController: NSObject {
    private let store: TaskStore
    private let workspaceWindowController: WorkspaceWindowController
    private let miniDashboardWindowController: MiniDashboardWindowController
    private let quickCaptureController: GlobalQuickCaptureController
    private let checkForUpdates: () -> Void
    private let updatesEnabled: Bool
    private var statusItem: NSStatusItem?
    private let menu = NSMenu()
    private var quickCaptureWindow: NSWindow?

    init(
        store: TaskStore,
        workspaceWindowController: WorkspaceWindowController,
        miniDashboardWindowController: MiniDashboardWindowController,
        quickCaptureController: GlobalQuickCaptureController,
        checkForUpdates: @escaping () -> Void,
        updatesEnabled: Bool
    ) {
        self.store = store
        self.workspaceWindowController = workspaceWindowController
        self.miniDashboardWindowController = miniDashboardWindowController
        self.quickCaptureController = quickCaptureController
        self.checkForUpdates = checkForUpdates
        self.updatesEnabled = updatesEnabled
        super.init()

        quickCaptureController.onRequestPrepared = { [weak self] in
            self?.showQuickCapture()
        }
    }

    func start() {
        quickCaptureController.start()

        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        self.statusItem = statusItem
        guard let button = statusItem.button else { return }
        let image = NSImage(systemSymbolName: "checkmark.circle.fill", accessibilityDescription: "Todo Trackr")
        image?.isTemplate = true
        button.image = image
        button.toolTip = "Todo Trackr"
        button.target = self
        button.action = #selector(handleStatusItemClick(_:))
        button.sendAction(on: [.leftMouseUp, .rightMouseUp])
    }

    @objc private func handleStatusItemClick(_ sender: NSStatusBarButton) {
        let pointerEvent: MenuBarPointerEvent = NSApp.currentEvent?.type == .rightMouseUp
            ? .rightMouseUp
            : .leftMouseUp

        switch MenuBarClickBehavior.action(for: pointerEvent) {
        case .openWorkspace:
            openWorkspace()
        case .showMenu:
            showMenu(from: sender)
        }
    }

    private func openWorkspace() {
        workspaceWindowController.open()
    }

    private func showQuickCapture() {
        let window = quickCaptureWindow ?? makeQuickCaptureWindow()
        quickCaptureWindow = window
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func makeQuickCaptureWindow() -> NSWindow {
        let rootView = QuickCaptureView(
            controller: quickCaptureController,
            dismissCapture: { [weak self] in self?.quickCaptureWindow?.orderOut(nil) }
        )
        .environmentObject(store)
        .font(DesignTokens.sans(14))
        .preferredColorScheme(.dark)

        let hostingController = NSHostingController(rootView: rootView)
        let window = NSPanel(contentViewController: hostingController)
        window.title = "Quick Capture"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.styleMask = [.titled, .closable, .fullSizeContentView]
        AppWindowPresentation.prepareForTranslucency(window)
        window.isMovableByWindowBackground = true
        window.isReleasedWhenClosed = false
        window.setContentSize(hostingController.view.fittingSize)
        return window
    }

    private func showMenu(from button: NSStatusBarButton) {
        guard let statusItem else { return }
        rebuildMenu()
        statusItem.menu = menu
        button.performClick(nil)
        statusItem.menu = nil
    }

    private func rebuildMenu() {
        menu.removeAllItems()

        let quickCaptureItem = NSMenuItem(
            title: "Quick Capture…",
            action: #selector(openQuickCapture),
            keyEquivalent: "e"
        )
        quickCaptureItem.keyEquivalentModifierMask = [.command, .shift]
        quickCaptureItem.target = self
        menu.addItem(quickCaptureItem)

        addItem(title: "Open Todo Trackr", action: #selector(openWorkspaceFromMenu))
        addItem(title: "Open Mini Trackr", action: #selector(openMiniDashboard))
        menu.addItem(.separator())

        addInformationalItem(title: statusLabel)
        addInformationalItem(title: "\(store.tasks.filter { $0.status == .open }.count) open Tasks")
        menu.addItem(.separator())

        let updateItem = addItem(title: "Check for Updates…", action: #selector(checkForUpdatesFromMenu))
        updateItem.isEnabled = updatesEnabled

        if store.authenticationState == .signedIn {
            addItem(title: "Change Server / Sign Out…", action: #selector(signOut))
        }

        menu.addItem(.separator())
        let quitItem = addItem(title: "Quit Todo Trackr", action: #selector(quit))
        quitItem.keyEquivalent = "q"
        quitItem.keyEquivalentModifierMask = [.command]
    }

    @discardableResult
    private func addItem(title: String, action: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        menu.addItem(item)
        return item
    }

    private func addInformationalItem(title: String) {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.isEnabled = false
        menu.addItem(item)
    }

    private var statusLabel: String {
        switch store.authenticationState {
        case .checking: "Opening Todo Trackr…"
        case .signedOut: "Sign in required"
        case .signedIn:
            switch store.syncState {
            case .syncing: "Syncing…"
            case .synced: "Synced"
            case .error: "Offline"
            }
        }
    }

    @objc private func openQuickCapture() {
        quickCaptureController.prepareCapture()
    }

    @objc private func openWorkspaceFromMenu() {
        openWorkspace()
    }

    @objc private func openMiniDashboard() {
        miniDashboardWindowController.open()
    }

    @objc private func checkForUpdatesFromMenu() {
        checkForUpdates()
    }

    @objc private func signOut() {
        store.signOut()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
