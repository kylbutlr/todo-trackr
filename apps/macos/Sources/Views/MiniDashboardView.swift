import SwiftUI

struct MiniDashboardView: View {
    @EnvironmentObject private var store: TaskStore
    @AppStorage("todo-trackr.mini-dashboard.starred-only") private var starredOnly = false
    @AppStorage("todo-trackr.workspace-mode") private var workspaceModeRaw = WorkspaceMode.tasks.rawValue
    @AppStorage("todo-trackr.shortcut-board.scope") private var shortcutScopeRaw = ShortcutBoardScope.either.rawValue
    @State private var newTaskTitle = ""
    @State private var isAddingTask = false
    @State private var isQuickAddExpanded = false
    @State private var isShortcutFeedStarting = false
    @State private var isManualRefreshInFlight = false
    @State private var alwaysOnTop: Bool
    @FocusState private var isQuickAddFocused: Bool

    let toggleAlwaysOnTop: () -> Void
    let openWorkspace: () -> Void
    let openReviews: (ReviewSummary) -> Void
    let openTask: (TaskItem) -> Void
    let openShortcutStory: (ShortcutBoardStory) -> Void

    init(
        isAlwaysOnTop: Bool,
        toggleAlwaysOnTop: @escaping () -> Void,
        openWorkspace: @escaping () -> Void,
        openReviews: @escaping (ReviewSummary) -> Void,
        openTask: @escaping (TaskItem) -> Void,
        openShortcutStory: @escaping (ShortcutBoardStory) -> Void
    ) {
        _alwaysOnTop = State(initialValue: isAlwaysOnTop)
        self.toggleAlwaysOnTop = toggleAlwaysOnTop
        self.openWorkspace = openWorkspace
        self.openReviews = openReviews
        self.openTask = openTask
        self.openShortcutStory = openShortcutStory
    }

    private var sections: [TaskListSection] {
        MiniDashboardTimeline.sections(for: store.tasks, starredOnly: starredOnly)
    }

    private var visibleTaskCount: Int {
        sections.reduce(0) { $0 + $1.tasks.count }
    }

    private var workspaceMode: WorkspaceMode {
        store.installation.integrations.shortcut ? (WorkspaceMode(rawValue: workspaceModeRaw) ?? .tasks) : .tasks
    }

    private var shortcutScope: ShortcutBoardScope {
        get { ShortcutBoardScope(rawValue: shortcutScopeRaw) ?? .either }
        nonmutating set { shortcutScopeRaw = newValue.rawValue }
    }

    private var shortcutStories: [ShortcutBoardStory] {
        store.shortcutStories(scope: shortcutScope)
            .filter { !starredOnly || $0.isStarred }
    }

    private var shortcutSections: [ShortcutBoardSection] {
        ShortcutBoardGrouping.sections(for: shortcutStories)
    }

    private var visibleItemCount: Int {
        workspaceMode == .tasks ? visibleTaskCount : shortcutStories.count
    }

    private var isShortcutFeedLoading: Bool {
        store.isShortcutBoardLoading || isShortcutFeedStarting
    }

    private var isRefreshingVisibleSurface: Bool {
        isManualRefreshInFlight || (workspaceMode == .tasks ? store.isLoading : isShortcutFeedLoading)
    }

    private var canRefresh: Bool {
        if case .signedIn = store.authenticationState { return true }
        return false
    }

