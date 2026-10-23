import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: TaskStore

    var body: some View {
        ZStack {
            AppWindowBackground()

            switch store.authenticationState {
            case .checking:
                ProgressView("Opening Todo Trackr")
                    .foregroundStyle(DesignTokens.textMuted)
                    .tint(DesignTokens.action)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .appSurfaceBackground(.canvas)
            case .signedOut:
                LoginView()
            case .signedIn:
                WorkspaceView()
            }
        }
    }
}
