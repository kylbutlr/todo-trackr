import Foundation
import Security
import Testing
@testable import TodoTracker

struct ServerConnectionTests {
    @Test func compiledBuildUsesItsOwnServerDefault() {
        withDefaults { defaults, _ in
            let url = ServerConnection.configuredURL(environment: [:], defaults: defaults, hasLegacySession: { false })
            let expected = WorkIntegrationFactory.defaultServerOrigin ?? "http://127.0.0.1:8888"
            #expect(url.absoluteString == expected)
        }
    }

    @Test func personalDefaultDoesNotRequireASession() {
        withDefaults { defaults, _ in
            let url = ServerConnection.configuredURL(environment: [:], defaults: defaults, defaultOrigin: ServerConnection.legacyOrigin, hasLegacySession: { false })
            #expect(url.absoluteString == ServerConnection.legacyOrigin)
        }
    }

    @Test func personalDefaultDoesNotReadKeychain() {
        withDefaults { defaults, _ in
            var accessedKeychain = false
            let url = ServerConnection.configuredURL(environment: [:], defaults: defaults, defaultOrigin: ServerConnection.legacyOrigin, hasLegacySession: {
                accessedKeychain = true
                throw APIError.unauthorized
            })
            #expect(url.absoluteString == ServerConnection.legacyOrigin)
            #expect(!accessedKeychain)
        }
    }

    @Test func rememberedHostSurvivesSessionLossAndDefaultsReload() {
        withDefaults { defaults, suite in
            defaults.set(ServerConnection.legacyOrigin, forKey: ServerConnection.preferenceKey)
            let reopened = UserDefaults(suiteName: suite)!
            let url = ServerConnection.configuredURL(environment: [:], defaults: reopened, defaultOrigin: nil, hasLegacySession: { false })
            #expect(url.absoluteString == ServerConnection.legacyOrigin)
            #expect(reopened.string(forKey: ServerConnection.preferenceKey) == ServerConnection.legacyOrigin)
        }
    }

    @Test func explicitOriginsTakePrecedenceOverPersonalFallback() {
        withDefaults { defaults, _ in
            defaults.set("https://owner.example.test", forKey: ServerConnection.preferenceKey)
            #expect(ServerConnection.configuredURL(environment: [:], defaults: defaults, defaultOrigin: ServerConnection.legacyOrigin, hasLegacySession: { false }).absoluteString == "https://owner.example.test")
            #expect(ServerConnection.configuredURL(environment: ["TODO_TRACKER_API_BASE_URL": "http://localhost:9123"], defaults: defaults, defaultOrigin: ServerConnection.legacyOrigin, hasLegacySession: { false }).absoluteString == "http://localhost:9123")
        }
    }

    @Test func invalidSavedOriginUsesPersonalHostedFallback() {
        withDefaults { defaults, _ in
            defaults.set("https://invalid.test/path", forKey: ServerConnection.preferenceKey)
            let url = ServerConnection.configuredURL(environment: [:], defaults: defaults, defaultOrigin: ServerConnection.legacyOrigin, hasLegacySession: { false })
            #expect(url.absoluteString == ServerConnection.legacyOrigin)
        }
    }

    @Test func publicDefaultRetainsStandaloneAndLegacySessionBehavior() {
        withDefaults { defaults, _ in
            #expect(ServerConnection.configuredURL(environment: [:], defaults: defaults, defaultOrigin: nil, hasLegacySession: { false }).absoluteString == "http://127.0.0.1:8888")
            #expect(ServerConnection.configuredURL(environment: [:], defaults: defaults, defaultOrigin: nil, hasLegacySession: { true }).absoluteString == ServerConnection.legacyOrigin)
            defaults.set("http://127.0.0.1:9123", forKey: ServerConnection.preferenceKey)
            #expect(ServerConnection.configuredURL(environment: [:], defaults: defaults, defaultOrigin: nil, hasLegacySession: { true }).absoluteString == "http://127.0.0.1:9123")
        }
    }

