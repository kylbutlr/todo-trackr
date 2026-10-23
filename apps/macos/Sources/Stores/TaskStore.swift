import AppKit
import Foundation

@MainActor
final class TaskStore: ObservableObject {
    enum CompletionFeedbackPhase: Equatable {
        case confirming
        case exiting
    }

    enum AuthenticationState {
        case checking
        case signedOut
        case signedIn
    }

    enum SyncState: Equatable {
        case syncing
        case synced
        case error
    }

    @Published private(set) var authenticationState: AuthenticationState = .checking
    @Published private(set) var tasks: [TaskItem] = []
    @Published private(set) var lists: [TaskListItem] = []
    @Published var selectedTaskID: UUID?
    @Published var errorMessage: String?
    @Published private(set) var isLoading = false
    @Published private(set) var syncState: SyncState = .syncing
    @Published private(set) var completionFeedback: [UUID: CompletionFeedbackPhase] = [:]
    @Published private(set) var shortcutBoardStories: [ShortcutBoardStory] = []
    @Published private(set) var shortcutBoardGeneratedAt: Date?
    @Published var selectedShortcutStoryReference: String?
    @Published private(set) var isShortcutBoardLoading = false
    @Published private(set) var reviewSummary: ReviewSummary?
    @Published private(set) var installation = InstallationCapabilities.legacy

    @Published private(set) var workSwitchStatus: String?
    private var workPermission: WorkPermission?
    private var workLeaseEnd = Date.distantPast
    private var workLeaseUptime = -Double.infinity
    private var workCheckTask: Task<Void, Never>?
    private var workCheckInFlight = false
    var automaticWorkAllowed: Bool {
        !installation.usesWorkSwitch || (workPermission?.state == "active" && Date() < workLeaseEnd && ProcessInfo.processInfo.systemUptime < workLeaseUptime)
    }
    private let api: APIClient
    let shortcutSync = ShortcutSyncSchedule()
    private var shortcutSyncTimer: Task<Void, Never>?

    var isTaskSurfaceVisible: Bool { taskSurfaceVisibility() }
    var isSignedIn: Bool { authenticationState == .signedIn }
    private var isRefreshing = false
    private var isShortcutBoardRefreshing = false
    private var isReviewSummaryRefreshing = false
    private var lastReviewSummaryRefreshAt: Date?
    private var autoRefreshTask: Task<Void, Never>?
    private var lastOpenTaskSnapshot: [TaskItem]?
    private var unchangedTaskPolls = 0
    private var reviewWatchTask: Task<Void, Never>?
    private var taskSurfaceVisibility: @MainActor () -> Bool = { true }

