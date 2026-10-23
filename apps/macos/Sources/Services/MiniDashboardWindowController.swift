import AppKit
import SwiftUI

@MainActor
final class MiniDashboardWindowController {
    static let alwaysOnTopDefaultsKey = "todo-trackr.mini-dashboard.always-on-top"
    static let frameAutosaveName = "TodoTrackrMiniDashboard"

    private let store: TaskStore?
    private let workspaceWindowController: WorkspaceWindowController?
    private let panelFactory: (() -> NSPanel)?
    private let activateApplication: () -> Void
    private let defaults: UserDefaults
    private var panel: NSPanel?

    init(
        store: TaskStore,
        workspaceWindowController: WorkspaceWindowController,
        defaults: UserDefaults = .standard,
        activateApplication: @escaping () -> Void = {
            NSApp.activate(ignoringOtherApps: true)
        }
    ) {
        self.store = store
        self.workspaceWindowController = workspaceWindowController
        panelFactory = nil
        self.defaults = defaults
        self.activateApplication = activateApplication
        registerDefaultPreference()
    }

    init(
        defaults: UserDefaults,
        panelFactory: @escaping () -> NSPanel,
        activateApplication: @escaping () -> Void = {}
    ) {
        store = nil
        workspaceWindowController = nil
        self.panelFactory = panelFactory
        self.defaults = defaults
        self.activateApplication = activateApplication
        registerDefaultPreference()
    }

    var isAlwaysOnTop: Bool {
        defaults.bool(forKey: Self.alwaysOnTopDefaultsKey)
    }

    var isVisible: Bool {
        panel?.isVisible == true && panel?.isMiniaturized == false
    }

    func open() {
        let panel = panel ?? makePanel()
        self.panel = panel
        applyWindowPresentation(to: panel)
        if panel.isMiniaturized {
            panel.deminiaturize(nil)
        }
        panel.makeKeyAndOrderFront(nil)
        activateApplication()
        store?.taskSurfaceDidOpen()
    }

    func toggleAlwaysOnTop() {
        defaults.set(!isAlwaysOnTop, forKey: Self.alwaysOnTopDefaultsKey)
        if let panel {
            applyWindowPresentation(to: panel)
        }
    }

    private func registerDefaultPreference() {
        defaults.register(defaults: [Self.alwaysOnTopDefaultsKey: true])
    }

    private func makePanel() -> NSPanel {
        if let panelFactory {
            return panelFactory()
        }

        guard let store, let workspaceWindowController else {
            preconditionFailure("Mini Trackr requires a TaskStore and workspace controller")
        }

        let rootView = MiniDashboardView(
            isAlwaysOnTop: isAlwaysOnTop,
            toggleAlwaysOnTop: { [weak self] in self?.toggleAlwaysOnTop() },
            openWorkspace: { workspaceWindowController.open() },
            openReviews: { summary in WebReviewLauncher.open(summary) },
            openTask: { [weak self] task in
                self?.defaults.set(WorkspaceMode.tasks.rawValue, forKey: "todo-trackr.workspace-mode")
                store.selectedTaskID = task.id
                store.selectedShortcutStoryReference = nil
                workspaceWindowController.open()
            },
            openShortcutStory: { [weak self] story in
                self?.defaults.set(WorkspaceMode.shortcut.rawValue, forKey: "todo-trackr.workspace-mode")
                store.selectedTaskID = nil
                store.selectedShortcutStoryReference = story.externalReference
                workspaceWindowController.open()
            }
        )
        .environmentObject(store)
        .font(DesignTokens.sans(14))
        .preferredColorScheme(.dark)

        let hostingController = NSHostingController(rootView: rootView)
        let panel = NSPanel(contentViewController: hostingController)
        panel.title = "Mini Trackr"
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.styleMask = [.titled, .closable, .resizable, .fullSizeContentView]
        installSyncStatusAccessory(on: panel, store: store)
        AppWindowPresentation.prepareForTranslucency(panel)
        panel.isMovableByWindowBackground = true
        panel.isReleasedWhenClosed = false
        panel.minSize = NSSize(width: 320, height: 360)
        panel.maxSize = NSSize(width: 520, height: 760)
        panel.setContentSize(NSSize(width: 360, height: 480))
        let restoredFrame = panel.setFrameUsingName(Self.frameAutosaveName)
        panel.setFrameAutosaveName(Self.frameAutosaveName)
        if !restoredFrame {
            panel.center()
        }

        return panel
    }

    private func installSyncStatusAccessory(on panel: NSPanel, store: TaskStore) {
        let statusView = MiniDashboardSyncStatusView()
            .environmentObject(store)
            .frame(width: 44, height: 28)
        let hostingView = NSHostingView(rootView: statusView)
        hostingView.frame = NSRect(x: 0, y: 0, width: 44, height: 28)

        let accessoryController = NSTitlebarAccessoryViewController()
        accessoryController.layoutAttribute = .right
        accessoryController.view = hostingView
        panel.addTitlebarAccessoryViewController(accessoryController)
    }

    private func applyWindowPresentation(to panel: NSPanel) {
        let alwaysOnTop = isAlwaysOnTop
        panel.level = alwaysOnTop ? .floating : .normal
        panel.isFloatingPanel = alwaysOnTop
        panel.collectionBehavior = alwaysOnTop
            ? [.canJoinAllSpaces, .fullScreenAuxiliary]
            : [.managed]
        panel.hidesOnDeactivate = false
    }
}
