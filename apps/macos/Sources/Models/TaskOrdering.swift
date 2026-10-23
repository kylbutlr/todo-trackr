import Foundation

enum ShortcutWorkflowOrder {
    // Engineering workflow order verified in Shortcut on 2026-09-27.
    private static let states = [
        "Backlog", "Triage", "Triage In Progress", "Ready for Pickup",
        "Ready for LOE", "Ready for Development", "Engineering Triage",
        "In Progress", "Pending Ops", "Pending Eng", "Pending Client",
        "Agentic QA", "QA In Progress", "Engineering Review", "CSM Review",
        "QA in Staging", "Production Approved", "Deployed", "Completed",
    ]
    private static let ranks = Dictionary(uniqueKeysWithValues: states.enumerated().map { ($0.element, $0.offset) })

    static func rank(_ state: String?) -> Int {
        guard let state else { return -1 }
        return ranks[state] ?? -1
    }
}

enum TaskOrdering {
    static func smartPrecedes(
        _ left: TaskItem,
        _ right: TaskItem,
        now: Date = .now,
        calendar: Calendar = .current
    ) -> Bool {
        let priorityRank: [TaskPriority: Int] = [
            .highest: 0,
            .high: 1,
            .medium: 2,
            .low: 3,
            .lowest: 4,
            .none: 5,
        ]

        let leftDueRank = dueRank(left, now: now, calendar: calendar)
        let rightDueRank = dueRank(right, now: now, calendar: calendar)
        if leftDueRank != rightDueRank {
            return leftDueRank < rightDueRank
        }

        if leftDueRank == 2 {
            let leftKey = (
                left.dueAt ?? .distantFuture,
                left.isStarred ? 0 : 1,
                priorityRank[left.priority] ?? 5
            )
            let rightKey = (
                right.dueAt ?? .distantFuture,
                right.isStarred ? 0 : 1,
                priorityRank[right.priority] ?? 5
            )
            if leftKey != rightKey { return leftKey < rightKey }
            return finalTieBreakPrecedes(left, right)
        }

        let leftKey = (
            left.isStarred ? 0 : 1,
            priorityRank[left.priority] ?? 5,
            left.dueAt ?? .distantFuture
        )
        let rightKey = (
            right.isStarred ? 0 : 1,
            priorityRank[right.priority] ?? 5,
            right.dueAt ?? .distantFuture
        )
        if leftKey != rightKey { return leftKey < rightKey }
        return finalTieBreakPrecedes(left, right)
    }

    static func finalTieBreakPrecedes(_ left: TaskItem, _ right: TaskItem) -> Bool {
        if let shortcutComparison = shortcutIDComparison(left, right), shortcutComparison != 0 {
            return shortcutComparison < 0
        }
        if left.createdAt != right.createdAt {
            return left.createdAt > right.createdAt
        }
        return left.id.uuidString < right.id.uuidString
    }

    private static func shortcutIDComparison(_ left: TaskItem, _ right: TaskItem) -> Int? {
        // Refresh timestamps are not a stable order for imported Shortcut work.
        guard left.source == .shortcut,
              right.source == .shortcut,
              let leftReference = left.sourceDetails?.externalReference.trimmingCharacters(in: .whitespacesAndNewlines),
              let rightReference = right.sourceDetails?.externalReference.trimmingCharacters(in: .whitespacesAndNewlines),
              !leftReference.isEmpty,
              !rightReference.isEmpty else {
            return nil
        }

        if let leftID = Int(leftReference), let rightID = Int(rightReference), leftID != rightID {
            return leftID < rightID ? -1 : 1
        }

        let comparison = leftReference.localizedStandardCompare(rightReference)
        if comparison == .orderedAscending { return -1 }
        if comparison == .orderedDescending { return 1 }
        return 0
    }

    private static func dueRank(_ task: TaskItem, now: Date, calendar: Calendar) -> Int {
        guard let dueAt = task.dueAt else { return 3 }
        let startToday = calendar.startOfDay(for: now)
        let startTomorrow = calendar.date(byAdding: .day, value: 1, to: startToday)!
        if dueAt < startToday { return 0 }
        if dueAt < startTomorrow { return 1 }
        return 2
    }
}

