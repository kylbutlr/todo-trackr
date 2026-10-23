import Foundation

struct ReviewSummary: Decodable, Equatable {
    struct SourceCounts: Decodable, Equatable {
        let granola: Int
        let shortcut: Int
    }

    let generatedAt: Date
    let total: Int
    let sources: SourceCounts
}
