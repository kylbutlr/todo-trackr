import Foundation

struct TaskEditorDraft: Equatable {
    var title: String
    var notes: String
    var priority: TaskPriority
    var hasDueDate: Bool
    var dueAt: Date
    var hasAlarm: Bool
    var alarmAt: Date
    var listId: UUID

    init(task: TaskItem) {
        title = task.title
        notes = task.notes
        priority = task.priority
        hasDueDate = task.dueAt != nil
        dueAt = task.dueAt ?? .now
        hasAlarm = task.alarmAt != nil && task.alarmClearedAt == nil
        alarmAt = task.alarmAt ?? Date.now.addingTimeInterval(60 * 60)
        listId = task.listId
    }

    func reconciling(_ refreshedTask: TaskItem, baseline: TaskEditorDraft) -> TaskEditorDraft {
        self == baseline ? TaskEditorDraft(task: refreshedTask) : self
    }
}