    init(api: APIClient = .shared) {
        self.api = api
        DistributedNotificationCenter.default().addObserver(self, selector: #selector(workSwitchChanged), name: Notification.Name("com.kylbutlr.app-switchr.state-changed"), object: nil)

        Task {
            await restoreSession()
        }
    }

    var selectedTask: TaskItem? {
        tasks.first { $0.id == selectedTaskID }
    }

    var selectedShortcutStory: ShortcutBoardStory? {
        shortcutBoardStories.first { $0.externalReference == selectedShortcutStoryReference }
    }

    var inboxID: UUID {
        lists.first(where: \.isInbox)?.id
            ?? UUID(uuidString: "00000000-0000-4000-8000-000000000001")!
    }

    @objc private func workSwitchChanged() {
        guard installation.usesWorkSwitch else { return }
        if workSwitchStatus != nil { workSwitchStatus = "Switchr: Pending" }
        Task { await checkWorkPermission() }
    }

    private func checkWorkPermission() async {
        guard installation.usesWorkSwitch else {
            workSwitchStatus = nil
            api.activity?.setPermission(.unconfigured)
            return
        }
        guard isSignedIn, !workCheckInFlight else { return }
        workCheckInFlight = true
        defer { workCheckInFlight = false }
        let started = ProcessInfo.processInfo.systemUptime
        do {
            let next = try await api.workPermission()
            guard next.valid else { throw APIError.invalidResponse }
            let previous = workPermission
            workPermission = next
            let remaining = max(0, next.leaseSeconds - (ProcessInfo.processInfo.systemUptime - started))
            workLeaseEnd = Date().addingTimeInterval(remaining)
            workLeaseUptime = ProcessInfo.processInfo.systemUptime + remaining
            api.activity?.setPermission(!next.configured ? .unconfigured : next.state == "active" ? .active : next.state == "standby" ? .off : .unavailable, revision: next.revision, remaining: remaining)
            workSwitchStatus = !next.configured ? nil : next.state == "active" ? (next.catchUpPending == true ? "Switchr: Pending" : "Switchr: On") : next.state == "standby" ? "Switchr: Off" : "Switchr: Pending"
            if automaticWorkAllowed && next.configured && next.catchUpPending == true { try await api.resumeWork() }
            if automaticWorkAllowed && (previous == nil || previous?.state != "active" || previous?.revision != next.revision || (previous?.catchUpPending == true && next.catchUpPending == false)) {
                guard automaticWorkAllowed else { return }
                unchangedTaskPolls = 0
                await refresh(showLoading: false)
                if shortcutBoardGeneratedAt != nil { await refreshShortcutBoard(showLoading: false) }
                await refreshReviewSummaryIfNeeded(force: true)
            }
        } catch {
            workPermission = nil; workLeaseEnd = .distantPast
            api.activity?.setPermission(.unavailable)
            workSwitchStatus = "Switchr: Pending"
        }
    }

    func startAutoRefresh() {
        if workCheckTask == nil && installation.usesWorkSwitch {
            workCheckTask = Task { [weak self] in
                while !Task.isCancelled {
                    guard let self else { return }
                    if isTaskSurfaceVisible { await checkWorkPermission() }
                    try? await Task.sleep(for: .seconds(30))
                }
            }
        }
        startShortcutSyncTimer()
        guard autoRefreshTask == nil else { return }

        autoRefreshTask = Task { [weak self] in
            var visibleTick = 0

            while !Task.isCancelled {
                guard let self else { break }
                let isTaskSurfaceVisible = taskSurfaceVisibility()
                try? await Task.sleep(for: TaskRefreshPolicy.interval(isTaskSurfaceVisible: isTaskSurfaceVisible, unchangedPolls: unchangedTaskPolls))
                guard !Task.isCancelled else { break }
                guard authenticationState == .signedIn, automaticWorkAllowed else { continue }

                guard TaskRefreshPolicy.shouldRefreshTasks(
                    isTaskSurfaceVisible: taskSurfaceVisibility()
                ) else { continue }

                visibleTick += 1
                if TaskRefreshPolicy.includesLists(at: visibleTick, unchangedPolls: unchangedTaskPolls) {
                    await refresh(showLoading: false)
                } else {
                    await refreshOpenTasks(showLoading: false)
                }
                if shortcutBoardGeneratedAt != nil && TaskRefreshPolicy.includesShortcutBoard(at: visibleTick, unchangedPolls: unchangedTaskPolls) {
                    await refreshShortcutBoard(showLoading: false)
                }
                await refreshReviewSummaryIfNeeded()
            }
        }
    }

    private func startShortcutSyncTimer() {
        guard shortcutSyncTimer == nil, installation.integrations.shortcut else { return }
        shortcutSyncTimer = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled, let self else { return }
                guard installation.integrations.shortcut else { continue }
                await shortcutSync.syncIfDue(
                    isVisible: isTaskSurfaceVisible && automaticWorkAllowed, isSignedIn: isSignedIn
                ) { [weak self] in
                    guard let self else { return .ignored }
                    return await ConnectionContext.$trigger.withValue(.automatic) { await fetchShortcutAndReload() }
                }
            }
        }
    }

    func syncShortcutAndReload() async {
        await ConnectionContext.$trigger.withValue(.manual) {
        guard isSignedIn, installation.integrations.shortcut else { return }
        await shortcutSync.syncNow { [weak self] in
            guard let self else { return .ignored }
            return await fetchShortcutAndReload()
        }
            }
    }

    private func fetchShortcutAndReload() async -> ShortcutSyncSchedule.Outcome {
        do {
            let applied = try await api.syncShortcutNow()
            guard isSignedIn else { return .ignored }
            await refreshOpenTasks(showLoading: false)
            if shortcutBoardGeneratedAt != nil { await refreshShortcutBoard(showLoading: false) }
            return applied ? .synced : .ignored
        } catch APIError.unauthorized {
            signOut()
            return .failed("Session expired. Sign in again.")
        } catch {
            return .failed(error.localizedDescription)
        }
    }

    func setTaskSurfaceVisibilityProvider(_ provider: @escaping @MainActor () -> Bool) {
        taskSurfaceVisibility = provider
    }

    func taskSurfaceDidOpen() {
        unchangedTaskPolls = 0
        autoRefreshTask?.cancel()
        autoRefreshTask = nil
        startAutoRefresh()
        Task {
            await checkWorkPermission()
            await refreshOpenTasks(showLoading: false)
            await refreshReviewSummaryIfNeeded(force: true)
        }
    }

    func beginReviewWatch() {
        reviewWatchTask?.cancel()
        reviewWatchTask = Task { [weak self] in
            for _ in 0..<TaskRefreshPolicy.reviewWatchMaximumAttempts {
                try? await Task.sleep(for: TaskRefreshPolicy.reviewWatchInterval)
                guard !Task.isCancelled, let self, authenticationState == .signedIn else { return }
                guard automaticWorkAllowed else { continue }
                await refreshReviewSummaryIfNeeded(isReviewWatchActive: true)
                if reviewSummary?.total == 0 { return }
            }
        }
    }

    func tasks(for view: TaskView, search: String = "", priority: PriorityFilter = .any, due: DueFilter = .any, sort: TaskSortMode = .smart) -> [TaskItem] {
        let calendar = Calendar.current
        let startToday = calendar.startOfDay(for: .now)
        let startTomorrow = calendar.date(byAdding: .day, value: 1, to: startToday)!

        func state(_ task: TaskItem) -> DueFilter {
            guard let value = task.dueAt else { return .none }
            if value < startToday { return .overdue }
            if value < startTomorrow { return .today }
            return .upcoming
        }

        var result = tasks.filter { task in
            switch view {
            case let .smart(smart):
                switch smart {
                case .inbox: task.listId == inboxID && task.status == .open
                case .today: task.status == .open && state(task) == .today
                case .upcoming: task.status == .open && state(task) == .upcoming
                case .overdue: task.status == .open && state(task) == .overdue
                case .all: task.status == .open
                case .starred: task.status == .open && task.isStarred
                case .recent: true
                case .completed: task.status == .completed
                case .archived: task.status == .archived
                }
            case let .list(id): task.listId == id && task.status == .open
            case let .source(source): task.source == source && task.status == .open
            }
        }

        let needle = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        result = result.filter { task in
            (needle.isEmpty || "\(task.title)\n\(task.notes)".lowercased().contains(needle))
                && (priority == .any || task.priority.rawValue == priority.rawValue)
                && (due == .any || state(task) == due)
        }

        let priorityRank: [TaskPriority: Int] = [.highest: 0, .high: 1, .medium: 2, .low: 3, .lowest: 4, .none: 5]
        return result.sorted { left, right in
            if view == .smart(.recent) {
                if left.createdAt != right.createdAt { return left.createdAt > right.createdAt }
                return TaskOrdering.finalTieBreakPrecedes(left, right)
            }
            switch sort {
            case .newest:
                if left.createdAt != right.createdAt { return left.createdAt > right.createdAt }
                return TaskOrdering.finalTieBreakPrecedes(left, right)
            case .priority:
                let leftKey = (priorityRank[left.priority] ?? 4, left.dueAt ?? .distantFuture)
                let rightKey = (priorityRank[right.priority] ?? 4, right.dueAt ?? .distantFuture)
                return leftKey < rightKey || (leftKey == rightKey && TaskOrdering.finalTieBreakPrecedes(left, right))
            case .due:
                let leftKey = (left.dueAt ?? .distantFuture, priorityRank[left.priority] ?? 4)
                let rightKey = (right.dueAt ?? .distantFuture, priorityRank[right.priority] ?? 4)
                return leftKey < rightKey || (leftKey == rightKey && TaskOrdering.finalTieBreakPrecedes(left, right))
            case .smart:
                return TaskOrdering.smartPrecedes(left, right)
            }
        }
    }

    func count(for view: TaskView) -> Int {
        tasks(for: view).count
    }

    func signIn(password: String) async {
        await connect(to: APIClient.configuredBaseURL().absoluteString, password: password)
    }

    func connect(to server: String, password: String) async {
        await ConnectionContext.$trigger.withValue(.manual) {
        guard !isLoading else { return }
        let url: URL
        do { url = try ServerConnection.normalize(server) }
        catch { errorMessage = error.localizedDescription; return }
        signOut()
        isLoading = true
        errorMessage = nil

        do {
            await api.configure(server: url)
            installation = try await api.installation()
            if installation.authenticationMode == "password" { try await api.login(password: password) }
            else { try await api.validateSession() }
            authenticationState = .signedIn
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
            }
    }

    func signOut() {
        let oldTaskIDs = tasks.map(\.id)
        Task { for id in oldTaskIDs { await TaskAlarmNotificationService.shared.cancel(taskID: id) } }
        api.activity?.setPermission(.unavailable)
        try? api.signOut()
        reviewWatchTask?.cancel()
        reviewWatchTask = nil
        tasks = []
        lists = []
        selectedTaskID = nil
        shortcutBoardStories = []
        shortcutBoardGeneratedAt = nil
        selectedShortcutStoryReference = nil
        reviewSummary = nil
        lastReviewSummaryRefreshAt = nil
        syncState = .syncing
        authenticationState = .signedOut
    }

    func refresh(showLoading: Bool = true) async {
        await performRefresh(showLoading: showLoading, includesLists: true)
        await refreshReviewSummaryIfNeeded()
    }

    func refreshOpenTasks(showLoading: Bool = false) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        syncState = .syncing
        if showLoading { isLoading = true }

        do {
            let refreshed = try await api.listOpenTasks()
            recordTaskSnapshot(refreshed)
            tasks = TaskSnapshotMerge.openTasks(
                current: tasks,
                refreshed: refreshed,
                pendingCompletionIDs: Set(completionFeedback.keys)
            )
            syncState = .synced
        } catch APIError.unauthorized {
            signOut()
        } catch {
            errorMessage = error.localizedDescription
            syncState = .error
        }

        if showLoading { isLoading = false }
        isRefreshing = false
    }

    func refreshShortcutBoard(showLoading: Bool = true) async {
        guard installation.integrations.shortcut else { return }
        guard !isShortcutBoardRefreshing else { return }
        isShortcutBoardRefreshing = true
        if showLoading { isShortcutBoardLoading = true }

        do {
            let snapshot = try await api.shortcutBoard()
            shortcutBoardStories = snapshot.stories
            shortcutBoardGeneratedAt = snapshot.generatedAt
            if let selectedShortcutStoryReference,
               !snapshot.stories.contains(where: { $0.externalReference == selectedShortcutStoryReference }) {
                self.selectedShortcutStoryReference = nil
            }
        } catch APIError.unauthorized {
            signOut()
        } catch {
            errorMessage = error.localizedDescription
        }

        if showLoading { isShortcutBoardLoading = false }
        isShortcutBoardRefreshing = false
    }

    func refreshMiniDashboard(for mode: WorkspaceMode) async {
        await ConnectionContext.$trigger.withValue(.manual) {
        await syncShortcutAndReload()
        switch mode {
        case .tasks:
            await refreshOpenTasks(showLoading: true)
        case .shortcut:
            await refreshShortcutBoard(showLoading: true)
        }
        guard case .signedIn = authenticationState else { return }
        await refreshReviewSummaryIfNeeded(force: true)
            }
    }

    func refreshReviewSummaryIfNeeded(
        force: Bool = false,
        isReviewWatchActive: Bool = false,
        now: Date = .now
    ) async {
        guard installation.integrations.shortcut || installation.integrations.granola else { return }
        guard !isReviewSummaryRefreshing else { return }
        guard force || TaskRefreshPolicy.shouldRefreshReviewSummary(
            lastRefreshAt: lastReviewSummaryRefreshAt,
            isReviewWatchActive: isReviewWatchActive,
            now: now
        ) else { return }

        isReviewSummaryRefreshing = true
        defer { isReviewSummaryRefreshing = false }

        do {
            reviewSummary = try await api.reviewSummary()
            lastReviewSummaryRefreshAt = now
        } catch APIError.unauthorized {
            signOut()
        } catch {
            // Review awareness is supplemental. Keep the last known count if it cannot refresh.
        }
    }

    func shortcutStories(scope: ShortcutBoardScope, search: String = "") -> [ShortcutBoardStory] {
        ShortcutBoardGrouping.visibleStories(shortcutBoardStories, scope: scope, search: search)
    }

    private func performRefresh(showLoading: Bool, includesLists: Bool) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        syncState = .syncing
        if showLoading { isLoading = true }

        do {
            if includesLists {
                async let loadedTasks = api.listTasks()
                async let loadedLists = api.listTaskLists()
                let refreshed = try await loadedTasks
                recordTaskSnapshot(refreshed.filter { $0.status == .open })
                apply(refreshedTasks: refreshed)
                lists = try await loadedLists
            } else {
                let refreshed = try await api.listTasks()
                recordTaskSnapshot(refreshed.filter { $0.status == .open })
                apply(refreshedTasks: refreshed)
            }
            syncState = .synced
        } catch APIError.unauthorized {
            signOut()
        } catch {
            errorMessage = error.localizedDescription
            syncState = .error
        }

        if showLoading { isLoading = false }
        isRefreshing = false
    }

    private func apply(refreshedTasks: [TaskItem]) {
        let currentByID = Dictionary(uniqueKeysWithValues: tasks.map { ($0.id, $0) })
        tasks = refreshedTasks.map { refreshed in
            completionFeedback[refreshed.id] == nil
                ? refreshed
                : currentByID[refreshed.id] ?? refreshed
        }
        Task { await TaskAlarmNotificationService.shared.sync(tasks: tasks) }
    }

    private func recordTaskSnapshot(_ refreshed: [TaskItem]) {
        unchangedTaskPolls = lastOpenTaskSnapshot == refreshed ? unchangedTaskPolls + 1 : 0
        lastOpenTaskSnapshot = refreshed
    }

    @discardableResult
    func createTask(
        title: String,
        listId: UUID? = nil,
        source: TaskSource = .manual,
        sourceUrl: URL? = nil
    ) async -> Bool {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        do {
            let task = try await api.createTask(CreateTaskInput(
                title: trimmed,
                listId: listId ?? inboxID,
                source: source,
                sourceUrl: sourceUrl
            ))
            tasks.insert(task, at: 0)
            selectedTaskID = task.id
            syncState = .synced
            return true
        } catch {
            errorMessage = error.localizedDescription
            syncState = .error
            return false
        }
    }

    func createList(name: String) async -> TaskListItem? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        do {
            let list = try await api.createTaskList(name: trimmed)
            lists.append(list)
            return list
        } catch {
            errorMessage = error.localizedDescription
            syncState = .error
            return nil
        }
    }

    func toggle(_ task: TaskItem) async {
        guard task.source != .shortcut else { return }
        if task.status == .completed {
            await update(task, input: UpdateTaskInput(status: .open))
            return
        }

        completionFeedback[task.id] = .confirming
        let minimumHold = Task {
            try? await Task.sleep(for: .seconds(1))
        }

        do {
            let updated = try await atomicUpdate(task, input: UpdateTaskInput(status: .completed))
            await minimumHold.value
            completionFeedback[task.id] = .exiting
            try? await Task.sleep(for: .milliseconds(220))
            if let index = tasks.firstIndex(where: { $0.id == updated.id }) {
                tasks[index] = updated
            }
            completionFeedback[task.id] = nil
            if selectedTaskID == task.id { selectedTaskID = nil }
            syncState = .synced
        } catch let APIError.taskConflict(message, currentTask) {
            minimumHold.cancel()
            completionFeedback[task.id] = nil
            replaceTask(currentTask)
            errorMessage = message
            syncState = .error
        } catch {
            minimumHold.cancel()
            completionFeedback[task.id] = nil
            errorMessage = error.localizedDescription
            syncState = .error
        }
    }

    func save(
        _ task: TaskItem,
        title: String,
        notes: String,
        priority: TaskPriority,
        dueAt: Date?,
        alarmAt: Date?,
        listId: UUID
    ) async {
        if task.source == .shortcut {
            await update(
                task,
                input: UpdateTaskInput(notes: notes, listId: listId, alarmAt: .some(alarmAt))
            )
            if let alarmAt {
                await TaskAlarmNotificationService.shared.requestAndSchedule(task: task, at: alarmAt)
            }
            return
        }
        await update(
            task,
            input: UpdateTaskInput(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                notes: notes,
                priority: priority,
                dueAt: .some(dueAt),
                listId: listId,
                alarmAt: .some(alarmAt)
            )
        )
        if let alarmAt {
            await TaskAlarmNotificationService.shared.requestAndSchedule(task: task, at: alarmAt)
        }
    }

    func setAlarm(_ task: TaskItem, at date: Date) async {
        await update(task, input: UpdateTaskInput(alarmAt: .some(date)))
        if let refreshed = tasks.first(where: { $0.id == task.id }) {
            await TaskAlarmNotificationService.shared.requestAndSchedule(task: refreshed, at: date)
        }
    }

    func clearAlarm(_ task: TaskItem) async {
        await update(task, input: UpdateTaskInput(clearAlarm: true))
        await TaskAlarmNotificationService.shared.cancel(taskID: task.id)
    }

    func delete(_ task: TaskItem) async {
        guard task.source != .shortcut else { return }
        do {
            try await api.deleteTask(id: task.id)
            tasks.removeAll { $0.id == task.id }
            selectedTaskID = nil
            syncState = .synced
        } catch {
            errorMessage = error.localizedDescription
            syncState = .error
        }
    }

    func toggleStar(_ task: TaskItem) async {
        do {
            replaceTask(try await atomicUpdate(task, input: UpdateTaskInput(isStarred: !task.isStarred)))
            syncState = .synced
        } catch {
            errorMessage = error.localizedDescription
            syncState = .error
        }
    }

    func toggleShortcutBoardStar(_ story: ShortcutBoardStory) async {
        let isStarred = !story.isStarred
        guard let index = shortcutBoardStories.firstIndex(where: { $0.externalReference == story.externalReference }) else { return }
        shortcutBoardStories[index].isStarred = isStarred

        do {
            try await api.setShortcutBoardStar(
                externalReference: story.externalReference,
                isStarred: isStarred
            )
        } catch {
            if let currentIndex = shortcutBoardStories.firstIndex(where: {
                $0.externalReference == story.externalReference
            }) {
                shortcutBoardStories[currentIndex].isStarred = story.isStarred
            }
            errorMessage = error.localizedDescription
        }
    }

    private func update(_ task: TaskItem, input: UpdateTaskInput) async {
        do {
            let updated = try await api.updateTask(id: task.id, input: guarded(input, for: task))
            replaceTask(updated)
            syncState = .synced
        } catch let APIError.taskConflict(message, currentTask) {
            replaceTask(currentTask)
            errorMessage = message
            syncState = .error
        } catch {
            errorMessage = error.localizedDescription
            syncState = .error
        }
    }

    private func guarded(_ input: UpdateTaskInput, for task: TaskItem) -> UpdateTaskInput {
        var guardedInput = input
        guardedInput.expectedUpdatedAt = task.updateToken
        return guardedInput
    }

    private func atomicUpdate(_ task: TaskItem, input: UpdateTaskInput) async throws -> TaskItem {
        do {
            return try await api.updateTask(id: task.id, input: guarded(input, for: task))
        } catch let APIError.taskConflict(_, currentTask) {
            return try await ConnectionContext.$retry.withValue(true) {
                try await api.updateTask(id: task.id, input: guarded(input, for: currentTask))
            }
        }
    }

    private func replaceTask(_ task: TaskItem) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = task
        }
        Task { await TaskAlarmNotificationService.shared.sync(tasks: [task]) }
    }

    private func restoreSession() async {
        do {
            installation = try await api.installation()
            guard installation.authenticationMode == "none" || api.hasStoredSession() else {
                authenticationState = .signedOut
                return
            }
            try await api.validateSession()
        } catch {
            errorMessage = error.localizedDescription
            authenticationState = .signedOut
            return
        }

        authenticationState = .signedIn
        await refresh()
    }
}

