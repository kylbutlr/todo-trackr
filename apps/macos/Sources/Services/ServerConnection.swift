import Foundation

enum ServerConnection {
    static let preferenceKey = "todo-trackr.server-origin"
    static let legacyOrigin = "https://todotrackr.netlify.app"

    static func normalize(_ value: String) throws -> URL {
        guard let parts = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
              let host = parts.host?.lowercased(),
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/",
              parts.scheme == "https" || (parts.scheme == "http" && ["localhost", "127.0.0.1", "::1", "[::1]"].contains(host)),
              let url = parts.url else { throw APIError.invalidURL }
        var normalized = parts
        normalized.scheme = url.scheme?.lowercased()
        normalized.host = host
        normalized.path = ""
        if (normalized.scheme == "https" && normalized.port == 443) || (normalized.scheme == "http" && normalized.port == 80) { normalized.port = nil }
        guard let result = normalized.url else { throw APIError.invalidURL }
        return result
    }

    static func configuredURL() -> URL {
        if let value = ProcessInfo.processInfo.environment["TODO_TRACKER_API_BASE_URL"], let url = try? normalize(value) { return url }
        if let value = UserDefaults.standard.string(forKey: preferenceKey), let url = try? normalize(value) { return url }
        if (try? KeychainStore.token()) != nil { return URL(string: legacyOrigin)! }
        return URL(string: "http://127.0.0.1:8888")!
    }
}

struct InstallationCapabilities: Decodable, Sendable {
    struct Integrations: Decodable, Sendable {
        let shortcut: Bool
        let granola: Bool
        let codex: Bool
    }
    let apiVersion: Int
    let authenticationMode: String
    let integrations: Integrations
    let workSwitch: Bool?
    var usesWorkSwitch: Bool { workSwitch != false }
    static let legacy = InstallationCapabilities(apiVersion: 1, authenticationMode: "password", integrations: .init(shortcut: true, granola: true, codex: true), workSwitch: true)
}
