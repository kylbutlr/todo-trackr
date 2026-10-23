import AppKit
import SwiftUI

@MainActor
final class WorkspaceWindowController {
    static let workspaceIdentifier = "todo-trackr.workspace"

    private var window: NSWindow?
    private weak var store: TaskStore?
    private let activateApplication: () -> Void
    private let makeWindow: (() -> NSWindow?)?

    init(
        store: TaskStore? = nil,
        activateApplication: @escaping () -> Void = {
            NSApp.activate(ignoringOtherApps: true)
        },
        makeWindow: (() -> NSWindow?)? = nil
    ) {
        self.store = store
        self.activateApplication = activateApplication
        self.makeWindow = makeWindow
    }

    var isVisible: Bool {
        window?.isVisible == true && window?.isMiniaturized == false
    }

    func register(_ window: NSWindow) {
        self.window = window
        window.identifier = NSUserInterfaceItemIdentifier(Self.workspaceIdentifier)
        configureWorkspaceWindow(window)
    }

    func open() {
        if window == nil {
            window = NSApp.windows.first(where: Self.isWorkspaceWindow)
        }
        if window == nil {
            window = makeWindow?() ?? makeWorkspaceWindow()
        }
        guard let window else { return }
        configureWorkspaceWindow(window)
        if window.isMiniaturized {
            window.deminiaturize(nil)
        }
        window.makeKeyAndOrderFront(nil)
        activateApplication()
        store?.taskSurfaceDidOpen()
    }

    private static func isWorkspaceWindow(_ window: NSWindow) -> Bool {
        window.identifier?.rawValue == Self.workspaceIdentifier || window.title == "Todo Trackr"
    }

    private func makeWorkspaceWindow() -> NSWindow? {
        guard let store else { return nil }

        let rootView = ContentView()
            .environmentObject(store)
            .font(DesignTokens.sans(14))
            .preferredColorScheme(.dark)
            .frame(minWidth: 380, minHeight: 620)
            .background(WorkspaceWindowReader(register: register))
        let hostingController = NSHostingController(rootView: rootView)
        let window = NSWindow(contentViewController: hostingController)
        window.title = "Todo Trackr"
        window.identifier = NSUserInterfaceItemIdentifier(Self.workspaceIdentifier)
        configureWorkspaceWindow(window)
        window.minSize = NSSize(width: 380, height: 620)
        window.setContentSize(NSSize(width: 1_120, height: 720))
        window.center()
        return window
    }

    private func configureWorkspaceWindow(_ window: NSWindow) {
        window.styleMask.remove(.borderless)
        window.styleMask.insert([.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView])
        window.titleVisibility = .visible
        window.titlebarAppearsTransparent = true
        window.standardWindowButton(.closeButton)?.isHidden = false
        window.standardWindowButton(.miniaturizeButton)?.isHidden = false
        window.standardWindowButton(.zoomButton)?.isHidden = false
        window.isReleasedWhenClosed = false
        AppWindowPresentation.prepareForTranslucency(window)
    }
}

struct WorkspaceWindowReader: NSViewRepresentable {
    let register: @MainActor (NSWindow) -> Void

    func makeNSView(context: Context) -> WindowObservationView {
        WindowObservationView(register: register)
    }

    func updateNSView(_ nsView: WindowObservationView, context: Context) {
        nsView.register = register
        nsView.resolveWindow()
    }

    final class WindowObservationView: NSView {
        var register: @MainActor (NSWindow) -> Void

        init(register: @escaping @MainActor (NSWindow) -> Void) {
            self.register = register
            super.init(frame: .zero)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            resolveWindow()
        }

        func resolveWindow() {
            guard let window else { return }
            MainActor.assumeIsolated {
                register(window)
            }
        }
    }
}
