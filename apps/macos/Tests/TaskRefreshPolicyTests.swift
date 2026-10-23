import Foundation
import Testing
@testable import TodoTracker

struct TaskRefreshPolicyTests {
    @Test("Backs off unchanged visible surfaces past Neon's five-minute idle window")
    func adaptiveTaskCadence() {
        #expect(TaskRefreshPolicy.interval(isTaskSurfaceVisible: true) == .seconds(30))
        #expect(TaskRefreshPolicy.interval(isTaskSurfaceVisible: true, unchangedPolls: 1) == .seconds(60))
        #expect(TaskRefreshPolicy.interval(isTaskSurfaceVisible: true, unchangedPolls: 2) == .seconds(120))
        #expect(TaskRefreshPolicy.interval(isTaskSurfaceVisible: true, unchangedPolls: 3) == .seconds(600))
        #expect(TaskRefreshPolicy.interval(isTaskSurfaceVisible: false) == .seconds(300))
    }

    @Test("Skips database refreshes while both task surfaces are hidden")
    func hiddenTaskSurfacesDoNotRefresh() {
        #expect(TaskRefreshPolicy.shouldRefreshTasks(isTaskSurfaceVisible: true))
        #expect(!TaskRefreshPolicy.shouldRefreshTasks(isTaskSurfaceVisible: false))
    }

    @Test("Refreshes the full snapshot periodically and on each idle wake")
    func fullSnapshotCadence() {
        #expect(!TaskRefreshPolicy.includesLists(at: 1))
        #expect(!TaskRefreshPolicy.includesLists(at: 9))
        #expect(TaskRefreshPolicy.includesLists(at: 10))
        #expect(TaskRefreshPolicy.includesLists(at: 20))
        #expect(TaskRefreshPolicy.includesLists(at: 3, unchangedPolls: 3))
    }

    @Test("Refreshes the Shortcut Board periodically and on each idle wake")
    func shortcutBoardCadence() {
        #expect(!TaskRefreshPolicy.includesShortcutBoard(at: 1))
        #expect(!TaskRefreshPolicy.includesShortcutBoard(at: 3))
        #expect(TaskRefreshPolicy.includesShortcutBoard(at: 4))
        #expect(TaskRefreshPolicy.includesShortcutBoard(at: 8))
        #expect(TaskRefreshPolicy.includesShortcutBoard(at: 3, unchangedPolls: 3))
    }

    @Test("Refreshes review awareness every fifteen minutes")
    func reviewSummaryCadence() {
        let now = Date(timeIntervalSince1970: 2_000)
        #expect(TaskRefreshPolicy.shouldRefreshReviewSummary(lastRefreshAt: nil, now: now))
        #expect(!TaskRefreshPolicy.shouldRefreshReviewSummary(
            lastRefreshAt: now.addingTimeInterval(-899),
            now: now
        ))
        #expect(TaskRefreshPolicy.shouldRefreshReviewSummary(
            lastRefreshAt: now.addingTimeInterval(-900),
            now: now
        ))
    }

    @Test("Refreshes review awareness five seconds after web review opens")
    func activeReviewCadence() {
        let now = Date(timeIntervalSince1970: 2_000)
        #expect(!TaskRefreshPolicy.shouldRefreshReviewSummary(
            lastRefreshAt: now.addingTimeInterval(-4),
            isReviewWatchActive: true,
            now: now
        ))
        #expect(TaskRefreshPolicy.shouldRefreshReviewSummary(
            lastRefreshAt: now.addingTimeInterval(-5),
            isReviewWatchActive: true,
            now: now
        ))
        #expect(TaskRefreshPolicy.reviewWatchInterval == .seconds(5))
        #expect(TaskRefreshPolicy.reviewWatchMaximumAttempts == 24)
    }
}
