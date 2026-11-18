import Foundation
import Testing
@testable import TodoTracker

struct TaskClassificationTests {
    @Test("Treats sparse linked Shortcut Release tickets as background work")
    func recognizesRelease() {
        #expect(task().isBackgroundRelease)
        #expect(task(summary: nil).isBackgroundRelease)
    }

    @Test("Does not dim ordinary or substantial implementation tickets")
    func ignoresActionableWork() {
        #expect(!task(title: "Prepare launch checklist").isBackgroundRelease)
        #expect(!task(source: .manual).isBackgroundRelease)
        #expect(!task(summary: String(repeating: "Substantial implementation and ownership details. ", count: 12)).isBackgroundRelease)
    }

    private func task(
        title: String = "Glossier Release: 8/17",
        source: TaskSource = .shortcut,
        summary: String? = "Approved Tickets: sc-486390"
    ) -> TaskItem {
        TaskItem(
            id: UUID(),
            title: title,
            notes: "",
            status: .open,
            priority: .high,
            dueAt: nil,
            sortOrder: 0,
            createdAt: .now,
            updatedAt: .now,
            completedAt: nil,
            archivedAt: nil,
            isStarred: false,
            listId: UUID(),
            source: source,
            sourceUrl: URL(string: "https://app.shortcut.com/sdg/story/490785"),
            sourceDetails: TaskSourceDetails(
                externalReference: "490785",
                summary: summary,
                size: nil,
                workflowStateName: "Ready for LOE"
            )
        )
    }
}
