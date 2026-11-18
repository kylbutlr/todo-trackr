import Testing
@testable import TodoTracker

@MainActor
struct WorkProviderRoutingTests {
    @Test func publicBuildIgnoresUnavailableProviderWithoutRewritingSelection() {
        #expect(WorkProviderRouting.miniMode("private-provider", shortcutAvailable: true, integrationID: nil) == .tasks)
        #expect(WorkProviderRouting.miniMode("integration", shortcutAvailable: true, integrationID: nil) == .tasks)
        #expect(WorkProviderRouting.miniMode("shortcut", shortcutAvailable: false, integrationID: nil) == .tasks)
        #expect(WorkProviderRouting.miniMode("shortcut", shortcutAvailable: true, integrationID: nil) == .shortcut)
    }
    @Test func customBuildResolvesItsOwnSavedProvider() {
        #expect(WorkProviderRouting.miniMode("private-provider", shortcutAvailable: false, integrationID: "private-provider") == .integration)
        #expect(WorkProviderRouting.miniMode("another-provider", shortcutAvailable: true, integrationID: "private-provider") == .tasks)
    }
    @Test func acquisitionRemainsSeparate() {
        #expect(!WorkProviderRouting.permitsShortcut(mode: .integration, hasIntegrationScope: true))
        #expect(!WorkProviderRouting.permitsShortcut(mode: .tasks, hasIntegrationScope: true))
        #expect(WorkProviderRouting.permitsShortcut(mode: .tasks, hasIntegrationScope: false))
        #expect(WorkProviderRouting.permitsShortcut(mode: .shortcut, hasIntegrationScope: true))
    }
}
