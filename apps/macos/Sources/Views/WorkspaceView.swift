import SwiftUI

struct WorkspaceView: View {
    @EnvironmentObject private var store: TaskStore
    @EnvironmentObject private var integration: WorkIntegration
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
                if store.shortcutWorkEnabled { ShortcutSyncControls(schedule: store.shortcutSync,
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
                Menu {
                    Button("Tasks") { workspaceModeRaw = WorkspaceMode.tasks.rawValue }
                    if integration.isAvailable { Button(integration.title) { workspaceModeRaw = integration.providerID ?? WorkspaceMode.tasks.rawValue } }
                    if store.installation.integrations.shortcut {
                        Button("Shortcut") {
                            workspaceModeRaw = WorkspaceMode.shortcut.rawValue
                            Task { await store.refreshShortcutBoard() }
                        }
                    }
                } label: { Label(workspaceMode.title, systemImage: workspaceMode.systemImage) }
                .help("Choose Tasks or an optional work provider")
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
                Section("Workspaces") {
                    if integration.isAvailable { Button {
                        workspaceModeRaw = integration.providerID ?? WorkspaceMode.tasks.rawValue
                    } label: { Label(integration.title, systemImage: "link") }
                    .buttonStyle(.plain)
                    .foregroundStyle(workspaceMode == .integration ? DesignTokens.text : DesignTokens.textMuted)
                    .listRowBackground(workspaceMode == .integration ? DesignTokens.selected : Color.clear) }
                    if store.installation.integrations.shortcut {
                        Button {
                            workspaceModeRaw = WorkspaceMode.shortcut.rawValue
                            Task { await store.refreshShortcutBoard() }
                        } label: { Label("Shortcut", systemImage: "link") }
                        .buttonStyle(.plain)
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
                VStack(alignment: .leading, spacing: 8) {
                    connectionButton
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
            }
        } content: {
            WorkIntegrationLayer(showingIntegration: workspaceMode == .integration) {
                if contentMode == .shortcut {
                    ShortcutBoardListView()
                } else {
                    TaskListView(view: view ?? .smart(.inbox), search: $search, priority: $priority, due: $due, sort: $sort)
                }
            } integration: { integration.listView() }
            .navigationSplitViewColumnWidth(min: 360, ideal: 470)
        } detail: {
            WorkIntegrationLayer(showingIntegration: workspaceMode == .integration) {
                if contentMode == .shortcut, let story = store.selectedShortcutStory {
                    ShortcutBoardDetailView(story: story).id(story.externalReference)
                } else if contentMode == .tasks, let task = store.selectedTask {
                    TaskDetailView(task: task).id(task.id)
                } else {
                    ContentUnavailableView(
                        contentMode == .tasks ? "Select a task" : "Select a Shortcut Story",
                        systemImage: contentMode == .tasks ? "checkmark.circle" : "link",
                        description: Text(contentMode == .tasks ? "Choose a task to view and edit its details." : "Choose a Story to view its live Shortcut details.")
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .appSurfaceBackground(.sidebar)
                }
            } integration: {
                integration.detailView()
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
            WorkIntegrationLayer(showingIntegration: workspaceMode == .integration) {
                if contentMode == .shortcut, let story = store.selectedShortcutStory {
                    ShortcutBoardDetailView(story: story)
                        .id(story.externalReference)
                        .toolbar {
                            if workspaceMode != .integration {
                                ToolbarItem(placement: .navigation) {
                                    Button { store.selectedShortcutStoryReference = nil } label: { Label("Shortcut", systemImage: "chevron.left") }
                                }
                            }
                        }
                } else if contentMode == .tasks, let task = store.selectedTask {
                    TaskDetailView(task: task)
                        .id(task.id)
                        .toolbar {
                            if workspaceMode != .integration {
                                ToolbarItem(placement: .navigation) {
                                    Button { store.selectedTaskID = nil } label: { Label("Tasks", systemImage: "chevron.left") }
                                }
                            }
                        }
                } else if contentMode == .shortcut {
                    ShortcutBoardListView(automaticallySelectFirstStory: false, isCompact: true)
                } else {
                    TaskListView(view: view ?? .smart(.inbox), search: $search, priority: $priority, due: $due,
                                 sort: $sort, automaticallySelectFirstTask: false, isCompact: true)
                }
            } integration: { integration.compactView() }
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
                    if integration.isAvailable { compactRailButton(title: integration.title, systemImage: "link", isActive: workspaceMode == .integration, count: integration.itemCount) {
                        workspaceModeRaw = integration.providerID ?? WorkspaceMode.tasks.rawValue
                    } }
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
                connectionButton.labelStyle(.iconOnly)
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

    @ViewBuilder private var connectionButton: some View {
        if store.installation.integrations.shortcut {
            Button { ShortcutConnectionWindow.show() } label: {
                Label("Connections", systemImage: "point.3.connected.trianglepath.dotted")
                    .font(DesignTokens.sans(11)).padding(8)
            }
            .buttonStyle(.plain).foregroundStyle(DesignTokens.textMuted)
            .help("Manage the optional hosted Shortcut connection")
            .accessibilityLabel("Connections")
        }
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

    // Keep the Task subtree mounted under integrations so unsaved editor and Quick Capture
    // drafts survive a provider visit. Shortcut retains its existing separate view.
    private var contentMode: WorkspaceMode { workspaceMode == .integration ? .tasks : workspaceMode }

    private var workspaceMode: WorkspaceMode {
        WorkProviderRouting.miniMode(workspaceModeRaw, shortcutAvailable: store.installation.integrations.shortcut)
    }

    private func selectView(_ nextView: TaskView) {
        if workspaceMode == .integration, view == nextView {
            workspaceModeRaw = WorkspaceMode.tasks.rawValue
            return
        }
        workspaceModeRaw = WorkspaceMode.tasks.rawValue
        view = nextView
        store.selectedTaskID = nil
        store.selectedShortcutStoryReference = nil
        if case let .smart(smartView) = nextView,
           smartView == .recent || smartView == .completed || smartView == .archived {
            Task { await store.refresh(showLoading: false) }
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
