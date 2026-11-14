import SwiftUI
import Foundation

@MainActor
enum WorkIntegrationFactory {
    nonisolated static let providerID: String? = nil
    nonisolated static let title = "Integration"
    static func settingsView() -> AnyView { AnyView(EmptyView()) }
    static func make(store: TaskStore) -> WorkIntegration { WorkIntegration() }
}
