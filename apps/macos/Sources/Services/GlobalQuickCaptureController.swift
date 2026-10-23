import Carbon.HIToolbox
import Foundation

struct QuickCaptureRequest: Equatable, Sendable {
    let id: UUID
    let suggestedTitle: String
    let needsAccessibilityPermission: Bool
    let errorMessage: String?
    let source: TaskSource
    let sourceApplicationName: String?
}

@MainActor
final class GlobalQuickCaptureController: ObservableObject {
    @Published private(set) var request: QuickCaptureRequest?
    var onRequestPrepared: (() -> Void)?

    private var eventHandler: EventHandlerRef?
    private var hotKey: EventHotKeyRef?
    private var started = false

    func start() {
        guard !started else { return }
        started = true

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )
        let userData = Unmanaged.passUnretained(self).toOpaque()
        InstallEventHandler(
            GetApplicationEventTarget(),
            todoTrackrHotKeyHandler,
            1,
            &eventType,
            userData,
            &eventHandler
        )

        let hotKeyID = EventHotKeyID(signature: fourCharacterCode("TDTR"), id: 1)
        RegisterEventHotKey(
            UInt32(kVK_ANSI_E),
            UInt32(cmdKey | shiftKey),
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKey
        )
    }

    func prepareCapture() {
        prepareCapture(from: SelectedTextReader.capture())
    }

    func prepareCapture(from snapshot: SelectedTextSnapshot) {
        request = QuickCaptureRequest(
            id: UUID(),
            suggestedTitle: snapshot.selectedText ?? "",
            needsAccessibilityPermission: snapshot.needsAccessibilityPermission,
            errorMessage: nil,
            source: Self.taskSource(
                forBundleIdentifier: snapshot.sourceApplicationBundleIdentifier
            ),
            sourceApplicationName: snapshot.sourceApplicationName
        )
        onRequestPrepared?()
    }

    func reportFailure(title: String, message: String) {
        let previousRequest = request
        request = QuickCaptureRequest(
            id: UUID(),
            suggestedTitle: title,
            needsAccessibilityPermission: false,
            errorMessage: message,
            source: previousRequest?.source ?? .manual,
            sourceApplicationName: previousRequest?.sourceApplicationName
        )
        onRequestPrepared?()
    }

    nonisolated static func taskSource(forBundleIdentifier bundleIdentifier: String?) -> TaskSource {
        bundleIdentifier?.lowercased() == "com.tinyspeck.slackmacgap" ? .slack : .manual
    }
}

private let todoTrackrHotKeyHandler: EventHandlerUPP = { _, _, userData in
    guard let userData else { return OSStatus(eventNotHandledErr) }
    let controller = Unmanaged<GlobalQuickCaptureController>
        .fromOpaque(userData)
        .takeUnretainedValue()
    // Read the source application's selection synchronously, before opening
    // Todo Trackr can move focus away from Slack or another source app.
    let snapshot = SelectedTextReader.capture()
    Task { @MainActor in controller.prepareCapture(from: snapshot) }
    return noErr
}

private func fourCharacterCode(_ value: String) -> OSType {
    value.utf8.reduce(0) { ($0 << 8) + OSType($1) }
}
