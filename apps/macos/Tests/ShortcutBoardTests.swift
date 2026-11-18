import Foundation
import Testing
@testable import TodoTracker

@Suite("Shortcut Board")
struct ShortcutBoardTests {
    @Test("Supports Owner, Requester, both, and either scopes")
    func scopes() {
        let owner = story(reference: "1", matchesOwner: true, matchesRequester: false)
        let requester = story(reference: "2", matchesOwner: false, matchesRequester: true)
        let both = story(reference: "3", matchesOwner: true, matchesRequester: true)
        let stories = [owner, requester, both]

        #expect(ShortcutBoardGrouping.visibleStories(stories, scope: .owner).map(\.id) == ["1", "3"])
        #expect(ShortcutBoardGrouping.visibleStories(stories, scope: .requester).map(\.id) == ["2", "3"])
        #expect(ShortcutBoardGrouping.visibleStories(stories, scope: .both).map(\.id) == ["3"])
        #expect(ShortcutBoardGrouping.visibleStories(stories, scope: .either).map(\.id) == ["1", "2", "3"])
    }

    @Test("Groups by date and orders each date by Priority")
    func grouping() {
        let calendar = Calendar(identifier: .gregorian)
        let now = calendar.date(from: DateComponents(year: 2026, month: 8, day: 19, hour: 10))!
        let medium = story(reference: "1", priority: .medium, dueDate: "2026-08-20")
        let highest = story(reference: "2", priority: .highest, dueDate: "2026-08-20")
        let undated = story(reference: "3", priority: .high)

        let sections = ShortcutBoardGrouping.sections(for: [medium, undated, highest], now: now, calendar: calendar)

        #expect(sections.map(\.id) == ["tomorrow", "undated"])
        #expect(sections[0].stories.map(\.id) == ["2", "1"])
    }

    @Test("Uses numeric Shortcut ID as the final stable tie-breaker")
    func stableIDTieBreaker() {
        let calendar = Calendar(identifier: .gregorian)
        let now = calendar.date(from: DateComponents(year: 2026, month: 8, day: 19, hour: 10))!
        let stories = [
            story(reference: "494973", title: "Alpha", priority: .high, dueDate: "2026-08-21"),
            story(reference: "494947", title: "Zulu", priority: .high, dueDate: "2026-08-21"),
            story(reference: "494966", title: "Middle", priority: .high, dueDate: "2026-08-21"),
        ]

        let sections = ShortcutBoardGrouping.sections(for: stories, now: now, calendar: calendar)

        #expect(sections[0].stories.map(\.id) == ["494947", "494966", "494973"])
    }

    @Test("No due date puts later workflow states first while dated groups keep Priority order")
    func undatedWorkflowOrder() {
        let calendar = Calendar(identifier: .gregorian)
        let now = calendar.date(from: DateComponents(year: 2026, month: 8, day: 19, hour: 10))!
        let stories = [
            story(reference: "1", priority: .highest, workflowStateName: "Triage"),
            story(reference: "2", priority: .low, workflowStateName: "Pending Client"),
            story(reference: "3", priority: .high, workflowStateName: "Pending Eng"),
            story(reference: "4", priority: .high, workflowStateName: "Pending Client"),
            story(reference: "5", priority: .low, dueDate: "2026-08-21", workflowStateName: "Triage"),
            story(reference: "6", priority: .highest, dueDate: "2026-08-21", workflowStateName: "Pending Client"),
        ]

        let sections = ShortcutBoardGrouping.sections(for: stories, now: now, calendar: calendar)
        #expect(sections.first(where: { $0.id == "2026-08-21" })?.stories.map(\.id) == ["6", "5"])
        #expect(sections.first(where: { $0.id == "undated" })?.stories.map(\.id) == ["4", "2", "3", "1"])
    }

    @Test("No due date keeps Starred Stories ahead of every unstarred workflow state")
    func undatedStarredBeforeWorkflowState() {
        let calendar = Calendar(identifier: .gregorian)
        let now = calendar.date(from: DateComponents(year: 2026, month: 8, day: 19, hour: 10))!
        let stories = [
            story(reference: "1", workflowStateName: "QA in Staging"),
            story(reference: "2", workflowStateName: "", isStarred: true),
            story(reference: "3", workflowStateName: "Triage", isStarred: true),
            story(reference: "4", workflowStateName: "Pending Eng"),
            story(reference: "5", workflowStateName: "QA in Staging", isStarred: true),
        ]

        let sections = ShortcutBoardGrouping.sections(for: stories, now: now, calendar: calendar)
        #expect(sections.first(where: { $0.id == "undated" })?.stories.map(\.id) == ["5", "3", "2", "1", "4"])
    }

    @Test("Clearing a due date invalidates the rendered Shortcut row")
    func clearingDueDateInvalidatesRenderedRow() {
        let dated = story(reference: "490428", dueDate: "2026-08-21")
        let undated = story(reference: "490428")

        #expect(dated.id == undated.id)
        #expect(dated.presentationIdentity != undated.presentationIdentity)
        #expect(undated.parsedDueDate == nil)
    }

    private func story(
        reference: String,
        title: String? = nil,
        priority: TaskPriority = .medium,
        dueDate: String? = nil,
        matchesOwner: Bool = true,
        matchesRequester: Bool = false,
        workflowStateName: String = "In Progress",
        isStarred: Bool = false
    ) -> ShortcutBoardStory {
        ShortcutBoardStory(
            externalReference: reference,
            sourceUrl: URL(string: "https://app.shortcut.com/sdg/story/\(reference)")!,
            title: title ?? "Story \(reference)",
            priority: priority,
            size: nil,
            dueDate: dueDate,
            workflowStateName: workflowStateName,
            ownerIds: matchesOwner ? ["kyle"] : [],
            requestedById: matchesRequester ? "kyle" : nil,
            matchesOwner: matchesOwner,
            matchesRequester: matchesRequester,
            isStarred: isStarred,
            sourceUpdatedAt: nil
        )
    }
}
