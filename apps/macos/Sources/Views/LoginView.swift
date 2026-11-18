import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var store: TaskStore
    @State private var password = ""
    @State private var serverURL = APIClient.configuredBaseURL().absoluteString

    var body: some View {
        ZStack {
            VStack(alignment: .leading, spacing: 18) {
                Image(systemName: "checkmark")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 48, height: 48)
                    .background(
                        LinearGradient(
                            colors: [DesignTokens.ink, DesignTokens.slate, DesignTokens.mint],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        in: RoundedRectangle(cornerRadius: 12)
                    )

                VStack(alignment: .leading, spacing: 6) {
                    Text("Todo Trackr")
                        .font(DesignTokens.sans(32, weight: .bold))
                        .tracking(-0.64)
                        .foregroundStyle(DesignTokens.text)
                    Text("Connect to your Todo Trackr server. Leave the password blank if that installation does not require one.")
                        .foregroundStyle(DesignTokens.textMuted)
                }

                TextField("Server URL", text: $serverURL)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Server URL")
                    .onSubmit(signIn)

                SecureField("Password, if required", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .foregroundStyle(DesignTokens.text)
                    .onSubmit(signIn)

                if let errorMessage = store.errorMessage {
                    Text(errorMessage)
                        .font(DesignTokens.sans(13, weight: .medium))
                        .foregroundStyle(DesignTokens.danger)
                }

                Button(action: signIn) {
                    HStack {
                        Spacer()
                        if store.isLoading {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Connect")
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(DesignTokens.action)
                .foregroundStyle(DesignTokens.ink)
                .disabled(serverURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isLoading)
                .controlSize(.large)
            }
            .padding(40)
            .frame(width: 410)
            .background(DesignTokens.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(DesignTokens.border)
            }
            .shadow(color: .black.opacity(0.32), radius: 22, y: 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .appSurfaceBackground(.canvas)
    }

    private func signIn() {
        let submittedPassword = password
        let submittedServer = serverURL
        Task {
            await store.connect(to: submittedServer, password: submittedPassword)
        }
    }
}