    @Test func failedConnectionDoesNotReplaceRememberedServer() async throws {
        let suite = "todo-trackr.server-connection-tests." + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(ServerConnection.legacyOrigin, forKey: ServerConnection.preferenceKey)
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [UnavailableInstallationProtocol.self]
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }
        let api = APIClient(baseURL: URL(string: ServerConnection.legacyOrigin)!, session: session, credential: { nil }, connectionDefaults: UserDefaults(suiteName: suite)!)
        await api.configure(server: URL(string: "http://127.0.0.1:8888")!)
        await #expect(throws: APIError.self) { try await api.installation() }
        #expect(defaults.string(forKey: ServerConnection.preferenceKey) == ServerConnection.legacyOrigin)
    }

    @Test func authenticatedServerIsRememberedAcrossDefaultsReload() async throws {
        let suite = "todo-trackr.server-connection-tests." + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set("https://previous.example.test", forKey: ServerConnection.preferenceKey)
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [UnavailableInstallationProtocol.self]
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }
        let api = APIClient(baseURL: URL(string: "https://previous.example.test")!, session: session, credential: { "synthetic-session" }, connectionDefaults: UserDefaults(suiteName: suite)!)
        await api.configure(server: URL(string: ServerConnection.legacyOrigin)!)
        #expect(defaults.string(forKey: ServerConnection.preferenceKey) == "https://previous.example.test")
        try await api.validateSession()
        await api.rememberAuthenticatedServer()
        let reopened = UserDefaults(suiteName: suite)!
        #expect(ServerConnection.configuredURL(environment: [:], defaults: reopened, defaultOrigin: nil, hasLegacySession: { false }).absoluteString == ServerConnection.legacyOrigin)
    }

    @Test func normalizesSecureAndLocalServerOrigins() throws {
        #expect(try ServerConnection.normalize(" https://EXAMPLE.test:443/ ").absoluteString == "https://example.test")
        #expect(try ServerConnection.normalize("http://127.0.0.1:8888/").absoluteString == "http://127.0.0.1:8888")
    }

    @Test func rejectsUnsafeOrAmbiguousAddresses() {
        for value in ["http://remote.test", "file:///tmp/tasks", "https://user:secret@example.test", "https://example.test/api", "https://example.test?token=secret"] {
            #expect(throws: APIError.self) { try ServerConnection.normalize(value) }
        }
    }

    @Test func keepsCredentialsSeparateBetweenServers() throws {
        let spy = ServerKeychainSpy()
        try KeychainStore.save(token: "first", persistence: spy, server: URL(string: "https://first.test")!)
        try KeychainStore.save(token: "second", persistence: spy, server: URL(string: "https://second.test")!)
        #expect(spy.accounts == ["api-session:https://first.test", "api-session:https://second.test"])
    }

    @Test func preservesTheOriginalCredentialAccountForLegacyServers() throws {
        let spy = ServerKeychainSpy()
        try KeychainStore.save(token: "legacy", persistence: spy, server: URL(string: ServerConnection.legacyOrigin)!)
        #expect(spy.accounts == ["api-session"])
    }
}

private func withDefaults(_ body: (UserDefaults, String) -> Void) {
    let suite = "todo-trackr.server-connection-tests." + UUID().uuidString
    let defaults = UserDefaults(suiteName: suite)!
    defer { defaults.removePersistentDomain(forName: suite) }
    body(defaults, suite)
}

private final class UnavailableInstallationProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let sessionCheck = request.url?.path == "/api/auth/session"
        let data = Data((sessionCheck ? #"{"authenticated":true}"# : #"{"error":"Disposable unavailable installation"}"#).utf8)
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: sessionCheck ? 200 : 503, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

private final class ServerKeychainSpy: KeychainPersisting {
    var accounts: [String] = []
    func add(_ attributes: CFDictionary) -> OSStatus { errSecSuccess }
    func update(_ query: CFDictionary, attributes: CFDictionary) -> OSStatus {
        if let account = (query as NSDictionary)[kSecAttrAccount] as? String { accounts.append(account) }
        return errSecSuccess
    }
}
