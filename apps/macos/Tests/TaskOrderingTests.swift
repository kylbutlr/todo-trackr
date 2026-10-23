import Foundation
import Testing
@testable import TodoTracker

struct TaskOrderingTests {
    @Test("Keeps a muted Release due tomorrow ahead of undated work")
    func dueReleasePrecedesUndatedTask() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        let tomorrow = try #require(ISO8601DateFormatter().date(from: "2026-08-18T00:00:00Z"))
        let release = task(
            title: "Glossier Release: 8/17",
            priority: .highest,
            dueAt: tomorrow,
            source: .shortcut
        )
        let undated = task(title: "Reply to client", priority: .low)

        #expect(TaskOrdering.smartPrecedes(release, undated, now: now, calendar: calendar))
        #expect(!TaskOrdering.smartPrecedes(undated, release, now: now, calendar: calendar))
    }

    @Test("Keeps Release muting visual without overriding priority")
    func releasePriorityStillSortsNormally() {
        let release = task(
            title: "Ramy Brook Release: 8/19",
            priority: .highest,
            source: .shortcut
        )
        let actionable = task(title: "Reply to client", priority: .low)

        #expect(TaskOrdering.smartPrecedes(release, actionable))
        #expect(!TaskOrdering.smartPrecedes(actionable, release))
    }

    @Test("Sorts Upcoming tasks by exact due date before priority")
    func upcomingUsesDueDateBeforePriority() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        let tomorrow = try #require(ISO8601DateFormatter().date(from: "2026-08-18T17:00:00Z"))
        let nextWeek = try #require(ISO8601DateFormatter().date(from: "2026-08-24T17:00:00Z"))
        let dueTomorrow = task(title: "Medium due tomorrow", priority: .medium, dueAt: tomorrow)
        let dueNextWeek = task(title: "Highest due next week", priority: .highest, dueAt: nextWeek)

        #expect(TaskOrdering.smartPrecedes(dueTomorrow, dueNextWeek, now: now, calendar: calendar))
        #expect(!TaskOrdering.smartPrecedes(dueNextWeek, dueTomorrow, now: now, calendar: calendar))
    }

    @Test("Keeps priority ahead of exact time for Today tasks")
    func todayUsesPriorityBeforeDueTime() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        let earlier = try #require(ISO8601DateFormatter().date(from: "2026-08-17T01:00:00Z"))
        let later = try #require(ISO8601DateFormatter().date(from: "2026-08-17T05:00:00Z"))
        let earlierLow = task(title: "Earlier today", priority: .low, dueAt: earlier)
        let laterHigh = task(title: "Later today", priority: .high, dueAt: later)

        #expect(TaskOrdering.smartPrecedes(laterHigh, earlierLow, now: now, calendar: calendar))
        #expect(!TaskOrdering.smartPrecedes(earlierLow, laterHigh, now: now, calendar: calendar))
    }

    @Test("Keeps priority ahead of exact date for Overdue tasks")
    func overdueUsesPriorityBeforeDueDate() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        let older = try #require(ISO8601DateFormatter().date(from: "2026-08-14T17:00:00Z"))
        let newer = try #require(ISO8601DateFormatter().date(from: "2026-08-15T17:00:00Z"))
        let olderLow = task(title: "Older overdue", priority: .low, dueAt: older)
        let newerHigh = task(title: "Newer overdue", priority: .high, dueAt: newer)

        #expect(TaskOrdering.smartPrecedes(newerHigh, olderLow, now: now, calendar: calendar))
        #expect(!TaskOrdering.smartPrecedes(olderLow, newerHigh, now: now, calendar: calendar))
    }

    @Test("Uses Starred within a due group without overriding a nearer Upcoming date")
    func starredFocusRespectsUpcomingDates() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-16T19:00:00Z"))
        let tomorrow = try #require(ISO8601DateFormatter().date(from: "2026-08-18T17:00:00Z"))
        let nextWeek = try #require(ISO8601DateFormatter().date(from: "2026-08-24T17:00:00Z"))
        let nearer = task(title: "Tomorrow", priority: .none, dueAt: tomorrow)
        let starredLater = task(title: "Next week", priority: .highest, dueAt: nextWeek, isStarred: true)

        #expect(TaskOrdering.smartPrecedes(nearer, starredLater, now: now, calendar: calendar))
        #expect(!TaskOrdering.smartPrecedes(starredLater, nearer, now: now, calendar: calendar))
    }

    @Test("Uses Starred ahead of priority within the same due group")
    func starredFocusPrecedesPriority() {
        let starredLow = task(title: "Starred", priority: .low, isStarred: true)
        let unstarredHighest = task(title: "Unstarred", priority: .highest)

        #expect(TaskOrdering.smartPrecedes(starredLow, unstarredHighest))
        #expect(!TaskOrdering.smartPrecedes(unstarredHighest, starredLow))
    }

    @Test("Uses numeric Shortcut ID as the final tie-breaker in Mini Trackr")
    func shortcutIDTieBreaker() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Los_Angeles"))
        let now = try #require(ISO8601DateFormatter().date(from: "2026-09-06T19:00:00Z"))
        let due = try #require(ISO8601DateFormatter().date(from: "2026-09-09T17:00:00Z"))
        let stories = [
            task(title: "Gate Landing Page", priority: .medium, dueAt: due, source: .shortcut, externalReference: "495541", createdAt: Date(timeIntervalSince1970: 1_700_001_000)),
            task(title: "3-Up and 4-Up", priority: .medium, dueAt: due, source: .shortcut, externalReference: "495542", createdAt: Date(timeIntervalSince1970: 1_700_002_000)),
            task(title: "Muse Module", priority: .medium, dueAt: due, source: .shortcut, externalReference: "495540", createdAt: Date(timeIntervalSince1970: 1_700_003_000)),
        ]

        let sections = MiniDashboardTimeline.sections(
            for: stories,
            starredOnly: false,
            now: now,
            calendar: calendar
        )

        #expect(sections.flatMap(\.tasks).compactMap { $0.sourceDetails?.externalReference } == [
            "495540", "495541", "495542",
        ])
    }

    private func task(
        title: String,
        priority: TaskPriority,
        dueAt: Date? = nil,
        source: TaskSource = .manual,
        isStarred: Bool = false,
        externalReference: String = "490785",
        createdAt: Date = Date(timeIntervalSince1970: 1_700_000_000)
    ) -> TaskItem {
        TaskItem(
            id: UUID(),
            title: title,
            notes: "",
            status: .open,
            priority: priority,
            dueAt: dueAt,
            sortOrder: 0,
            createdAt: createdAt,
            updatedAt: createdAt,
            completedAt: nil,
            archivedAt: nil,
            isStarred: isStarred,
            listId: UUID(),
            source: source,
            sourceUrl: nil,
            sourceDetails: source == .shortcut
                ? TaskSourceDetails(
                    externalReference: externalReference,
                    summary: "Approved Tickets: sc-486390",
                    size: nil,
                    workflowStateName: "Ready for LOE"
                )
                : nil
        )
    }
}
