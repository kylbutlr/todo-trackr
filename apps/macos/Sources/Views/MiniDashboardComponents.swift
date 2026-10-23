import SwiftUI

struct MiniDashboardSyncStatusView: View {
    @EnvironmentObject private var store: TaskStore

    var body: some View {
        Circle()
            .fill(syncColor)
            .frame(width: 7, height: 7)
            .shadow(color: syncColor.opacity(0.7), radius: store.syncState == .synced ? 5 : 2)
            .help(syncLabel)
            .accessibilityLabel("Sync status: \(syncLabel)")
    }

    private var syncLabel: String {
        switch store.syncState {
        case .syncing: "Syncing"
        case .synced: "Synced"
        case .error: "Offline"
        }
    }

    private var syncColor: Color {
        switch store.syncState {
        case .syncing: DesignTokens.sage
        case .synced: DesignTokens.action
        case .error: DesignTokens.danger
        }
    }
}
enum MiniDashboardLayer {
    static let timeline = 0.0
    static let quickAdd = 10.0
}

enum MiniDashboardMotion {
    static let quickAdd = Animation.spring(response: 0.28, dampingFraction: 0.82)
}

struct MiniDashboardSectionHeader: View {
    let id: String
    let title: String
    let count: Int

    var body: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(DesignTokens.sans(11, weight: .bold))
                .foregroundStyle(titleColor)
            Rectangle()
                .fill(DesignTokens.border)
                .frame(height: 1)
            Text("\(count)")
                .font(DesignTokens.mono(9))
                .foregroundStyle(DesignTokens.textMuted)
        }
        .padding(.horizontal, 2)
        .padding(.top, 6)
        .padding(.bottom, 2)
        // Pinned headers cover moving rows, even when the window is translucent.
        .background(DesignTokens.canvas)
    }

    private var titleColor: Color {
        switch id {
        case "overdue": DesignTokens.danger
        case "today": DesignTokens.warning
        default: DesignTokens.textMuted
        }
    }
}

private struct ShortcutMetadataLabel: View {
    let epicName: String?
    let fontSize: CGFloat
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "link")
            if let epicName {
                Text(epicName)
                    .lineLimit(1)
            }
        }
        .font(DesignTokens.mono(fontSize))
        .foregroundStyle(color)
        .help(epicName.map { "Shortcut Epic: \($0)" } ?? "Shortcut")
        .accessibilityLabel(epicName.map { "Shortcut Epic \($0)" } ?? "Shortcut")
    }
}

struct MiniShortcutMetadataLines: View {
    let reference: String?
    let epicName: String?
    let priority: TaskPriority
    let workflowStateName: String?
    let dueDate: Date?
    let epicColor: Color
    let priorityColor: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                if let reference {
                    Text(reference)
                        .font(DesignTokens.mono(9))
                        .foregroundStyle(DesignTokens.textMuted)
                        .lineLimit(1)
                        .frame(width: 42, alignment: .center)
                } else {
                    Color.clear.frame(width: 42)
                }
                ShortcutMetadataLabel(epicName: epicName, fontSize: 9, color: epicColor)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 6) {
                Color.clear.frame(width: 42)
                Circle()
                    .fill(priority == .none ? DesignTokens.textMuted : priorityColor)
                    .frame(width: 6, height: 6)
                Text(priority == .none ? "None" : priority.label)
                    .font(DesignTokens.mono(10))
                    .foregroundStyle(priority == .none ? DesignTokens.textMuted : priorityColor)
                    .fixedSize(horizontal: true, vertical: false)
                ShortcutStateDueLabel(
                    workflowStateName: workflowStateName,
                    dueDate: dueDate,
                    fontSize: 10,
                    dueDateStyle: .numeric
                )
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }
}

struct MiniShortcutBoardRow: View {
    @EnvironmentObject private var store: TaskStore
    @State private var isHovering = false

