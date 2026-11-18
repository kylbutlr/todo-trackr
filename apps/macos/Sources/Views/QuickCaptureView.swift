import AppKit
import SwiftUI

struct QuickCaptureView: View {
    @EnvironmentObject private var store: TaskStore
    @ObservedObject var controller: GlobalQuickCaptureController
    let dismissCapture: () -> Void
    @FocusState private var titleFocused: Bool
    @State private var title = ""

    var body: some View {
        ZStack {
            AppWindowBackground()

            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(DesignTokens.action)
                    Text("Quick Capture")
                        .font(DesignTokens.sans(17, weight: .semibold))
                    Spacer()
                    Text("⌘⇧E")
                        .font(DesignTokens.mono(11))
                        .foregroundStyle(DesignTokens.textMuted)
                }

                TextField("What needs doing?", text: $title)
                    .textFieldStyle(.roundedBorder)
                    .font(DesignTokens.sans(15))
                    .focused($titleFocused)
                    .onSubmit(submit)

                if let errorMessage = controller.request?.errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(DesignTokens.danger)
                        .font(DesignTokens.sans(12))
                }

                if controller.request?.needsAccessibilityPermission == true {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Allow Accessibility access to capture selected text from Slack and other apps.")
                            .foregroundStyle(DesignTokens.textMuted)
                            .font(DesignTokens.sans(12))
                        Button("Open Accessibility Settings") {
                            guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") else { return }
                            NSWorkspace.shared.open(url)
                        }
                        .buttonStyle(.link)
                    }
                } else if title.isEmpty {
                    Text("Select text in any app before pressing ⌘⇧E, or type a Task title here.")
                        .foregroundStyle(DesignTokens.textMuted)
                        .font(DesignTokens.sans(12))
                }

                HStack {
                    Text(destinationLabel)
                        .font(DesignTokens.mono(11))
                        .foregroundStyle(DesignTokens.textMuted)
                    Spacer()
                    Button("Cancel", role: .cancel, action: dismissCapture)
                        .keyboardShortcut(.cancelAction)
                    Button("Add Task") { submit() }
                        .buttonStyle(.borderedProminent)
                        .tint(DesignTokens.action)
                        .foregroundStyle(DesignTokens.ink)
                        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .keyboardShortcut(.defaultAction)
                }
            }
            .padding(22)
        }
        .frame(width: 440)
        .onAppear { prepare() }
        .onChange(of: controller.request?.id) { _, _ in prepare() }
    }

    private func prepare() {
        title = controller.request?.suggestedTitle ?? ""
        titleFocused = true
    }

    private func submit() {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        dismissCapture()

        guard store.authenticationState == .signedIn else {
            controller.reportFailure(
                title: trimmed,
                message: "Open Todo Trackr and sign in before using Quick Capture."
            )
            return
        }

        let request = controller.request
        Task {
            let created = await store.createTask(
                title: trimmed,
                source: request?.source ?? .manual
            )
            if !created {
                controller.reportFailure(
                    title: trimmed,
                    message: store.errorMessage ?? "Todo Trackr could not add this Task."
                )
            }
        }
    }

    private var destinationLabel: String {
        guard let request = controller.request, request.source != .manual else {
            return "Adds to Inbox"
        }
        return "Adds to Inbox from \(request.source.label)"
    }
}
