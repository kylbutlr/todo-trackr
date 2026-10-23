import Foundation
import Testing
@testable import TodoTracker

struct TaskEditorDraftTests {
    @Test func cleanDraftAdoptsARefreshedTask() {
        let original = task(title: "Original")
        var refreshed = original
        refreshed.title = "Changed elsewhere"
        refreshed.updateToken = "2026-08-21T12:00:00.000001Z"

        let baseline = TaskEditorDraft(task: original)
        let result = baseline.reconciling(refreshed, baseline: baseline)

        #expect(result.title == "Changed elsewhere")
    }

    @Test func dirtyDraftSurvivesARefreshedTask() {
        let original = task(title: "Original")
        var refreshed = original
        refreshed.title = "Changed elsewhere"
        var draft = TaskEditorDraft(task: original)
        draft.title = "Work in progress"

        let result = draft.reconciling(refreshed, baseline: TaskEditorDraft(task: original))

        #expect(result.title == "Work in progress")
    }

    @Test func clearedAlarmDoesNotReturnToTheEditor() {
        var cleared = task(title: "Follow up")
        cleared.alarmAt = .now.addingTimeInterval(-60)
        cleared.alarmClearedAt = .now

        let draft = TaskEditorDraft(task: cleared)

        #expect(draft.hasAlarm == false)
    }

    @Test func firedAlarmRemainsActiveUntilCleared() {
        var alarmed = task(title: "Follow up")
        alarmed.alarmAt = .now.addingTimeInterval(-60)

        #expect(alarmed.isAlarmAttentionActive)
        alarmed.alarmClearedAt = .now
        #expect(!alarmed.isAlarmAttentionActive)
    }

    private func task(title: String) -> TaskItem {
        TaskItem(
            id: UUID(),
            title: title,
            notes: "",
            status: .open,
            priority: .none,
            dueAt: nil,
            sortOrder: 0,
            createdAt: .now,
            updatedAt: .now,
            completedAt: nil,
            archivedAt: nil,
            isStarred: false,
            listId: UUID(),
            source: .manual,
            sourceUrl: nil,
            sourceDetails: nil
        )
    }
}
