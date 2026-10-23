import Foundation
import Testing
@testable import TodoTracker

struct TaskSnapshotMergeTests {
    @Test("Open snapshots replace open Tasks while retaining history")
    func mergesOpenSnapshot() {
        let retainedHistory = task(status: .completed)
        let removedOpenTask = task(status: .open)
        let refreshedOpenTask = task(status: .open)

        let result = TaskSnapshotMerge.openTasks(
            current: [retainedHistory, removedOpenTask],
            refreshed: [refreshedOpenTask],
            pendingCompletionIDs: []
        )

        #expect(result.contains(where: { $0.id == retainedHistory.id }))
        #expect(!result.contains(where: { $0.id == removedOpenTask.id }))
        #expect(result.contains(where: { $0.id == refreshedOpenTask.id }))
    }

    @Test("Open snapshots preserve Tasks during completion feedback")
    func preservesPendingCompletion() {
        let pending = task(status: .open)

        let result = TaskSnapshotMerge.openTasks(
            current: [pending],
            refreshed: [],
            pendingCompletionIDs: [pending.id]
        )

        #expect(result == [pending])
    }

    @Test("Open snapshots replace a historical copy when a Task reopens")
    func replacesHistoricalCopy() {
        let id = UUID()
        let historical = task(id: id, status: .completed)
        let reopened = task(id: id, status: .open)

        let result = TaskSnapshotMerge.openTasks(
            current: [historical],
            refreshed: [reopened],
            pendingCompletionIDs: []
        )

        #expect(result == [reopened])
    }

    private func task(id: UUID = UUID(), status: TaskStatus) -> TaskItem {
        TaskItem(
            id: id,
            title: "Task",
            notes: "",
            status: status,
            priority: .none,
            dueAt: nil,
            sortOrder: 0,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            updatedAt: Date(timeIntervalSince1970: 1_700_000_000),
            completedAt: status == .completed ? Date(timeIntervalSince1970: 1_700_000_100) : nil,
            archivedAt: nil,
            isStarred: false,
            listId: UUID(),
            source: .manual,
            sourceUrl: nil,
            sourceDetails: nil
        )
    }
}
