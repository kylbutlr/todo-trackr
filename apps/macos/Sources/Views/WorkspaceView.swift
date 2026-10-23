import SwiftUI

struct WorkspaceView: View {
    @EnvironmentObject private var store: TaskStore
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("todo-trackr.workspace-layout") private var workspaceLayoutRaw = WorkspaceLayoutMode.standard.rawValue
    @AppStorage("todo-trackr.workspace-mode") private var workspaceModeRaw = WorkspaceMode.tasks.rawValue
    @State private var view: TaskView? = .smart(.inbox)
    @State private var newListName = ""
    @State private var search = ""
    @State private var priority: PriorityFilter = .any
    @State private var due: DueFilter = .any
    @State private var sort: TaskSortMode = .smart
    @State private var isShowingAppearanceControls = false

    var body: some View {
        Group {
            if workspaceLayout == .compact {
                compactWorkspace
            } else {
                standardWorkspace
            }
        }
        .tint(DesignTokens.action)
        .toolbar {
            ToolbarItem(placement: .status) {
                if store.installation.integrations.shortcut { ShortcutSyncControls(schedule: store.shortcutSync,
                                     isVisible: { store.isTaskSurfaceVisible },
                                     isSignedIn: store.isSignedIn,
                                     sync: { await store.syncShortcutAndReload() }) }
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    isShowingAppearanceControls.toggle()
                } label: {
                    Label("Appearance", systemImage: "circle.lefthalf.filled")
                }
                .help("Adjust background appearance")
                .popover(isPresented: $isShowingAppearanceControls, arrowEdge: .bottom) {
                    AppearanceControlsView()
                }
            }
            ToolbarItem(placement: .primaryAction) {
                if store.installation.integrations.shortcut { Button(action: toggleWorkspaceMode) {
                    Label(
                        workspaceMode == .tasks ? "Shortcut" : "Tasks",
                        systemImage: workspaceMode == .tasks ? "link" : "checkmark"
                    )
                }
                .help(workspaceMode == .tasks ? "Show live Shortcut Stories" : "Show Todo Trackr Tasks") }
            }
            ToolbarItem(placement: .primaryAction) {
                Button(action: toggleWorkspaceLayout) {
                    Label(
                        workspaceLayout == .compact ? "Standard" : "Compact",
                        systemImage: workspaceLayout == .compact ? "rectangle.split.3x1" : "sidebar.left"
                    )
                }
                .help(workspaceLayout == .compact ? "Use Standard view" : "Use Compact view")
            }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.refresh(showLoading: false) }
        }
        .alert(
            "Todo Trackr",
            isPresented: Binding(
                get: { store.errorMessage != nil },
                set: { if !$0 { store.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "Unknown error")
        }
    }

    private var standardWorkspace: some View {
        NavigationSplitView {
            List {
                Section {
                    ForEach(TaskSmartView.allCases) { item in
                        Button {
                            selectView(.smart(item))
                        } label: {
                            Label {
                                HStack {
                                    Text(item.title)
                                    Spacer()
                                    Text("\(store.count(for: .smart(item)))")
                                        .font(DesignTokens.mono(12))
                                        .foregroundStyle(DesignTokens.slate)
                                }
                            } icon: {
                                Image(systemName: item.systemImage)
                            }
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(workspaceMode == .tasks && view == .smart(item) ? DesignTokens.text : DesignTokens.textMuted)
                        .listRowBackground(workspaceMode == .tasks && view == .smart(item) ? DesignTokens.selected : Color.clear)
                    }
                }
                Section("My Lists") {
                    ForEach(store.lists.filter { !$0.isInbox }) { list in
                        Button {
                            selectView(.list(list.id))
                        } label: {
                            Label {
                                HStack {
                                    Text(list.name)
                                    Spacer()
                                    Text("\(store.count(for: .list(list.id)))")
                                        .font(DesignTokens.mono(12))
                                        .foregroundStyle(DesignTokens.slate)
                                }
                            } icon: {
                                Image(systemName: "folder")
                            }
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(workspaceMode == .tasks && view == .list(list.id) ? DesignTokens.text : DesignTokens.textMuted)
                        .listRowBackground(workspaceMode == .tasks && view == .list(list.id) ? DesignTokens.selected : Color.clear)
                    }
                    HStack {
                        TextField("New list", text: $newListName)
                            .textFieldStyle(.plain)
                            .onSubmit(createList)
                        Button(action: createList) { Image(systemName: "plus") }
                            .buttonStyle(.plain)
                            .disabled(newListName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
                if store.installation.integrations.shortcut || store.installation.integrations.granola { Section("Sources") {
                    ForEach([TaskSource.shortcut, TaskSource.granola].filter { $0 == .shortcut ? store.installation.integrations.shortcut : store.installation.integrations.granola }, id: \.self) { source in
                        Button {
                            selectView(.source(source))
                        } label: {
                            Label {
                                HStack {
                                    Text(source.label)
                                    Spacer()
                                    Text("\(store.count(for: .source(source)))")
                                        .font(DesignTokens.mono(12))
                                        .foregroundStyle(DesignTokens.slate)
                                }
                            } icon: {
                                Image(systemName: source == .shortcut ? "link" : "waveform")
                            }
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(workspaceMode == .tasks && view == .source(source) ? DesignTokens.text : DesignTokens.textMuted)
                        .listRowBackground(workspaceMode == .tasks && view == .source(source) ? DesignTokens.selected : Color.clear)
                    }
                }
                }
            }
            .scrollContentBackground(.hidden)
            .appSurfaceBackground(.sidebar)
            .navigationTitle("Todo Trackr")
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 10) {
                    if let status = store.workSwitchStatus {
                        Text(status).font(.caption).foregroundStyle(DesignTokens.textMuted)
                    }
                    SyncStatusView(state: store.syncState)
                    Spacer()
                    Button {
                        store.signOut()
                    } label: {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .frame(width: 32, height: 32)
                    }
                    .help("Change server or sign out")
                    .accessibilityLabel("Change server or sign out")
                }
                .buttonStyle(.plain)
                .foregroundStyle(DesignTokens.textMuted)
                .padding(.horizontal, AppStylrTokens.Spacing.space16)
                .padding(.top, AppStylrTokens.Spacing.space8)
                .padding(.bottom, AppStylrTokens.Spacing.space16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } content: {
            Group {
                if workspaceMode == .shortcut {
                    ShortcutBoardListView()
                } else {
                    TaskListView(
                        view: view ?? .smart(.inbox),
                        search: $search,
                        priority: $priority,
                        due: $due,
                        sort: $sort
                    )
                }
            }
                .navigationSplitViewColumnWidth(min: 360, ideal: 470)
        } detail: {
            if workspaceMode == .shortcut, let story = store.selectedShortcutStory {
                ShortcutBoardDetailView(story: story)
                    .id(story.externalReference)
            } else if workspaceMode == .tasks, let task = store.selectedTask {
                TaskDetailView(task: task)
                    .id(task.id)
            } else {
                ContentUnavailableView(
                    workspaceMode == .tasks ? "Select a task" : "Select a Shortcut Story",
                    systemImage: workspaceMode == .tasks ? "checkmark.circle" : "link",
                    description: Text(workspaceMode == .tasks ? "Choose a task to view and edit its details." : "Choose a Story to view its live Shortcut details.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .appSurfaceBackground(.sidebar)
            }
        }
    }

    private var compactWorkspace: some View {
        HStack(spacing: 0) {
            compactSidebarRail
            Divider()
                .overlay(DesignTokens.border)
            compactContent
        }
    }

    private var compactContent: some View {
        NavigationStack {
            if workspaceMode == .shortcut, let story = store.selectedShortcutStory {
                ShortcutBoardDetailView(story: story)
                    .id(story.externalReference)
                    .toolbar {
                        ToolbarItem(placement: .navigation) {
                            Button {
                                store.selectedShortcutStoryReference = nil
                            } label: {
                                Label("Shortcut", systemImage: "chevron.left")
                            }
                        }
                    }
            } else if workspaceMode == .tasks, let task = store.selectedTask {
                TaskDetailView(task: task)
                    .id(task.id)
                    .toolbar {
                        ToolbarItem(placement: .navigation) {
                            Button {
                                store.selectedTaskID = nil
                            } label: {
                                Label("Tasks", systemImage: "chevron.left")
                            }
                        }
                    }
            } else if workspaceMode == .shortcut {
                ShortcutBoardListView(
                    automaticallySelectFirstStory: false,
                    isCompact: true
                )
            } else {
                TaskListView(
                    view: view ?? .smart(.inbox),
                    search: $search,
                    priority: $priority,
                    due: $due,
                    sort: $sort,
                    automaticallySelectFirstTask: false,
                    isCompact: true
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var compactSidebarRail: some View {
        VStack(spacing: 0) {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(DesignTokens.selected)
                Image(systemName: "checkmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(DesignTokens.action)
            }
            .frame(width: 34, height: 34)
            .help("Todo Trackr")
            .padding(.bottom, 10)

            ScrollView {
                VStack(spacing: 3) {
                    ForEach(TaskSmartView.allCases) { item in
                        compactRailButton(
                            title: item.title,
                            systemImage: item.systemImage,
                            isActive: workspaceMode == .tasks && view == .smart(item),
                            count: store.count(for: .smart(item))
                        ) {
                            selectView(.smart(item))
                        }
                    }

                    if !store.lists.filter({ !$0.isInbox }).isEmpty {
                        compactRailDivider
                        ForEach(store.lists.filter { !$0.isInbox }) { list in
                            compactRailButton(
                                title: list.name,
                                systemImage: "folder",
                                isActive: workspaceMode == .tasks && view == .list(list.id),
                                count: store.count(for: .list(list.id))
                            ) {
                                selectView(.list(list.id))
                            }
                        }
                    }

                    compactRailDivider
                    ForEach([TaskSource.shortcut, TaskSource.granola].filter { $0 == .shortcut ? store.installation.integrations.shortcut : store.installation.integrations.granola }, id: \.self) { source in
                        compactRailButton(
                            title: source.label,
                            systemImage: source == .shortcut ? "link" : "waveform",
                            isActive: workspaceMode == .tasks && view == .source(source),
                            count: store.count(for: .source(source))
                        ) {
                            selectView(.source(source))
                        }
                    }
                }
                .padding(.horizontal, 7)
            }
            .scrollIndicators(.hidden)

            VStack(spacing: 4) {
                SyncStatusView(state: store.syncState, showsLabel: false)
                    .frame(width: 40, height: 34)
                Button {
                    store.signOut()
                } label: {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .frame(width: 40, height: 34)
                }
                .buttonStyle(.plain)
                .foregroundStyle(DesignTokens.textMuted)
                .help("Change server or sign out")
                .accessibilityLabel("Change server or sign out")
            }
        }
        .padding(.vertical, 12)
        .frame(width: 56)
        .appSurfaceBackground(.sidebar)
    }

    private var compactRailDivider: some View {
        Divider()
            .overlay(DesignTokens.border)
            .padding(.vertical, 4)
    }

    private func compactRailButton(
        title: String,
        systemImage: String,
        isActive: Bool,
        count: Int,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .frame(width: 40, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(isActive ? DesignTokens.text : DesignTokens.textMuted)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isActive ? DesignTokens.selected : Color.clear)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(isActive ? DesignTokens.borderStrong : Color.clear)
        }
        .help("\(title), \(count) \(count == 1 ? "task" : "tasks")")
        .accessibilityLabel(title)
        .accessibilityValue("\(count) \(count == 1 ? "task" : "tasks")")
    }

    private func createList() {
        let name = newListName
        newListName = ""
        Task {
            if let list = await store.createList(name: name) {
                view = .list(list.id)
            }
        }
    }

    private var workspaceLayout: WorkspaceLayoutMode {
        WorkspaceLayoutMode(rawValue: workspaceLayoutRaw) ?? .standard
    }

    private var workspaceMode: WorkspaceMode {
        store.installation.integrations.shortcut ? (WorkspaceMode(rawValue: workspaceModeRaw) ?? .tasks) : .tasks
    }

    private func selectView(_ nextView: TaskView) {
        workspaceModeRaw = WorkspaceMode.tasks.rawValue
        view = nextView
        store.selectedTaskID = nil
        store.selectedShortcutStoryReference = nil
        if case let .smart(smartView) = nextView,
           smartView == .recent || smartView == .completed || smartView == .archived {
            Task { await store.refresh(showLoading: false) }
        }
    }

    private func toggleWorkspaceMode() {
        let nextMode: WorkspaceMode = workspaceMode == .tasks ? .shortcut : .tasks
        workspaceModeRaw = nextMode.rawValue
        store.selectedTaskID = nil
        store.selectedShortcutStoryReference = nil
        if nextMode == .shortcut {
            Task { await store.refreshShortcutBoard() }
        }
    }

    private func toggleWorkspaceLayout() {
        let nextLayout: WorkspaceLayoutMode = workspaceLayout == .compact ? .standard : .compact
        workspaceLayoutRaw = nextLayout.rawValue
        store.selectedTaskID = nil
    }
}

struct SyncStatusView: View {
    let state: TaskStore.SyncState
    var showsLabel = true

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
                .shadow(color: color.opacity(0.7), radius: state == .synced ? 6 : 3)
            if showsLabel {
                Text(label)
                    .font(DesignTokens.mono(11))
            }
        }
        .foregroundStyle(state == .error ? DesignTokens.danger : DesignTokens.textMuted)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Sync status: \(label)")
        .help("Tasks refresh when opened and slow to every 10 minutes when unchanged")
    }

    private var label: String {
        switch state {
        case .syncing: "Syncing"
        case .synced: "Synced"
        case .error: "Offline"
        }
    }

    private var color: Color {
        switch state {
        case .syncing: DesignTokens.sage
        case .synced: DesignTokens.action
        case .error: DesignTokens.danger
        }
    }
}