struct TaskListSection: Identifiable, Equatable {
    let id: String
    let title: String?
    var tasks: [TaskItem]
}

enum TaskGrouping {
    static func sections(
        for tasks: [TaskItem],
        view: TaskView,
        now: Date = .now,
        calendar: Calendar = .current
    ) -> [TaskListSection] {
        if view == .smart(.completed) || view == .smart(.archived) {
            return [TaskListSection(id: "tasks", title: nil, tasks: tasks)]
        }

        if view == .smart(.recent) {
            let sorted = tasks.sorted { $0.createdAt > $1.createdAt }
            let startToday = calendar.startOfDay(for: now)
            let startYesterday = calendar.date(byAdding: .day, value: -1, to: startToday)!
            var sections: [TaskListSection] = []
            for task in sorted {
                let day = calendar.startOfDay(for: task.createdAt)
                let id = calendarKey(day, calendar: calendar)
                let title: String
                if calendar.isDate(task.createdAt, inSameDayAs: startToday) {
                    title = "Today"
                } else if calendar.isDate(task.createdAt, inSameDayAs: startYesterday) {
                    title = "Yesterday"
                } else {
                    title = task.createdAt.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
                }
                append(task, id: id, title: title, to: &sections)
            }
            return sections
        }

        let startToday = calendar.startOfDay(for: now)
        let startTomorrow = calendar.date(byAdding: .day, value: 1, to: startToday)!
        let afterTomorrow = calendar.date(byAdding: .day, value: 2, to: startToday)!
        let laterBoundary = calendar.date(byAdding: .day, value: 7, to: startToday)!
        var sections: [TaskListSection] = []
        for task in tasks {
            let id: String
            let title: String
            if let dueAt = task.dueAt {
                if dueAt < startToday {
                    (id, title) = ("overdue", "Overdue")
                } else if dueAt < startTomorrow {
                    (id, title) = ("today", "Today")
                } else if dueAt < afterTomorrow {
                    (id, title) = ("tomorrow", "Tomorrow")
                } else if dueAt < laterBoundary {
                    let day = calendar.startOfDay(for: dueAt)
                    id = calendarKey(day, calendar: calendar)
                    title = dueAt.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
                } else {
                    (id, title) = ("later", "Later")
                }
            } else {
                (id, title) = ("undated", "No due date")
            }
            append(task, id: id, title: title, to: &sections)
        }
        if let index = sections.firstIndex(where: { $0.id == "undated" }) {
            sections[index].tasks = sections[index].tasks.enumerated().sorted { left, right in
                if left.element.isStarred != right.element.isStarred {
                    return left.element.isStarred
                }
                let leftRank = ShortcutWorkflowOrder.rank(
                    left.element.source == .shortcut ? left.element.sourceDetails?.workflowStateName : nil
                )
                let rightRank = ShortcutWorkflowOrder.rank(
                    right.element.source == .shortcut ? right.element.sourceDetails?.workflowStateName : nil
                )
                return leftRank == rightRank ? left.offset < right.offset : leftRank > rightRank
            }.map { $0.element }
        }
        let byID = Dictionary(uniqueKeysWithValues: sections.map { ($0.id, $0) })
        let dated = sections
            .filter { $0.id.first?.isNumber == true }
            .sorted { $0.id < $1.id }
        return ["overdue", "today", "tomorrow"]
            .compactMap { byID[$0] }
            + dated
            + ["later", "undated"].compactMap { byID[$0] }
    }

    private static func append(
        _ task: TaskItem,
        id: String,
        title: String,
        to sections: inout [TaskListSection]
    ) {
        if let index = sections.firstIndex(where: { $0.id == id }) {
            sections[index].tasks.append(task)
        } else {
            sections.append(TaskListSection(id: id, title: title, tasks: [task]))
        }
    }

    private static func calendarKey(_ date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
    }
}