    let story: ShortcutBoardStory
    let openStory: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 9) {
                VStack(spacing: 2) {
                    Link(destination: story.sourceUrl) {
                        shortcutSourceIcon
                    }
                    .buttonStyle(.plain)
                    .help("Open SC-\(story.externalReference) in Shortcut")
                }
                .frame(width: 42)

                Button(action: openStory) {
                    Text(story.title)
                        .font(DesignTokens.sans(13, weight: .medium))
                        .foregroundStyle(DesignTokens.text)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button {
                    Task { await store.toggleShortcutBoardStar(story) }
                } label: {
                    Image(systemName: story.isStarred ? "star.fill" : "star")
                        .foregroundStyle(story.isStarred ? DesignTokens.warning : DesignTokens.textMuted)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
                .help(story.isStarred ? "Remove from Starred" : "Add to Starred")
            }

            MiniShortcutMetadataLines(
                reference: story.externalReference,
                epicName: story.epicName,
                priority: story.priority,
                workflowStateName: story.workflowStateName,
                dueDate: story.parsedDueDate,
                epicColor: DesignTokens.action,
                priorityColor: priorityColor
            )
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(isHovering ? DesignTokens.selected : DesignTokens.surface, in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(isHovering ? DesignTokens.borderStrong : DesignTokens.border)
        }
        .onHover { isHovering = $0 }
    }

    private var shortcutSourceIcon: some View {
        Image(systemName: "link")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(DesignTokens.action)
            .frame(width: 24, height: 24)
            .background(DesignTokens.selected, in: RoundedRectangle(cornerRadius: 7))
    }

    private var priorityColor: Color {
        switch story.priority {
        case .none, .lowest: DesignTokens.textMuted
        case .low: DesignTokens.success
        case .medium: DesignTokens.warning
        case .high, .highest: DesignTokens.danger
        }
    }
}

struct MiniDashboardTaskRow: View {
    @EnvironmentObject private var store: TaskStore
    @State private var isHovering = false

    let task: TaskItem
    let openTask: () -> Void

    private var completionFeedbackPhase: TaskStore.CompletionFeedbackPhase? {
        store.completionFeedback[task.id]
    }

    private var visuallyCompleted: Bool {
        task.status == .completed || completionFeedbackPhase != nil
    }

    private var isDimmed: Bool {
        task.isBackgroundRelease && !isHovering
    }

