import Foundation
import Testing
@testable import TodoTracker

struct MiniDashboardTimelineTests {
    @Test("Groups every open task into chronological Mini Trackr sections")
    func groupsOpenTasksChronologically() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-18T19:00:00Z"))
        let tasks = [
            task("overdue", dueAt: "2026-08-17T17:00:00Z"),
            task("today", dueAt: "2026-08-18T22:00:00Z"),
            task("tomorrow", dueAt: "2026-08-19T17:00:00Z"),
            task("later", dueAt: "2026-08-29T17:00:00Z"),
            task("undated"),
            task("completed", status: .completed),
        ]

        let sections = MiniDashboardTimeline.sections(
            for: tasks,
            starredOnly: false,
            now: now,
            calendar: calendar
        )

        #expect(sections.compactMap(\.title) == [
            "Overdue", "Today", "Tomorrow", "Later", "No due date",
        ])
        #expect(sections.flatMap(\.tasks).map(\.title).contains("completed") == false)
    }

    @Test("Star toggle filters the same chronological timeline")
    func filtersTimelineToStarredTasks() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-18T19:00:00Z"))
        let tasks = [
            task("starred today", dueAt: "2026-08-18T22:00:00Z", isStarred: true),
            task("ordinary tomorrow", dueAt: "2026-08-19T17:00:00Z"),
            task("starred undated", isStarred: true),
        ]

        let sections = MiniDashboardTimeline.sections(
            for: tasks,
            starredOnly: true,
            now: now,
            calendar: calendar
        )

        #expect(sections.compactMap(\.title) == ["Today", "No due date"])
        #expect(sections.flatMap(\.tasks).map(\.title) == ["starred today", "starred undated"])
    }

    @Test("Mini Trackr keeps Starred undated Tasks before unstarred later workflow states")
    func starredUndatedBeforeWorkflowState() {
        let tasks = [
            task("unstarred QA", source: .shortcut, workflowStateName: "QA in Staging"),
            task("starred manual", isStarred: true),
            task("starred triage", isStarred: true, source: .shortcut, workflowStateName: "Triage"),
        ]

        let sections = MiniDashboardTimeline.sections(for: tasks, starredOnly: false)
        #expect(sections.first(where: { $0.id == "undated" })?.tasks.map(\.title) == [
            "starred triage", "starred manual", "unstarred QA",
        ])
    }

    @Test("Favorite changes invalidate a retained Mini Trackr Task row")
    func refreshingFavoriteInvalidatesRenderedRow() throws {
        for dueDate in [nil, "2026-08-25T17:00:00Z"] as [String?] {
            var current = task("Task", dueAt: dueDate, source: .shortcut, workflowStateName: "Ready for Development")
            for isStarred in [true, false] {
                var refreshed = current
                refreshed.isStarred = isStarred
                let merged = TaskSnapshotMerge.openTasks(
                    current: [current], refreshed: [refreshed], pendingCompletionIDs: []
                )
                let rendered = try #require(MiniDashboardTimeline.sections(
                    for: merged, starredOnly: false
                ).flatMap(\.tasks).first)

                #expect(rendered.id == current.id)
                #expect(rendered.dueAt == current.dueAt)
                #expect(rendered.isStarred == isStarred)
                #expect(rendered.presentationIdentity != current.presentationIdentity)
                #expect(MiniDashboardTimeline.sections(for: merged, starredOnly: true)
                    .flatMap(\.tasks).map(\.id) == (isStarred ? [current.id] : []))
                current = rendered
            }
        }
    }

    @Test("An unchanged favorite preserves Mini Trackr row identity")
    func unchangedFavoritePreservesRenderedRow() {
        let original = task("Task", isStarred: true)
        var refreshed = original
        refreshed.updatedAt = original.updatedAt.addingTimeInterval(60)
        #expect(refreshed.presentationIdentity == original.presentationIdentity)
    }

    @Test("Refreshing a due date invalidates the rendered Task row")
    func refreshingDueDateInvalidatesRenderedRow() {
        let id = UUID()
        let undated = task("Task", id: id)
        let dated = task("Task", id: id, dueAt: "2026-08-25T17:00:00Z")

        #expect(undated.id == dated.id)
        #expect(undated.presentationIdentity != dated.presentationIdentity)
    }

    @Test("Refreshing a Shortcut workflow state invalidates the rendered Task row")
    func refreshingWorkflowStateInvalidatesRenderedRow() throws {
        for (oldState, newState) in [("Ready for Development", "In Progress"), ("In Progress", "Pending Eng")] {
            let before = task("Quick View", source: .shortcut, workflowStateName: oldState)
            let details = try #require(before.sourceDetails)
            var refreshed = before
            refreshed.sourceDetails = TaskSourceDetails(
                externalReference: details.externalReference,
                summary: details.summary,
                size: details.size,
                workflowStateName: newState
            )
            let merged = TaskSnapshotMerge.openTasks(
                current: [before], refreshed: [refreshed], pendingCompletionIDs: []
            )
            let rendered = try #require(MiniDashboardTimeline.sections(
                for: merged, starredOnly: false
            ).flatMap(\.tasks).first)

            #expect(rendered.id == before.id)
            #expect(rendered.status == .open)
            #expect(rendered.dueAt == before.dueAt)
            #expect(rendered.sourceDetails?.workflowStateName == newState)
            #expect(rendered.presentationIdentity != before.presentationIdentity)
            #expect(rendered.presentationIdentity == refreshed.presentationIdentity)
        }
    }

    private func task(
        _ title: String,
        id: UUID = UUID(),
        dueAt dueAtValue: String? = nil,
        status: TaskStatus = .open,
        isStarred: Bool = false,
        source: TaskSource = .manual,
        workflowStateName: String? = nil
    ) -> TaskItem {
        let formatter = ISO8601DateFormatter()
        let createdAt = formatter.date(from: "2026-08-18T10:00:00-07:00")!
        return TaskItem(
            id: id,
            title: title,
            notes: "",
            status: status,
            priority: .none,
            dueAt: dueAtValue.flatMap(formatter.date(from:)),
            sortOrder: 0,
            createdAt: createdAt,
            updatedAt: createdAt,
            completedAt: status == .completed ? createdAt : nil,
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
