import Foundation

enum MiniDashboardTimeline {
    static func sections(
        for tasks: [TaskItem],
        starredOnly: Bool,
        now: Date = .now,
        calendar: Calendar = .current
    ) -> [TaskListSection] {
        let visibleTasks = tasks
            .filter { task in
                task.status == .open && (!starredOnly || task.isStarred)
            }
            .sorted {
                TaskOrdering.smartPrecedes($0, $1, now: now, calendar: calendar)
            }

        return TaskGrouping.sections(
            for: visibleTasks,
            view: .smart(.all),
            now: now,
            calendar: calendar
        )
    }
}
