import SwiftUI

enum ShortcutMetadataLabels {
    static func workflowState(_ value: String?) -> String {
        guard let state = value?.trimmingCharacters(in: .whitespacesAndNewlines), !state.isEmpty else {
            return "N/A"
        }
        return state
    }

    static func dueDate(_ value: Date?) -> String {
        value?.formatted(.dateTime.month(.abbreviated).day()) ?? "N/A"
    }

    static func numericDueDate(_ value: Date?) -> String {
        guard let value else { return "N/A" }
        let components = Calendar.current.dateComponents([.month, .day], from: value)
        guard let month = components.month, let day = components.day else { return "N/A" }
        return "\(month)/\(day)"
    }

    static func stateAndDueDate(_ state: String?, _ date: Date?) -> String {
        "\(workflowState(state)) | \(dueDate(date))"
    }
}

enum ShortcutDueDateStyle: Equatable {
    case abbreviated
    case numeric
}

struct ShortcutStateDueLabel: View {
    let workflowStateName: String?
    let dueDate: Date?
    let fontSize: CGFloat
    var dueDateStyle: ShortcutDueDateStyle = .abbreviated

    private var stateLabel: String { ShortcutMetadataLabels.workflowState(workflowStateName) }
    private var dateLabel: String {
        dueDateStyle == .numeric
            ? ShortcutMetadataLabels.numericDueDate(dueDate)
            : ShortcutMetadataLabels.dueDate(dueDate)
    }

    var body: some View {
        HStack(spacing: 4) {
            Text(stateLabel)
                .font(DesignTokens.mono(fontSize - 1))
                .lineLimit(1)
                .truncationMode(.tail)
            Text("|")
                .font(DesignTokens.mono(fontSize))
                .accessibilityHidden(true)
            Text(dateLabel)
                .font(DesignTokens.mono(fontSize))
                .fixedSize(horizontal: true, vertical: false)
        }
        .foregroundStyle(DesignTokens.textMuted)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Shortcut workflow state \(stateLabel), due date \(dueDate == nil ? "not set" : dateLabel)")
        .help("Shortcut workflow state: \(stateLabel); due date: \(dateLabel)")
    }
}
