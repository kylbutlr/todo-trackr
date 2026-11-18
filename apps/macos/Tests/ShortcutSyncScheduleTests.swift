import Foundation
import Testing
import SwiftUI
import AppKit
@testable import TodoTracker

@MainActor
struct ShortcutSyncScheduleTests {
    final class Clock {
        var date = Date(timeIntervalSince1970: 1_000)
    }

    func fixture() -> (ShortcutSyncSchedule, Clock, UserDefaults) {
        let defaults = UserDefaults(suiteName: "ShortcutSyncTests.\(UUID())")!
        let clock = Clock()
        let schedule = ShortcutSyncSchedule(defaults: defaults, now: { clock.date })
        schedule.setMinutes(15)
        return (schedule, clock, defaults)
    }

    @Test func dueSyncFetchesOnceAndSchedulesFromCompletion() async {
        let (schedule, clock, _) = fixture()
        var calls = 0
        let operation: @MainActor () async -> ShortcutSyncSchedule.Outcome = {
            calls += 1
            clock.date += 3
            return .synced
        }
        clock.date += 899
        await schedule.syncIfDue(isVisible: true, isSignedIn: true, operation: operation)
        #expect(calls == 0)
        clock.date += 1
        await schedule.syncIfDue(isVisible: true, isSignedIn: true, operation: operation)
        #expect(calls == 1)
        #expect(schedule.lastSuccessAt == clock.date)
        #expect(schedule.nextSyncAt == clock.date.addingTimeInterval(900))
        await schedule.syncIfDue(isVisible: true, isSignedIn: true, operation: operation)
        #expect(calls == 1)
    }

    @Test func hiddenSignedOutAndDisabledNeverFetchAndResumeCatchesUpOnce() async {
        let (schedule, clock, _) = fixture()
        var calls = 0
        let operation: @MainActor () async -> ShortcutSyncSchedule.Outcome = { calls += 1; return .synced }
        clock.date += 86_400
        await schedule.syncIfDue(isVisible: false, isSignedIn: true, operation: operation)
        await schedule.syncIfDue(isVisible: true, isSignedIn: false, operation: operation)
        #expect(calls == 0)
        await schedule.syncIfDue(isVisible: true, isSignedIn: true, operation: operation)
        #expect(calls == 1)
        schedule.setMinutes(0)
        clock.date += 86_400
        await schedule.syncIfDue(isVisible: true, isSignedIn: true, operation: operation)
        #expect(calls == 1)
        #expect(schedule.nextSyncAt == nil)
        await schedule.syncNow(operation: operation)
        #expect(calls == 2)
        #expect(schedule.nextSyncAt == nil)
    }

    @Test func preferencesPersistAndRescheduleImmediately() {
        let (schedule, clock, defaults) = fixture()
        schedule.setMinutes(5)
        #expect(schedule.nextSyncAt == clock.date.addingTimeInterval(300))
        #expect(ShortcutSyncSchedule(defaults: defaults).minutes == 5)
        schedule.setMinutes(-1)
        #expect(schedule.minutes == 5)
        defaults.set(2, forKey: ShortcutSyncSchedule.preferenceKey)
        #expect(ShortcutSyncSchedule(defaults: defaults).minutes == 60)
    }

    @Test func freshInstallDefaultsToHourlyAndPreservesExplicitIntervals() {
        let defaults = UserDefaults(suiteName: "ShortcutSyncTests.\(UUID())")!
        #expect(ShortcutSyncSchedule(defaults: defaults).minutes == 60)
        for interval in ShortcutSyncSchedule.intervals {
            defaults.set(interval, forKey: ShortcutSyncSchedule.preferenceKey)
            #expect(ShortcutSyncSchedule(defaults: defaults).minutes == interval)
        }
    }

    @Test func failuresAndIgnoredResultsAreNotReportedAsSuccessOrRetriedRapidly() async {
        let (schedule, clock, _) = fixture()
        await schedule.syncNow { .failed("Offline") }
        #expect(schedule.lastSuccessAt == nil)
        #expect(schedule.status(at: clock.date, isVisible: true, isSignedIn: true) == "Retry in 15:00")
        #expect(schedule.nextSyncAt == clock.date.addingTimeInterval(900))
        await schedule.syncNow { .ignored }
        #expect(schedule.outcome == .ignored)
        #expect(schedule.lastSuccessAt == nil)
    }

    @Test func countdownAndManualRefreshShareTheSameDeadline() async {
        let (schedule, clock, _) = fixture()
        clock.date += 30
        #expect(schedule.status(at: clock.date, isVisible: true, isSignedIn: true) == "Next sync in 14:30")
        await schedule.syncNow { .synced }
        #expect(schedule.status(at: clock.date, isVisible: true, isSignedIn: true) == "Next sync in 15:00")
        #expect(schedule.status(at: clock.date, isVisible: false, isSignedIn: true) == "Paused while task windows are hidden")
        #expect(schedule.status(at: clock.date, isVisible: true, isSignedIn: false) == "Sign in to sync")
    }

    @Test func overlappingManualAndAutomaticRequestsShareOneOperation() async {
        let (schedule, clock, _) = fixture()
        clock.date += 900
        var continuation: CheckedContinuation<ShortcutSyncSchedule.Outcome, Never>?
        var calls = 0
        let first = Task {
            await schedule.syncIfDue(isVisible: true, isSignedIn: true) {
                calls += 1
                return await withCheckedContinuation { continuation = $0 }
            }
        }
        while continuation == nil { await Task.yield() }
        var manualStarted = false
        let manual = Task {
            manualStarted = true
            return await schedule.syncNow { calls += 1; return .synced }
        }
        while !manualStarted { await Task.yield() }
        #expect(schedule.isSyncing)
        #expect(calls == 1)
        continuation?.resume(returning: .synced)
        await first.value
        _ = await manual.value
        #expect(calls == 1)
        #expect(!schedule.isSyncing)
    }

    /// Opt-in rendering uses only fixture data, without opening the installed app or an API session.
    @Test func renderSyncControlsForReview() async throws {
        guard let directory = ProcessInfo.processInfo.environment["TODO_TRACKR_SYNC_PREVIEW_DIRECTORY"] else { return }
        let (schedule, clock, _) = fixture()
        clock.date = .now
        schedule.setMinutes(15)
        let fonts = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .deletingLastPathComponent().appendingPathComponent("Sources/Resources/Fonts")
        for font in ["Geist-Variable.ttf", "GeistMono-Variable.ttf"] {
            CTFontManagerRegisterFontsForURL(fonts.appendingPathComponent(font) as CFURL, .process, nil)
        }
        for state in ["default", "frequent", "failure", "ignored", "off"] {
            switch state {
            case "frequent": schedule.setMinutes(1)
            case "failure": await schedule.syncNow { .failed("Network unavailable. Check your connection.") }
            case "ignored": await schedule.syncNow { .ignored }
            case "off": schedule.setMinutes(0)
            default: break
            }
            let view = NSHostingView(rootView: ShortcutSyncSettings(
                schedule: schedule, isVisible: { true }, isSignedIn: true, sync: {}
            ))
            view.frame = NSRect(origin: .zero, size: view.fittingSize)
            view.layoutSubtreeIfNeeded()
            let bitmap = try #require(view.bitmapImageRepForCachingDisplay(in: view.bounds))
            view.cacheDisplay(in: view.bounds, to: bitmap)
            let png = try #require(bitmap.representation(using: .png, properties: [:]))
            try png.write(to: URL(fileURLWithPath: directory).appendingPathComponent("sync-\(state).png"))
        }
    }
}
