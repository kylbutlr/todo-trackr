import Foundation

enum WorkspaceMode: String, CaseIterable, Identifiable {
    case tasks
    case shortcut

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tasks: "Tasks"
        case .shortcut: "Shortcut"
        }
    }

    var systemImage: String {
        switch self {
        case .tasks: "checkmark"
        case .shortcut: "link"
        }
    }
}

enum ShortcutBoardScope: String, Codable, CaseIterable, Identifiable, Sendable {
    case owner
    case requester
    case both
    case either

    var id: String { rawValue }

    var title: String {
        switch self {
        case .owner: "Owner"
        case .requester: "Requester"
        case .both: "Owner and requester"
        case .either: "Owner or requester"
        }
    }
}

struct ShortcutBoardStory: Codable, Identifiable, Hashable, Sendable {
    let externalReference: String
    let sourceUrl: URL
    let title: String
    let priority: TaskPriority
    let size: String?
    let dueDate: String?
    let workflowStateName: String
    let ownerIds: [String]
    let requestedById: String?
    let matchesOwner: Bool
    let matchesRequester: Bool
    var isStarred: Bool
    let sourceUpdatedAt: Date?
    var epicName: String? = nil

    var id: String { externalReference }

    var presentationIdentity: String {
        "\(externalReference):\(dueDate ?? "undated")"
    }

    var relationshipLabel: String {
        if matchesOwner && matchesRequester { return "Owner + requester" }
        return matchesOwner ? "Owner" : "Requester"
    }

    var parsedDueDate: Date? {
        guard let dueDate else { return nil }
        let components = dueDate.split(separator: "-").compactMap { Int($0) }
        guard components.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(
            year: components[0],
            month: components[1],
            day: components[2]
        ))
    }
}

struct ShortcutBoardSnapshot: Codable, Sendable {
    let generatedAt: Date
    let memberId: String
    let stories: [ShortcutBoardStory]
}

struct ShortcutBoardSection: Identifiable, Hashable {
    let id: String
    let title: String
    let stories: [ShortcutBoardStory]
}

enum ShortcutBoardGrouping {
    static func visibleStories(
        _ stories: [ShortcutBoardStory],
        scope: ShortcutBoardScope,
        search: String = ""
    ) -> [ShortcutBoardStory] {
        let needle = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return stories.filter { story in
            let matchesScope = switch scope {
            case .owner: story.matchesOwner
            case .requester: story.matchesRequester
            case .both: story.matchesOwner && story.matchesRequester
            case .either: story.matchesOwner || story.matchesRequester
            }

            guard matchesScope else { return false }
            guard !needle.isEmpty else { return true }
            return [
                story.externalReference,
                story.title,
                story.workflowStateName,
                story.priority.rawValue,
                story.size ?? "",
                story.epicName ?? "",
            ].joined(separator: " ").lowercased().contains(needle)
        }
    }

    static func sections(
        for stories: [ShortcutBoardStory],
        now: Date = .now,
        calendar: Calendar = .current
    ) -> [ShortcutBoardSection] {
        let today = calendar.startOfDay(for: now)
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!
        let afterTomorrow = calendar.date(byAdding: .day, value: 2, to: today)!
        let laterBoundary = calendar.date(byAdding: .day, value: 7, to: today)!
        var groups: [String: (title: String, stories: [ShortcutBoardStory])] = [:]

        for story in stories {
            let due = story.parsedDueDate
            let id: String
            let title: String

            if due == nil {
                id = "undated"
                title = "No due date"
            } else if due! < today {
                id = "overdue"
                title = "Overdue"
            } else if due! < tomorrow {
                id = "today"
                title = "Today"
            } else if due! < afterTomorrow {
                id = "tomorrow"
                title = "Tomorrow"
            } else if due! < laterBoundary {
                id = calendarKey(due!, calendar: calendar)
                title = due!.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
            } else {
                id = "later"
                title = "Later"
            }

            groups[id, default: (title, [])].stories.append(story)
        }

        let priorityRank: [TaskPriority: Int] = [
            .highest: 0,
            .high: 1,
            .medium: 2,
            .low: 3,
            .lowest: 4,
            .none: 5,
        ]
        func sorted(_ values: [ShortcutBoardStory], undated: Bool = false) -> [ShortcutBoardStory] {
            values.sorted { left, right in
                if undated {
                    if left.isStarred != right.isStarred { return left.isStarred }
                    let leftState = ShortcutWorkflowOrder.rank(left.workflowStateName)
                    let rightState = ShortcutWorkflowOrder.rank(right.workflowStateName)
                    if leftState != rightState { return leftState > rightState }
                }
                let leftRank = priorityRank[left.priority] ?? 5
                let rightRank = priorityRank[right.priority] ?? 5
                if leftRank != rightRank { return leftRank < rightRank }
                if left.isStarred != right.isStarred { return left.isStarred }
                if left.dueDate != right.dueDate { return (left.dueDate ?? "9999-12-31") < (right.dueDate ?? "9999-12-31") }
                return shortcutIDPrecedes(left.externalReference, right.externalReference)
            }
        }

        let fixedOrder = ["overdue", "today", "tomorrow"]
        var result = fixedOrder.compactMap { id -> ShortcutBoardSection? in
            guard let group = groups[id] else { return nil }
            return ShortcutBoardSection(id: id, title: group.title, stories: sorted(group.stories))
        }
        result += groups
            .filter { $0.key.first?.isNumber == true }
            .sorted { $0.key < $1.key }
            .map { ShortcutBoardSection(id: $0.key, title: $0.value.title, stories: sorted($0.value.stories)) }
        result += ["later", "undated"].compactMap { id -> ShortcutBoardSection? in
            guard let group = groups[id] else { return nil }
            return ShortcutBoardSection(id: id, title: group.title, stories: sorted(group.stories, undated: id == "undated"))
        }
        return result
    }

    private static func shortcutIDPrecedes(_ left: String, _ right: String) -> Bool {
        if let leftID = Int(left), let rightID = Int(right) {
            return leftID < rightID
        }
        return left < right
    }

    private static func calendarKey(_ date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }
}
