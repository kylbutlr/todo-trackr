import Combine
import SwiftUI

/// Optional build-owned integration. Core Tasks never depend on its availability.
@MainActor
class WorkIntegration: ObservableObject {
    var title: String { "Integration" }
    var providerID: String? { nil }
    var isAvailable: Bool { providerID != nil }
    var hasSavedScope: Bool { false }
    var isRefreshing: Bool { false }
    var canRefresh: Bool { false }
    var wantsAutomaticRefresh: Bool { false }
    var itemCount: Int { 0 }
    var changeSubscription: AnyCancellable?
    func refresh() {}
    func chooseFile() {}
    func show() {}
    func startAutomaticRefresh() async {}
    func listView() -> AnyView { AnyView(EmptyView()) }
    func detailView() -> AnyView { AnyView(EmptyView()) }
    func compactView() -> AnyView { AnyView(EmptyView()) }
    func miniView() -> AnyView { AnyView(EmptyView()) }
    func footerView() -> AnyView { AnyView(EmptyView()) }
}

/// Preserve editor identity and unsaved drafts when visiting an integration.
struct WorkIntegrationLayer<Content: View, Integration: View>: View {
    let showingIntegration: Bool
    @ViewBuilder var content: () -> Content
    @ViewBuilder var integration: () -> Integration
    var body: some View {
        ZStack {
            content().opacity(showingIntegration ? 0 : 1)
                .disabled(showingIntegration).allowsHitTesting(!showingIntegration)
                .accessibilityHidden(showingIntegration)
            if showingIntegration { integration() }
        }
    }
}