    private var leadingColumnWidth: CGFloat {
        task.source == .shortcut ? 42 : 24
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 9) {
                VStack(spacing: 2) {
                    completionControl
                }
                .frame(width: leadingColumnWidth)

                Button(action: openTask) {
                    Text(task.title)
                        .font(DesignTokens.sans(13, weight: .medium))
                        .foregroundStyle(isDimmed ? DesignTokens.textMuted : DesignTokens.text)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                HStack(spacing: 4) {
                    Button {
                        Task { await store.toggleStar(task) }
                    } label: {
                        Image(systemName: task.isStarred ? "star.fill" : "star")
                            .foregroundStyle(task.isStarred ? DesignTokens.warning : DesignTokens.textMuted)
                            .frame(width: 24, height: 24)
                    }
                    .buttonStyle(.plain)
                    .help(task.isStarred ? "Remove from Starred" : "Add to Starred")
                    .accessibilityLabel(task.isStarred ? "Remove from Starred" : "Add to Starred")

                    MiniTaskAlarmControl(task: task)
                }
            }

            if task.source == .shortcut {
                MiniShortcutMetadataLines(
                    reference: task.sourceDetails?.externalReference,
                    epicName: task.sourceDetails?.epicName,
                    priority: task.priority,
                    workflowStateName: task.sourceDetails?.workflowStateName,
                    dueDate: task.dueAt,
                    epicColor: isDimmed ? DesignTokens.textMuted : DesignTokens.action,
                    priorityColor: priorityColor
                )
            } else {
                HStack(spacing: 6) {
                    Color.clear.frame(width: leadingColumnWidth)
                    if task.source != .manual {
                        Label(task.source.label, systemImage: sourceSystemImage)
                            .font(DesignTokens.mono(9))
                            .foregroundStyle(isDimmed ? DesignTokens.textMuted : DesignTokens.action)
                    }
                    Circle()
                        .fill(task.priority == .none ? DesignTokens.textMuted : priorityColor)
                        .frame(width: 6, height: 6)
                    Text(task.priority.label)
                        .font(DesignTokens.mono(10))
                        .foregroundStyle(task.priority == .none ? DesignTokens.textMuted : priorityColor)
                    Spacer(minLength: 2)
                    Text(task.dueAt?.formatted(.dateTime.month(.abbreviated).day()) ?? "No date")
                        .font(DesignTokens.mono(10))
                        .foregroundStyle(DesignTokens.textMuted)
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(rowBackground, in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(task.isAlarmAttentionActive ? DesignTokens.danger : isHovering ? DesignTokens.borderStrong : DesignTokens.border)
        }
        .opacity(completionFeedbackPhase == .exiting ? 0 : 1)
        .scaleEffect(completionFeedbackPhase == .exiting ? 0.985 : 1)
        .animation(.easeInOut(duration: 0.22), value: completionFeedbackPhase)
        .animation(.easeOut(duration: 0.16), value: isDimmed)
        .onHover { isHovering = $0 }
    }

    @ViewBuilder
    private var completionControl: some View {
        if task.source == .shortcut {
            if let sourceURL = task.sourceUrl {
                Link(destination: sourceURL) {
                    sourceIcon
                }
                .buttonStyle(.plain)
                .help("Open in Shortcut")
                .accessibilityLabel("Open in Shortcut")
            } else {
                sourceIcon
                    .help("Completion follows Shortcut")
                    .accessibilityLabel("Completion follows Shortcut")
            }
        } else {
            Button {
                Task { await store.toggle(task) }
            } label: {
                Image(systemName: visuallyCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(visuallyCompleted ? DesignTokens.action : DesignTokens.textMuted)
                    .frame(width: 24, height: 24)
                    .symbolEffect(.bounce, value: visuallyCompleted)
            }
            .buttonStyle(.plain)
            .disabled(completionFeedbackPhase != nil)
            .help("Complete task")
            .accessibilityLabel("Complete task")
        }
    }

    private var sourceIcon: some View {
        Image(systemName: "link")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(isDimmed ? DesignTokens.textMuted : DesignTokens.action)
            .frame(width: 24, height: 24)
            .background(DesignTokens.selected, in: RoundedRectangle(cornerRadius: 7))
    }

    private var sourceSystemImage: String {
        switch task.source {
        case .shortcut: "link"
        case .granola: "waveform"
        case .browser: "globe"
        case .slack: "bubble.left.and.bubble.right"
        case .manual, .gmail: "square.and.pencil"
        }
    }

    private var priorityColor: Color {
        if isDimmed { return DesignTokens.textMuted }
        return switch task.priority {
        case .none: DesignTokens.textMuted
        case .lowest: DesignTokens.priorityLowest
        case .low: DesignTokens.success
        case .medium: DesignTokens.warning
        case .high: DesignTokens.danger
        case .highest: DesignTokens.priorityHighest
        }
    }

    private var rowBackground: Color {
        if task.isAlarmAttentionActive { return DesignTokens.danger.opacity(0.14) }
        return isHovering ? DesignTokens.selected : DesignTokens.surface
    }
}

private struct MiniTaskAlarmControl: View {
    @EnvironmentObject private var store: TaskStore
    @State private var isPresented = false
    @State private var alarmDate = Date.now.addingTimeInterval(60 * 60)

    let task: TaskItem

    private var hasScheduledAlarm: Bool {
        task.alarmAt != nil && task.alarmClearedAt == nil
    }

    var body: some View {
        Button {
            alarmDate = hasScheduledAlarm
                ? task.alarmAt ?? Date.now.addingTimeInterval(60 * 60)
                : Date.now.addingTimeInterval(60 * 60)
            isPresented = true
        } label: {
            Image(systemName: task.isAlarmAttentionActive ? "bell.badge.fill" : hasScheduledAlarm ? "bell.fill" : "bell")
                .foregroundStyle(task.isAlarmAttentionActive ? DesignTokens.danger : hasScheduledAlarm ? DesignTokens.warning : DesignTokens.textMuted)
                .frame(width: 24, height: 24)
                .symbolEffect(.pulse, options: .repeating, isActive: task.isAlarmAttentionActive)
        }
        .buttonStyle(.plain)
        .help(task.isAlarmAttentionActive ? "Needs Attention. Clear or reschedule alarm" : hasScheduledAlarm ? "Edit Attention Alarm" : "Set Attention Alarm")
        .accessibilityLabel(task.isAlarmAttentionActive ? "Task needs attention" : hasScheduledAlarm ? "Edit Attention Alarm" : "Set Attention Alarm")
        .popover(isPresented: $isPresented, arrowEdge: .trailing) {
            VStack(alignment: .leading, spacing: 12) {
                if task.isAlarmAttentionActive {
                    Label("Needs Attention", systemImage: "bell.badge.fill")
                        .font(DesignTokens.sans(13, weight: .bold))
                        .foregroundStyle(DesignTokens.danger)
                    Text("Clear the alarm when this Task no longer needs immediate attention.")
                        .font(DesignTokens.sans(11))
                        .foregroundStyle(DesignTokens.textMuted)
                    Button("Clear Alarm") {
                        isPresented = false
                        Task { await store.clearAlarm(task) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(DesignTokens.danger)
                } else {
                    Text("Attention Alarm")
                        .font(DesignTokens.sans(13, weight: .bold))
                    DatePicker("Remind me", selection: $alarmDate)
                    HStack {
                        if hasScheduledAlarm {
                            Button("Remove") {
                                isPresented = false
                                Task { await store.clearAlarm(task) }
                            }
                        }
                        Spacer()
                        Button("Set Alarm") {
                            isPresented = false
                            Task { await store.setAlarm(task, at: alarmDate) }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(DesignTokens.action)
                    }
                }
            }
            .padding(14)
            .frame(width: 280)
            .appSurfaceBackground(.surfaceRaised)
        }
    }
}
