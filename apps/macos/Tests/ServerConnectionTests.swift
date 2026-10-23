import Foundation
import Security
import Testing
@testable import TodoTracker

struct ServerConnectionTests {
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

private final class ServerKeychainSpy: KeychainPersisting {
    var accounts: [String] = []
    func add(_ attributes: CFDictionary) -> OSStatus { errSecSuccess }
    func update(_ query: CFDictionary, attributes: CFDictionary) -> OSStatus {
        if let account = (query as NSDictionary)[kSecAttrAccount] as? String { accounts.append(account) }
        return errSecSuccess
    }
}