enum TaskRefreshPolicy {
    static let visibleTaskInterval = Duration.seconds(30)
    static let idleTaskInterval = Duration.seconds(300)
    static let fullRefreshEveryTicks = 10
    static let shortcutBoardEveryTicks = 4
    static let reviewSummaryInterval: TimeInterval = 15 * 60
    static let reviewWatchInterval = Duration.seconds(5)
    static let reviewWatchMaximumAttempts = 24

    static func interval(isTaskSurfaceVisible: Bool, unchangedPolls: Int = 0) -> Duration {
        guard isTaskSurfaceVisible else { return idleTaskInterval }
        switch unchangedPolls {
        case ...0: return visibleTaskInterval
        case 1: return .seconds(60)
        case 2: return .seconds(120)
        default: return .seconds(600)
        }
    }

    static func shouldRefreshTasks(isTaskSurfaceVisible: Bool) -> Bool {
        isTaskSurfaceVisible
    }

    static func includesLists(at tick: Int, unchangedPolls: Int = 0) -> Bool {
        unchangedPolls >= 3 || tick.isMultiple(of: fullRefreshEveryTicks)
    }

    static func includesShortcutBoard(at tick: Int, unchangedPolls: Int = 0) -> Bool {
        unchangedPolls >= 3 || tick.isMultiple(of: shortcutBoardEveryTicks)
    }

