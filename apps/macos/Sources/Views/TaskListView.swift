import SwiftUI

struct TaskListView: View {
    @EnvironmentObject private var store: TaskStore
    let view: TaskView
    @Binding var search: String
    @Binding var priority: PriorityFilter
    @Binding var due: DueFilter
    @Binding var sort: TaskSortMode
    var automaticallySelectFirstTask = true
    var isCompact = false
    @State private var newTaskTitle = ""

    private var tasks: [TaskItem] {
        store.tasks(for: view, search: search, priority: priority, due: due, sort: sort)
    }

    private var sections: [TaskListSection] {
        TaskGrouping.sections(for: tasks, view: view)
    }

    private var title: String {
        switch view {
        case let .smart(item): item.title
        case let .list(id): store.lists.first(where: { $0.id == id })?.name ?? "List"
        case let .source(source): source.label
        }
    }

    private var destinationListID: UUID {
        switch view {
        case let .list(id): id
        case .smart, .source: store.inboxID
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text("MY WORKSPACE")
                    .font(DesignTokens.sans(12, weight: .bold))
                    .tracking(1.1)
                    .foregroundStyle(DesignTokens.action)
                HStack(alignment: .firstTextBaseline) {
                    Text(title)
                        .font(DesignTokens.sans(32, weight: .bold))
                        .tracking(-0.64)
                        .foregroundStyle(DesignTokens.text)
                    Spacer()
                    Text("\(tasks.count) \(tasks.count == 1 ? "task" : "tasks")")
                        .font(DesignTokens.mono(12))
                        .foregroundStyle(DesignTokens.textMuted)
                }
            }
            .padding(.horizontal, isCompact ? 20 : 28)
            .padding(.top, isCompact ? 20 : 28)

            HStack(spacing: 10) {
                Image(systemName: "plus")
                    .foregroundStyle(DesignTokens.textMuted)
                TextField("Add a task", text: $newTaskTitle)
                    .textFieldStyle(.plain)
                    .foregroundStyle(DesignTokens.text)
                    .onSubmit(createTask)
                Button("Add", action: createTask)
                    .buttonStyle(.borderedProminent)
                    .tint(DesignTokens.action)
                    .foregroundStyle(DesignTokens.ink)
                    .controlSize(.large)
                    .disabled(newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .frame(minHeight: 44)
            .padding(8)
            .padding(.leading, 6)
            .background(DesignTokens.surface, in: RoundedRectangle(cornerRadius: 8))
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(DesignTokens.border)
            }
            .padding(isCompact ? 20 : 28)

            Group {
                if isCompact {
                    VStack(spacing: 8) {
                        searchField
                        HStack(spacing: 8) {
                            priorityPicker
                            duePicker
                        }
                        sortPicker
                    }
                } else {
                    HStack(spacing: 8) {
                        searchField
                        priorityPicker
                        duePicker
                        sortPicker
                    }
                }
            }
            .padding(.horizontal, isCompact ? 20 : 28)
            .padding(.bottom, 12)

            if tasks.isEmpty && !store.isLoading {
                ContentUnavailableView(
                    "Nothing here yet",
                    systemImage: "checkmark.circle",
                    description: Text("Add a task when something needs your attention.")
                )
                .frame(maxHeight: .infinity)
            } else {
                List {
                    ForEach(sections) { section in
                        Section {
                            ForEach(section.tasks) { task in
                                TaskListRow(task: task, isRecent: view == .smart(.recent))
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        store.selectedTaskID = task.id
                                    }
                                    .listRowBackground(
                                        task.isAlarmAttentionActive
                                            ? DesignTokens.danger.opacity(0.14)
                                            : store.selectedTaskID == task.id
                                                ? DesignTokens.selected
                                                : DesignTokens.surface
                                    )
                            }
                        } header: {
                            if let title = section.title {
                                HStack(spacing: 8) {
                                    Text(title)
                                        .foregroundStyle(sectionTitleColor(section.id))
                                    Rectangle()
                                        .fill(DesignTokens.border)
                                        .frame(height: 1)
                                    Text("\(section.tasks.count)")
                                        .font(DesignTokens.mono(10))
                                        .foregroundStyle(DesignTokens.textMuted)
                                }
                                .font(DesignTokens.sans(11, weight: .bold))
                            }
                        }
                    }
                }
                .listStyle(.inset)
                .scrollContentBackground(.hidden)
                .appSurfaceBackground(.canvas)
                .refreshable {
                    await ConnectionContext.$trigger.withValue(.manual) { await store.refresh() }
                }
            }
        }
        .appSurfaceBackground(.canvas)
        .navigationTitle(title)
        .onChange(of: tasks.map(\.id), initial: true) { _, ids in
            guard automaticallySelectFirstTask else {
                if let selectedTaskID = store.selectedTaskID, !ids.contains(selectedTaskID) {
                    store.selectedTaskID = nil
                }
                return
            }
            if store.selectedTaskID == nil || !ids.contains(store.selectedTaskID!) {
                store.selectedTaskID = ids.first
            }
        }
    }

    private var searchField: some View {
        TextField("Search tasks", text: $search)
            .textFieldStyle(.roundedBorder)
    }

    private var priorityPicker: some View {
        Picker("Priority", selection: $priority) {
            ForEach(PriorityFilter.allCases) { item in Text(item.title).tag(item) }
        }
        .pickerStyle(.menu)
        .frame(maxWidth: .infinity)
    }

    private var duePicker: some View {
        Picker("Due", selection: $due) {
            ForEach(DueFilter.allCases) { item in Text(item.title).tag(item) }
        }
        .pickerStyle(.menu)
        .frame(maxWidth: .infinity)
    }

    private var sortPicker: some View {
        Picker("Sort", selection: $sort) {
            ForEach(TaskSortMode.allCases) { item in Text(item.title).tag(item) }
        }
        .pickerStyle(.menu)
        .frame(maxWidth: .infinity)
    }

    private func sectionTitleColor(_ sectionID: String) -> Color {
        switch sectionID {
        case "overdue": DesignTokens.danger
        case "today": DesignTokens.warning
        default: DesignTokens.textMuted
        }
    }

    private func createTask() {
        let title = newTaskTitle
        newTaskTitle = ""
        Task {
            await store.createTask(title: title, listId: destinationListID)
        }
    }
}