    var body: some View {
        ZStack {
            AppWindowBackground()

            VStack(spacing: 0) {
                header
                switch store.authenticationState {
                case .checking:
                    ProgressView("Opening Todo Trackr")
                        .tint(DesignTokens.action)
                        .foregroundStyle(DesignTokens.textMuted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .signedOut:
                    signedOutContent
                case .signedIn:
                    signedInContent
                        .clipped()
                    if store.installation.integrations.shortcut { MiniDashboardSyncFooter(schedule: store.shortcutSync,
                                            workSwitchStatus: store.workSwitchStatus,
                                            isVisible: { store.isTaskSurfaceVisible },
                                            sync: { await store.syncShortcutAndReload() }) } else {
                        SyncStatusView(state: store.syncState).padding(8)
                    }
                }
            }
        }
        .tint(DesignTokens.action)
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

    private var header: some View {
        HStack(spacing: 8) {
            if store.installation.integrations.shortcut { Button(action: toggleWorkspaceMode) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(DesignTokens.selected)
                    Image(systemName: workspaceMode.systemImage)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(DesignTokens.action)
                }
                .frame(width: 30, height: 30)
            }
            .buttonStyle(.plain)
            .help(workspaceMode == .tasks ? "Showing Tasks. Switch to Shortcut" : "Showing Shortcut. Switch to Tasks")
            .accessibilityLabel(workspaceMode == .tasks ? "Showing Tasks. Switch to Shortcut" : "Showing Shortcut. Switch to Tasks") }

            Text("Mini Trackr")
                .font(DesignTokens.sans(16, weight: .bold))
                .foregroundStyle(DesignTokens.text)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .layoutPriority(1)

            if let summary = store.reviewSummary, summary.total > 0 {
                reviewBadge(summary)
            }

            Spacer()

            HStack(spacing: 2) {
                Button(action: refreshMiniDashboard) {
                    Group {
                        if isRefreshingVisibleSurface {
                            ProgressView()
                                .controlSize(.small)
                                .tint(DesignTokens.action)
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .foregroundStyle(isRefreshingVisibleSurface ? DesignTokens.action : DesignTokens.textMuted)
                .disabled(!canRefresh || isManualRefreshInFlight)
                .help(workspaceMode == .tasks ? "Sync Shortcut and refresh Tasks" : "Refresh Shortcut")
                .accessibilityLabel(
                    isRefreshingVisibleSurface
                        ? "Refreshing Mini Trackr"
                        : workspaceMode == .tasks ? "Sync Shortcut and refresh Tasks" : "Refresh Shortcut"
                )

                Button {
                    withAnimation(.easeInOut(duration: 0.16)) {
                        starredOnly.toggle()
                    }
                } label: {
                    Image(systemName: starredOnly ? "star.fill" : "star")
                        .frame(width: 28, height: 28)
                        .background(
                            starredOnly ? DesignTokens.selected : Color.clear,
                            in: RoundedRectangle(cornerRadius: 7)
                        )
                }
                .buttonStyle(.plain)
                .foregroundStyle(starredOnly ? DesignTokens.warning : DesignTokens.textMuted)
                .help(starredOnly ? "Show all items" : "Show only Starred items")
                .accessibilityLabel(starredOnly ? "Show all items" : "Show only Starred items")

                Button {
                    alwaysOnTop.toggle()
                    toggleAlwaysOnTop()
                } label: {
                    Image(systemName: alwaysOnTop ? "pin.fill" : "pin")
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .foregroundStyle(alwaysOnTop ? DesignTokens.action : DesignTokens.textMuted)
                .help(alwaysOnTop ? "Stop keeping Mini Trackr on top" : "Keep Mini Trackr on top")
                .accessibilityLabel(alwaysOnTop ? "Disable Always on Top" : "Enable Always on Top")

                Button(action: openWorkspace) {
                    Image(systemName: "arrow.up.right.square")
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .foregroundStyle(DesignTokens.textMuted)
                .help("Open Todo Trackr")
                .accessibilityLabel("Open Todo Trackr")
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .appSurfaceBackground(.sidebar)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(DesignTokens.border)
                .frame(height: 1)
        }
    }

    private func reviewBadge(_ summary: ReviewSummary) -> some View {
        Button {
            store.beginReviewWatch()
            openReviews(summary)
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "tray.full.fill")
                Text(summary.total > 99 ? "99+" : String(summary.total))
                    .font(DesignTokens.mono(10, weight: .bold))
            }
            .foregroundStyle(DesignTokens.warning)
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .background(DesignTokens.warning.opacity(0.12), in: Capsule())
            .overlay(Capsule().stroke(DesignTokens.warning.opacity(0.28), lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Open \(summary.total) items needing review in Todo Trackr for the web")
        .help("\(reviewHelp(summary)). Open in Chrome.")
    }

    private func reviewHelp(_ summary: ReviewSummary) -> String {
        var sources: [String] = []
        if summary.sources.granola > 0 { sources.append("Granola \(summary.sources.granola)") }
        if summary.sources.shortcut > 0 { sources.append("Shortcut \(summary.sources.shortcut)") }
        return "\(summary.total) items need review in Todo Trackr: \(sources.joined(separator: ", "))"
    }

    private var signedInContent: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: 0) {
                if workspaceMode == .shortcut {
                    shortcutScopeBar
                }

                if workspaceMode == .shortcut
                    && isShortcutFeedLoading
                    && shortcutStories.isEmpty {
                    shortcutLoadingContent
                        .transition(.opacity)
                } else if visibleItemCount == 0 && !store.isLoading && !isShortcutFeedLoading {
                    ContentUnavailableView(
                        starredOnly ? "No starred items" : workspaceMode == .tasks ? "Nothing open" : "No matching Stories",
                        systemImage: starredOnly ? "star" : workspaceMode == .tasks ? "checkmark.circle" : "link",
                        description: Text(emptyDescription)
                    )
                    .foregroundStyle(DesignTokens.textMuted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                            if workspaceMode == .tasks {
                                ForEach(sections) { section in
                                    Section {
                                        ForEach(section.tasks) { task in
                                            MiniDashboardTaskRow(task: task, openTask: { openTask(task) })
                                                .id(task.presentationIdentity)
                                        }
                                    } header: {
                                        MiniDashboardSectionHeader(
                                            id: section.id,
                                            title: section.title ?? "Tasks",
                                            count: section.tasks.count
                                        )
                                    }
                                }
                            } else {
                                ForEach(shortcutSections) { section in
                                    Section {
                                        ForEach(section.stories) { story in
                                            MiniShortcutBoardRow(story: story, openStory: { openShortcutStory(story) })
                                                .id(story.presentationIdentity)
                                        }
                                    } header: {
                                        MiniDashboardSectionHeader(
                                            id: section.id,
                                            title: section.title,
                                            count: section.stories.count
                                        )
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.bottom, isQuickAddExpanded ? 10 : 52)
                    }
                    .scrollIndicators(.automatic)
                }

                if workspaceMode == .tasks && isQuickAddExpanded {
                    quickAdd
                        .transition(
                            .asymmetric(
                                insertion: .move(edge: .bottom).combined(with: .opacity),
                                removal: .move(edge: .bottom).combined(with: .opacity)
                            )
                        )
                }
            }
            .zIndex(MiniDashboardLayer.timeline)

            if !isQuickAddExpanded {
                if workspaceMode == .tasks {
                    quickAddLauncher
                        .padding(12)
                        .transition(
                            .asymmetric(
                                insertion: .scale(scale: 0.68).combined(with: .opacity),
                                removal: .scale(scale: 0.88).combined(with: .opacity)
                            )
                        )
                        .zIndex(MiniDashboardLayer.quickAdd)
                }
            }
        }
        .task(id: workspaceMode) {
            guard workspaceMode == .shortcut else {
                isShortcutFeedStarting = false
                return
            }
            isShortcutFeedStarting = true
            await store.refreshShortcutBoard()
            isShortcutFeedStarting = false
        }
    }

    private var signedOutContent: some View {
        ContentUnavailableView {
            Label("Sign in required", systemImage: "lock")
        } description: {
            Text("Open Todo Trackr to sign in before using Mini Trackr.")
        } actions: {
            Button("Open Todo Trackr", action: openWorkspace)
                .buttonStyle(.borderedProminent)
                .tint(DesignTokens.action)
                .foregroundStyle(DesignTokens.ink)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var shortcutScopeBar: some View {
        HStack(spacing: 8) {
            Text("Shortcut scope")
                .font(DesignTokens.sans(10, weight: .bold))
                .foregroundStyle(DesignTokens.textMuted)
            Spacer()
            Picker("Shortcut scope", selection: Binding(get: { shortcutScope }, set: { shortcutScope = $0 })) {
                ForEach(ShortcutBoardScope.allCases) { item in
                    Text(item.title).tag(item)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            if isShortcutFeedLoading {
                ProgressView()
                    .controlSize(.mini)
                    .tint(DesignTokens.action)
                    .accessibilityLabel("Loading Shortcut tickets")
            }
            Text("\(shortcutStories.count)")
                .font(DesignTokens.mono(9))
                .foregroundStyle(DesignTokens.textMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .appSurfaceBackground(.surface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(DesignTokens.border).frame(height: 1)
        }
    }

    private var shortcutLoadingContent: some View {
        VStack(spacing: 10) {
            ProgressView()
                .controlSize(.small)
                .tint(DesignTokens.action)
            Text("Loading Shortcut tickets")
                .font(DesignTokens.sans(12, weight: .semibold))
                .foregroundStyle(DesignTokens.textMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }

    private var emptyDescription: String {
        if starredOnly { return "Star an item to keep it close." }
        if workspaceMode == .tasks { return "Your task list is clear." }
        return "No active Shortcut Stories match \(shortcutScope.title.lowercased())."
    }

    private var quickAdd: some View {
        HStack(spacing: 8) {
            Image(systemName: "plus")
                .foregroundStyle(DesignTokens.textMuted)
            TextField("Add to Inbox", text: $newTaskTitle)
                .textFieldStyle(.plain)
                .foregroundStyle(DesignTokens.text)
                .focused($isQuickAddFocused)
                .onSubmit(createTask)
                .onExitCommand(perform: collapseQuickAdd)
            if isAddingTask {
                ProgressView()
                    .controlSize(.small)
                    .tint(DesignTokens.action)
            } else {
                Button(action: createTask) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 18))
                }
                .buttonStyle(.plain)
                .foregroundStyle(DesignTokens.action)
                .disabled(newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .help("Add task")
                .accessibilityLabel("Add task")
            }
            Button(action: collapseQuickAdd) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
            }
            .buttonStyle(.plain)
            .foregroundStyle(DesignTokens.textMuted)
            .help("Hide Add to Inbox")
            .accessibilityLabel("Hide Add to Inbox")
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 48)
        .appSurfaceBackground(.surfaceRaised)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(DesignTokens.border)
                .frame(height: 1)
        }
    }

    private var quickAddLauncher: some View {
        Button(action: expandQuickAdd) {
            Image(systemName: "plus")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(DesignTokens.ink)
                .frame(width: 32, height: 32)
                .background(DesignTokens.action, in: Circle())
                .shadow(color: Color.black.opacity(0.3), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
        .help("Add to Inbox")
        .accessibilityLabel("Show Add to Inbox")
    }

    private func createTask() {
        let title = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !isAddingTask else { return }
        isAddingTask = true
        Task {
            let created = await store.createTask(title: title, listId: store.inboxID)
            if created {
                newTaskTitle = ""
                collapseQuickAdd()
            }
            isAddingTask = false
        }
    }

    private func expandQuickAdd() {
        withAnimation(MiniDashboardMotion.quickAdd) {
            isQuickAddExpanded = true
        }
        Task { @MainActor in
            await Task.yield()
            isQuickAddFocused = true
        }
    }

    private func collapseQuickAdd() {
        isQuickAddFocused = false
        withAnimation(MiniDashboardMotion.quickAdd) {
            isQuickAddExpanded = false
        }
    }

    private func toggleWorkspaceMode() {
        let nextMode: WorkspaceMode = workspaceMode == .tasks ? .shortcut : .tasks
        workspaceModeRaw = nextMode.rawValue
        store.selectedTaskID = nil
        store.selectedShortcutStoryReference = nil
        collapseQuickAdd()
        if nextMode == .shortcut {
            isShortcutFeedStarting = true
        }
    }

    private func refreshMiniDashboard() {
        guard canRefresh, !isManualRefreshInFlight else { return }
        isManualRefreshInFlight = true
        Task { @MainActor in
            defer { isManualRefreshInFlight = false }
            await store.refreshMiniDashboard(for: workspaceMode)
        }
    }
}