    static func shouldRefreshReviewSummary(
        lastRefreshAt: Date?,
        isReviewWatchActive: Bool = false,
        now: Date
    ) -> Bool {
        guard let lastRefreshAt else { return true }
        let interval = isReviewWatchActive
            ? TimeInterval(reviewWatchInterval.components.seconds)
            : reviewSummaryInterval
        return now.timeIntervalSince(lastRefreshAt) >= interval
    }
}

enum TaskSnapshotMerge {
    static func openTasks(
        current: [TaskItem],
        refreshed: [TaskItem],
        pendingCompletionIDs: Set<UUID>
    ) -> [TaskItem] {
        let currentByID = Dictionary(uniqueKeysWithValues: current.map { ($0.id, $0) })
        let refreshedIDs = Set(refreshed.map(\.id))
        let refreshedOpen = refreshed.map { task in
            pendingCompletionIDs.contains(task.id) ? currentByID[task.id] ?? task : task
        }
        let pendingOpen = current.filter {
            $0.status == .open
                && pendingCompletionIDs.contains($0.id)
                && !refreshedIDs.contains($0.id)
        }
        let history = current.filter { $0.status != .open && !refreshedIDs.contains($0.id) }

        return refreshedOpen + pendingOpen + history
    }
}

enum TaskSmartView: String, CaseIterable, Identifiable {
    case inbox
    case today
    case upcoming
    case overdue
    case all
    case starred
    case recent
    case completed
    case archived

