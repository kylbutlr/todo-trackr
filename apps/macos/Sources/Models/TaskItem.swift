import Foundation

enum TaskStatus: String, Codable, CaseIterable, Sendable {
    case open
    case completed
    case archived
}

enum TaskPriority: String, Codable, CaseIterable, Sendable {
    case none
    case lowest
    case low
    case medium
    case high
    case highest

    var label: String {
        rawValue.capitalized
    }
}

enum TaskSource: String, Codable, Sendable {
    case manual, browser, shortcut, granola, slack, gmail

    var label: String { rawValue.capitalized }
}

struct TaskSourceDetails: Codable, Hashable, Sendable {
    let externalReference: String
    let summary: String?
    let size: String?
    let workflowStateName: String?
    var epicName: String? = nil
}

struct TaskItem: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var title: String
    var notes: String
    var status: TaskStatus
    var priority: TaskPriority
    var dueAt: Date?
    var sortOrder: Int
    let createdAt: Date
    var updatedAt: Date
    var updateToken: String? = nil
    var completedAt: Date?
    var archivedAt: Date?
    var isStarred: Bool
    var alarmAt: Date? = nil
    var alarmNotifiedAt: Date? = nil
    var alarmClearedAt: Date? = nil
    var needsAttention: Bool = false
    var listId: UUID
    var source: TaskSource
    var sourceUrl: URL?
    var sourceDetails: TaskSourceDetails?

    var presentationIdentity: String {
        let dueDateIdentity = dueAt.map { String($0.timeIntervalSinceReferenceDate) } ?? "undated"
        let alarmIdentity = alarmAt.map { String($0.timeIntervalSinceReferenceDate) } ?? "no-alarm"
        let clearedIdentity = alarmClearedAt.map { String($0.timeIntervalSinceReferenceDate) } ?? "active"
        let workflowStateIdentity = sourceDetails?.workflowStateName ?? "no-state"
        return "\(id.uuidString):\(dueDateIdentity):\(alarmIdentity):\(clearedIdentity):\(workflowStateIdentity):\(isStarred)"
    }

    var isAlarmAttentionActive: Bool {
        needsAttention || (
            status == .open
            && alarmAt.map { $0 <= .now } == true
            && alarmClearedAt == nil
        )
    }

    var isBackgroundRelease: Bool {
        guard source == .shortcut,
              title.range(
                  of: #"\brelease\b"#,
                  options: [.regularExpression, .caseInsensitive]
              ) != nil else {
            return false
        }

        let summary = sourceDetails?.summary?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if summary.isEmpty || summary.count <= 360 { return true }

        return summary.range(
            of: #"(?:app\.shortcut\.com/[^\s]+/story/\d+|\bsc-\d+\b|\b(?:approved\s+)?tickets?\s*:)"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }
}

struct TaskListItem: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var sortOrder: Int
    let isInbox: Bool
    let createdAt: Date
    var updatedAt: Date
}

struct CreateTaskInput: Encodable, Sendable {
    let title: String
    let notes: String
    let priority: TaskPriority
    let dueAt: Date?
    let listId: UUID
    let source: TaskSource
    let sourceUrl: URL?

    init(
        title: String,
        listId: UUID,
        source: TaskSource = .manual,
        sourceUrl: URL? = nil
    ) {
        self.title = title
        notes = ""
        priority = .none
        dueAt = nil
        self.listId = listId
        self.source = source
        self.sourceUrl = sourceUrl
    }
}

struct UpdateTaskInput: Encodable, Sendable {
    var title: String?
    var notes: String?
    var status: TaskStatus?
    var priority: TaskPriority?
    var dueAt: Date??
    var sortOrder: Int?
    var listId: UUID?
    var isStarred: Bool?
    var alarmAt: Date??
    var clearAlarm: Bool?
    var expectedUpdatedAt: String?

    enum CodingKeys: String, CodingKey {
        case title
        case notes
        case status
        case priority
        case dueAt
        case sortOrder
        case listId
        case isStarred
        case alarmAt
        case clearAlarm
        case expectedUpdatedAt
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(notes, forKey: .notes)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(priority, forKey: .priority)
        try container.encodeIfPresent(sortOrder, forKey: .sortOrder)
        try container.encodeIfPresent(listId, forKey: .listId)
        try container.encodeIfPresent(isStarred, forKey: .isStarred)
        try container.encodeIfPresent(clearAlarm, forKey: .clearAlarm)
        try container.encodeIfPresent(expectedUpdatedAt, forKey: .expectedUpdatedAt)

        if let dueAt {
            try container.encode(dueAt, forKey: .dueAt)
        }
        if let alarmAt {
            try container.encode(alarmAt, forKey: .alarmAt)
        }
    }
}
