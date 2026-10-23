import Foundation
import Combine

/// One schedule and one in-flight request shared by both windows and manual refresh.
@MainActor
final class ShortcutSyncSchedule: ObservableObject {
    enum Outcome: Equatable {
        case synced
        case ignored
        case failed(String)
    }

    static let preferenceKey = "todo-trackr.shortcut-sync-minutes"
    static let intervals = [0, 1, 5, 15, 30, 60]
    @Published private(set) var minutes: Int
    @Published private(set) var nextSyncAt: Date?
    @Published private(set) var lastSuccessAt: Date?
    @Published private(set) var outcome: Outcome?
    @Published private(set) var isSyncing = false
    private let defaults: UserDefaults
    private let now: () -> Date
    private var request: Task<Outcome, Never>?

    init(defaults: UserDefaults = .standard, now: @escaping () -> Date = Date.init) {
        self.defaults = defaults
        self.now = now
        let saved = defaults.object(forKey: Self.preferenceKey) as? Int ?? 60
        minutes = Self.intervals.contains(saved) ? saved : 60
        nextSyncAt = minutes == 0 ? nil : now().addingTimeInterval(Double(minutes * 60))
    }

    func setMinutes(_ value: Int) {
        guard Self.intervals.contains(value) else { return }
        minutes = value
        defaults.set(value, forKey: Self.preferenceKey)
        scheduleNext()
    }

    func syncIfDue(isVisible: Bool, isSignedIn: Bool, operation: @escaping @MainActor () async -> Outcome) async {
        guard isVisible, isSignedIn, minutes > 0, !isSyncing,
              let nextSyncAt, now() >= nextSyncAt else { return }
        _ = await syncNow(operation: operation)
    }

    @discardableResult
    func syncNow(operation: @escaping @MainActor () async -> Outcome) async -> Outcome {
        if let request { return await request.value }
        isSyncing = true
        let task = Task { await operation() }
        request = task
        let result = await task.value
        outcome = result
        if result == .synced { lastSuccessAt = now() }
        request = nil
        isSyncing = false
        // Failed/ignored attempts wait a full interval too. No rapid retry loop.
        scheduleNext()
        return result
    }

    func status(at date: Date, isVisible: Bool, isSignedIn: Bool) -> String {
        guard isSignedIn else { return "Sign in to sync" }
        if isSyncing { return "Syncing Shortcut…" }
        guard minutes > 0, let nextSyncAt else { return "Automatic sync off on this Mac" }
        guard isVisible else { return "Paused while task windows are hidden" }
        let seconds = max(0, Int(ceil(nextSyncAt.timeIntervalSince(date))))
        if seconds == 0 { return "Manual sync required" }
        let countdown = String(format: "%d:%02d", seconds / 60, seconds % 60)
        if case .failed = outcome { return "Retry in \(countdown)" }
        return "Next sync in \(countdown)"
    }

    private func scheduleNext() {
        nextSyncAt = minutes == 0 ? nil : now().addingTimeInterval(Double(minutes * 60))
    }
}