private struct TaskListRow: View {
    @EnvironmentObject private var store: TaskStore
    @State private var isHovering = false
    let task: TaskItem
    var isRecent = false

    private var completionFeedbackPhase: TaskStore.CompletionFeedbackPhase? {
        store.completionFeedback[task.id]
    }

    private var visuallyCompleted: Bool {
        task.status == .completed || completionFeedbackPhase != nil
    }

    private var backgroundReleaseIsDimmed: Bool {
        task.isBackgroundRelease && store.selectedTaskID != task.id && !isHovering
    }

    private var leadingColumnWidth: CGFloat {
        task.source == .shortcut ? 46 : 24
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 11) {
                VStack(spacing: 2) {
                    if task.source == .shortcut {
                        shortcutSourceIndicator
                    } else {
                        Button {
                            Task { await store.toggle(task) }
                        } label: {
                            Image(systemName: visuallyCompleted ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(visuallyCompleted ? DesignTokens.action : DesignTokens.textMuted)
                                .symbolEffect(.bounce, value: visuallyCompleted)
                                .frame(width: 24, height: 24)
                        }
                        .buttonStyle(.plain)
                        .disabled(task.status == .archived || completionFeedbackPhase != nil)
                    }
                }
                .frame(width: leadingColumnWidth)

                Text(task.title)
                    .strikethrough(visuallyCompleted)
                    .foregroundStyle(
                        visuallyCompleted || backgroundReleaseIsDimmed
                            ? DesignTokens.textMuted
                            : DesignTokens.text
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)

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
            }

            HStack(spacing: 6) {
                if let reference = task.sourceDetails?.externalReference, task.source == .shortcut {
                    Text(reference)
                        .font(DesignTokens.mono(10))
                        .foregroundStyle(DesignTokens.textMuted)
                        .lineLimit(1)
                        .frame(width: leadingColumnWidth, alignment: .center)
                } else {
                    Color.clear.frame(width: leadingColumnWidth)
                }
                HStack(spacing: 6) {
                    if task.isAlarmAttentionActive {
                        Label("Needs Attention", systemImage: "bell.badge.fill")
                            .font(DesignTokens.mono(11, weight: .bold))
                            .foregroundStyle(DesignTokens.danger)
                    }
                    if task.source == .shortcut {
                        shortcutMetadata
                    } else if task.source == .granola || task.source == .browser || task.source == .slack {
                        Label(task.source.label, systemImage: sourceSystemImage)
                            .font(DesignTokens.mono(11))
                            .foregroundStyle(backgroundReleaseIsDimmed ? DesignTokens.textMuted : DesignTokens.action)
                    }
                    if task.priority == .none {
                        Circle()
                            .stroke(DesignTokens.textMuted, lineWidth: 1)
                            .frame(width: 7, height: 7)
                    } else {
                        Circle()
                            .fill(priorityColor)
                            .frame(width: 7, height: 7)
                    }
                    Text(task.priority.label)
                        .font(DesignTokens.mono(12))
                        .foregroundStyle(task.priority == .none ? DesignTokens.textMuted : priorityColor)
                    if isRecent {
                        Text(store.lists.first(where: { $0.id == task.listId })?.name ?? "Inbox")
                            .font(DesignTokens.mono(12))
                            .foregroundStyle(DesignTokens.textMuted)
                        Text(task.createdAt.formatted(date: .omitted, time: .shortened))
                            .font(DesignTokens.mono(12))
                            .foregroundStyle(DesignTokens.textMuted)
                    } else if task.source != .shortcut {
                        Text(task.dueAt?.formatted(.dateTime.month(.abbreviated).day()) ?? "No due date")
                            .font(DesignTokens.mono(12))
                            .foregroundStyle(DesignTokens.textMuted)
                    }
                    Spacer(minLength: 0)
                    if task.source == .shortcut {
                        ShortcutStateDueLabel(
                            workflowStateName: task.sourceDetails?.workflowStateName,
                            dueDate: task.dueAt,
                            fontSize: 12
                        )
                        .layoutPriority(1)
                    }
                }
            }
        }
        .padding(.vertical, 6)
        .opacity(completionFeedbackPhase == .exiting ? 0 : 1)
        .scaleEffect(completionFeedbackPhase == .exiting ? 0.985 : 1)
        .animation(.easeInOut(duration: 0.22), value: completionFeedbackPhase)
        .animation(.easeOut(duration: 0.16), value: backgroundReleaseIsDimmed)
        .onHover { isHovering = $0 }
    }

    private var priorityColor: Color {
        if backgroundReleaseIsDimmed { return DesignTokens.textMuted }
        return switch task.priority {
        case .none: .clear
        case .lowest: DesignTokens.priorityLowest
        case .low: DesignTokens.success
        case .medium: DesignTokens.warning
        case .high: DesignTokens.danger
        case .highest: DesignTokens.priorityHighest
        }
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

    private var shortcutMetadata: some View {
        HStack(spacing: 4) {
            Image(systemName: "link")
            if let epicName = task.sourceDetails?.epicName {
                Text(epicName)
                    .lineLimit(1)
            }
        }
        .font(DesignTokens.mono(11))
        .foregroundStyle(backgroundReleaseIsDimmed ? DesignTokens.textMuted : DesignTokens.action)
        .help(task.sourceDetails?.epicName.map { "Shortcut Epic: \($0)" } ?? "Shortcut")
        .accessibilityLabel(task.sourceDetails?.epicName.map { "Shortcut Epic \($0)" } ?? "Shortcut")
    }

    private var shortcutSourceLabel: String {
        if let reference = task.sourceDetails?.externalReference {
            return "Open SC-\(reference) in Shortcut"
        }
        return "Open source in Shortcut"
    }

    @ViewBuilder
    private var shortcutSourceIndicator: some View {
        if let sourceURL = task.sourceUrl {
            Link(destination: sourceURL) {
                shortcutSourceIcon
            }
            .buttonStyle(.plain)
            .help(shortcutSourceLabel)
            .accessibilityLabel(shortcutSourceLabel)
        } else {
            shortcutSourceIcon
                .help("Completion follows Shortcut")
                .accessibilityLabel("Completion follows Shortcut")
        }
    }

    private var shortcutSourceIcon: some View {
        Image(systemName: "link")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(backgroundReleaseIsDimmed ? DesignTokens.textMuted : DesignTokens.action)
            .frame(width: 24, height: 24)
            .background(DesignTokens.selected, in: RoundedRectangle(cornerRadius: 7))
            .overlay {
                RoundedRectangle(cornerRadius: 7)
                    .stroke(backgroundReleaseIsDimmed ? DesignTokens.border : DesignTokens.borderStrong)
            }
            .opacity(backgroundReleaseIsDimmed ? 0.58 : 1)
    }
}
