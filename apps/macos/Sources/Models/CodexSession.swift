import Foundation

enum CodexSessionStatus: String, Codable {
    case linked
    case queued
    case working
    case waitingForYou = "waiting_for_you"
    case readyForReview = "ready_for_review"
    case failed
    case finished

    var label: String {
        switch self {
        case .linked: "Linked"
        case .queued: "Queued"
        case .working: "In progress"
        case .waitingForYou: "Needs you"
        case .readyForReview: "Ready for review"
        case .failed: "Blocked"
        case .finished: "Finished"
        }
    }

    var symbolName: String {
        switch self {
        case .linked: "link"
        case .queued: "clock"
        case .working: "bolt"
        case .waitingForYou: "person.crop.circle.badge.exclamationmark"
        case .readyForReview: "checkmark.bubble"
        case .failed: "exclamationmark.triangle"
        case .finished: "checkmark.circle"
        }
    }
}

struct CodexSessionItem: Codable, Identifiable, Equatable {
    let id: UUID
    let taskId: UUID
    let taskTitle: String
    let threadId: String
    let threadUrl: URL?
    let title: String?
    let status: CodexSessionStatus
    let latestSummary: String?
    let cwd: String?
    let branchName: String?
    let prUrl: URL?
    let isCurrent: Bool
    let lastSeenAt: Date
    let createdAt: Date
    let updatedAt: Date
}
