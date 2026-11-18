import Foundation
import Testing
@testable import TodoTracker

struct TaskGroupingTests {
    @Test("Groups All by due-date horizon")
    func groupsAllByDueDate() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        let tasks = [
            task("overdue", dueAt: "2026-08-15T17:00:00Z"),
            task("today", dueAt: "2026-08-17T02:00:00Z"),
            task("tomorrow", dueAt: "2026-08-17T17:00:00Z"),
            task("weekday", dueAt: "2026-08-19T17:00:00Z"),
            task("later", dueAt: "2026-08-28T17:00:00Z"),
            task("undated"),
        ]

        let sections = TaskGrouping.sections(for: tasks, view: .smart(.all), now: now, calendar: calendar)
        #expect(sections.compactMap(\.title) == [
            "Overdue", "Today", "Tomorrow", "Wednesday, Aug 19", "Later", "No due date",
        ])
    }

    @Test("Groups open workspaces by due-date horizon")
    func groupsOpenWorkspacesByDueDate() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        let tasks = [
            task("today", dueAt: "2026-08-17T02:00:00Z"),
            task("undated"),
        ]

        for view in [TaskView.smart(.inbox), .smart(.starred), .list(UUID()), .source(.shortcut)] {
            let sections = TaskGrouping.sections(for: tasks, view: view, now: now, calendar: calendar)
            #expect(sections.compactMap(\.title) == ["Today", "No due date"])
        }
    }

    @Test("Keeps Completed and Archived as ungrouped history")
    func keepsHistoryUngrouped() throws {
        let tasks = [task("done"), task("older")]

        for view in [TaskView.smart(.completed), .smart(.archived)] {
            let sections = TaskGrouping.sections(for: tasks, view: view)
            #expect(sections.map(\.id) == ["tasks"])
            #expect(sections.compactMap(\.title).isEmpty)
        }
    }

    @Test("No due date puts later Shortcut workflow states first without reordering dated Tasks")
    func undatedShortcutWorkflowOrder() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        let tasks = [
            task("triage", source: .shortcut, workflowStateName: "Triage"),
            task("manual"),
            task("qa", source: .shortcut, workflowStateName: "QA in Staging"),
            task("pending-eng", source: .shortcut, workflowStateName: "Pending Eng"),
            task("unknown", source: .shortcut, workflowStateName: "Unknown state"),
            task("dated-triage", dueAt: "2026-08-17T02:00:00Z", source: .shortcut, workflowStateName: "Triage"),
            task("dated-qa", dueAt: "2026-08-17T02:00:00Z", source: .shortcut, workflowStateName: "QA in Staging"),
        ]

        let sections = TaskGrouping.sections(for: tasks, view: .smart(.all), now: now, calendar: calendar)
        #expect(sections.first(where: { $0.id == "today" })?.tasks.map(\.title) == ["dated-triage", "dated-qa"])
        #expect(sections.first(where: { $0.id == "undated" })?.tasks.map(\.title) == [
            "qa", "pending-eng", "triage", "manual", "unknown",
        ])
    }

    @Test("No due date keeps Starred Tasks ahead of every unstarred workflow state")
    func undatedStarredBeforeWorkflowState() throws {
        let tasks = [
            task("unstarred-qa", source: .shortcut, workflowStateName: "QA in Staging"),
            task("starred-manual", isStarred: true),
            task("starred-triage", source: .shortcut, workflowStateName: "Triage", isStarred: true),
            task("unstarred-eng", source: .shortcut, workflowStateName: "Pending Eng"),
            task("starred-qa", source: .shortcut, workflowStateName: "QA in Staging", isStarred: true),
        ]

        let sections = TaskGrouping.sections(for: tasks, view: .smart(.all))
        #expect(sections.first(where: { $0.id == "undated" })?.tasks.map(\.title) == [
            "starred-qa", "starred-triage", "starred-manual", "unstarred-qa", "unstarred-eng",
        ])
    }

    @Test("Groups Recent newest first across lifecycle states")
    func groupsRecent() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        var yesterday = task("yesterday", createdAt: "2026-08-15T18:00:00-07:00")
        yesterday.status = .completed
        let todayOld = task("today-old", createdAt: "2026-08-16T08:00:00-07:00")
        let todayNew = task("today-new", createdAt: "2026-08-16T11:00:00-07:00")

        let sections = TaskGrouping.sections(
            for: [yesterday, todayOld, todayNew],
            view: .smart(.recent),
            now: now,
            calendar: calendar
        )
        #expect(sections.compactMap(\.title) == ["Today", "Yesterday"])
        #expect(sections[0].tasks.map(\.title) == ["today-new", "today-old"])
    }

    private func task(
        _ title: String,
        dueAt dueAtValue: String? = nil,
        createdAt createdAtValue: String = "2026-08-16T10:00:00-07:00",
        source: TaskSource = .manual,
        workflowStateName: String? = nil,
        isStarred: Bool = false
    ) -> TaskItem {
        let formatter = ISO8601DateFormatter()
        return TaskItem(
            id: UUID(),
            title: title,
            notes: "",
            status: .open,
            priority: .none,
            dueAt: dueAtValue.flatMap(formatter.date(from:)),
            sortOrder: 0,
            createdAt: formatter.date(from: createdAtValue)!,
            updatedAt: formatter.date(from: createdAtValue)!,
            completedAt: nil,
            archivedAt: nil,
            isStarred: isStarred,
            listId: UUID(),
            source: source,
            sourceUrl: nil,
            sourceDetails: source == .shortcut
                ? TaskSourceDetails(externalReference: title, summary: nil, size: nil, workflowStateName: workflowStateName)
                : nil
        )
    }
}
