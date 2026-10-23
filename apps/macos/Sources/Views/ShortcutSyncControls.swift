import SwiftUI

/// A layout sibling of the scrolling content, never an overlay on task rows.
struct MiniDashboardSyncFooter: View {
    @ObservedObject var schedule: ShortcutSyncSchedule
    var workSwitchStatus: String? = nil
    let isVisible: () -> Bool
    let sync: () async -> Void

    var body: some View {
        VStack(spacing: 0) {
            Rectangle().fill(DesignTokens.border).frame(height: 1)
            HStack(spacing: 10) {
                ShortcutSyncControls(schedule: schedule, isVisible: isVisible,
                                     isSignedIn: true, sync: sync)
                Spacer(minLength: 0)
                if let workSwitchStatus {
                    Text(workSwitchStatus)
                        .font(DesignTokens.sans(11))
                        .foregroundStyle(DesignTokens.textMuted)
                        .fixedSize()
                        .help(workSwitchStatus == "Switchr: Pending"
                              ? "Waiting for App Switchr confirmation or catch-up. If the service is unavailable, automatic work stays paused."
                              : workSwitchStatus == "Switchr: Off"
                              ? "Automatic work is paused. Manual sync is still available."
                              : "Automatic work is enabled.")
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 4)
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(DesignTokens.canvas)
    }
}

struct ShortcutSyncControls: View {
    @ObservedObject var schedule: ShortcutSyncSchedule
    let isVisible: () -> Bool
    let isSignedIn: Bool
    let sync: () async -> Void
    @State private var showsSettings = false

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            Button { showsSettings.toggle() } label: {
                Label(schedule.status(at: context.date, isVisible: isVisible(), isSignedIn: isSignedIn),
                      systemImage: schedule.isSyncing ? "arrow.triangle.2.circlepath" : "clock")
                    .font(DesignTokens.sans(11))
                    .monospacedDigit()
                    .foregroundStyle(DesignTokens.textMuted)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.plain)
            .help("Configure automatic Shortcut sync on this Mac")
        }
        .popover(isPresented: $showsSettings) {
            ShortcutSyncSettings(schedule: schedule, isVisible: isVisible,
                                 isSignedIn: isSignedIn, sync: sync)
        }
    }
}

struct ShortcutSyncSettings: View {
    @ObservedObject var schedule: ShortcutSyncSchedule
    let isVisible: () -> Bool
    let isSignedIn: Bool
    let sync: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Shortcut sync")
                .font(DesignTokens.sans(17, weight: .semibold))
            Text("Fetch fresh Shortcut changes while Todo Trackr or Mini Trackr is visible.")
                .foregroundStyle(DesignTokens.textMuted)
                .fixedSize(horizontal: false, vertical: true)
            Picker("Sync on this Mac", selection: Binding(
                get: { schedule.minutes }, set: { schedule.setMinutes($0) }
            )) {
                ForEach(ShortcutSyncSchedule.intervals, id: \.self) { minutes in
                    Text(minutes == 0 ? "Off" : "Every \(minutes) \(minutes == 1 ? "minute" : "minutes")")
                        .tag(minutes)
                }
            }
            .pickerStyle(.menu)
            TimelineView(.periodic(from: .now, by: 1)) { context in
                Text(schedule.status(at: context.date, isVisible: isVisible(), isSignedIn: isSignedIn))
                    .monospacedDigit()
            }
            if let last = schedule.lastSuccessAt {
                Text("Last Shortcut sync: \(last.formatted(date: .omitted, time: .standard))")
                    .foregroundStyle(DesignTokens.textMuted)
            }
            if case .ignored = schedule.outcome {
                Text("Shortcut did not sync. Select Automatic under Connections → Shortcut in the web app.")
                    .foregroundStyle(DesignTokens.warning)
            }
            if case let .failed(message) = schedule.outcome {
                Text("Shortcut sync failed: \(message)")
                    .foregroundStyle(DesignTokens.danger)
                    .textSelection(.enabled)
            }
            if schedule.minutes > 0 && schedule.minutes <= 5 {
                Text("Frequent syncs increase database and Shortcut API usage.")
                    .foregroundStyle(DesignTokens.warning)
            }
            Divider()
            Text("Task lists refresh on open and slow to every 10 minutes when unchanged. Webhooks and the server’s six-hour repair schedule are unchanged. This setting applies only to this Mac.")
                .foregroundStyle(DesignTokens.textMuted)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Link("Connection settings", destination: URL(string: "https://todotrackr.netlify.app/?view=connection:shortcut")!)
                Spacer()
                Button("Sync now") { Task { await sync() } }
                    .disabled(!isSignedIn || schedule.isSyncing)
            }
        }
        .font(DesignTokens.sans(12))
        .foregroundStyle(DesignTokens.text)
        .tint(DesignTokens.action)
        .padding(20)
        .frame(width: 350)
        .background(DesignTokens.surface)
        .preferredColorScheme(.dark)
    }
}