    var id: String { rawValue }

    var title: String {
        switch self {
        case .inbox: "Inbox"
        case .today: "Today"
        case .upcoming: "Upcoming"
        case .overdue: "Overdue"
        case .all: "All"
        case .starred: "Starred"
        case .recent: "Recent"
        case .completed: "Completed"
        case .archived: "Archived"
        }
    }

    var systemImage: String {
        switch self {
        case .inbox: "tray"
        case .today: "calendar"
        case .upcoming: "calendar.badge.clock"
        case .overdue: "exclamationmark.triangle"
        case .all: "list.bullet"
        case .starred: "star"
        case .recent: "clock.arrow.circlepath"
        case .completed: "checkmark.circle"
        case .archived: "archivebox"
        }
    }
}

enum TaskView: Hashable {
    case smart(TaskSmartView)
    case list(UUID)
    case source(TaskSource)
}

enum TaskSortMode: String, CaseIterable, Identifiable {
    case smart, due, priority, newest
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

enum PriorityFilter: String, CaseIterable, Identifiable {
    case any, highest, high, medium, low, lowest, none
    var id: String { rawValue }
    var title: String { rawValue == "any" ? "Any priority" : rawValue.capitalized }
}

enum DueFilter: String, CaseIterable, Identifiable {
    case any, overdue, today, upcoming, none
    var id: String { rawValue }
    var title: String {
        switch self {
        case .any: "Any due date"
        case .none: "No due date"
        default: rawValue.capitalized
        }
    }
}
