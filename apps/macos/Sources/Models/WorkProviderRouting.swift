import Foundation

/// Selection never changes stored Task provenance or imports data.
@MainActor
enum WorkProviderRouting {
    static func miniMode(_ saved: String, shortcutAvailable: Bool, integrationID: String? = WorkIntegrationFactory.providerID) -> WorkspaceMode {
        if let integrationID, saved == integrationID { return .integration }
        let mode = WorkspaceMode(rawValue: saved) ?? .tasks
        if mode == .integration { return integrationID == nil ? .tasks : .integration }
        return mode == .shortcut && !shortcutAvailable ? .tasks : mode
    }
    static func permitsShortcut(mode: WorkspaceMode, hasIntegrationScope: Bool) -> Bool {
        mode == .shortcut || (mode != .integration && !hasIntegrationScope)
    }
}
