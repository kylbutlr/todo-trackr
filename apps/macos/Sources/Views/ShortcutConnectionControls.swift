import AppKit
import SwiftUI

/// Reuse a real native window rather than a toolbar-anchored popover.
@MainActor enum ShortcutConnectionWindow {
    private static var window: NSWindow?
    static func show() {
        if window == nil {
            let host = NSHostingController(rootView: ShortcutConnectionControls().preferredColorScheme(.dark))
            let next = NSWindow(contentViewController: host)
            next.title = "Shortcut connection"
            next.styleMask = [.titled, .closable]
            next.isReleasedWhenClosed = false
            next.setContentSize(NSSize(width: 390, height: 300))
            next.center()
            window = next
        }
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

/// Optional, explicit app-owned connection control. No reads on required startup.
struct ShortcutConnectionControls: View {
    @State private var connection: ShortcutConnectionControl?
    @State private var server: String?
    @State private var busy = false
    @State private var attemptedWrite = false
    @State private var message: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Shortcut connection").font(DesignTokens.sans(17, weight: .semibold))
            if let server { Text(server).foregroundStyle(DesignTokens.textMuted) }
            Text(connection.map { "Hosted Shortcut: \($0.controlMode.capitalized)" } ?? "Checking connection")
                .accessibilityIdentifier("shortcut-hosted-mode")
            Text("Off pauses Shortcut processing on the server. Existing Tasks, history, stars and alarms stay saved.")
                .foregroundStyle(DesignTokens.textMuted).fixedSize(horizontal: false, vertical: true)
            if let message { Text(message).foregroundStyle(DesignTokens.textMuted).textSelection(.enabled) }
            HStack {
                Button("Reload status") { Task { await load() } }.disabled(busy)
                Spacer()
                Button("Turn Shortcut Off") { Task { await turnOff() } }
                    .disabled(busy || attemptedWrite || connection == nil || connection?.isOff == true)
                    .accessibilityIdentifier("shortcut-hosted-off")
            }
        }
        .font(DesignTokens.sans(12)).foregroundStyle(DesignTokens.text)
        .padding(20).frame(width: 350).background(DesignTokens.surface)
        .task { await load() }
    }

    @MainActor private func load() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        server = await APIClient.shared.shortcutSettingsURL().host
        do {
            connection = try await APIClient.shared.shortcutConnectionControl()
            attemptedWrite = false
            message = connection?.isOff == true ? "Confirmed Off. Existing Tasks and history are preserved." : nil
        } catch { message = "Connection status could not be verified. No changes were requested." }
    }

    @MainActor private func turnOff() async {
        guard !busy, !attemptedWrite, connection != nil, connection?.isOff == false else { return }
        busy = true; attemptedWrite = true; defer { busy = false }
        do {
            connection = try await APIClient.shared.turnOffShortcutConnection()
            message = "Confirmed Off. Existing Tasks and history are preserved."
        } catch {
            message = "The Off request could not be confirmed. Reload status before another action. No automatic retry was made."
        }
    }
}
