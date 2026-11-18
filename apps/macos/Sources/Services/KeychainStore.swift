import Foundation
import Security

protocol KeychainPersisting {
    func add(_ attributes: CFDictionary) -> OSStatus
    func update(_ query: CFDictionary, attributes: CFDictionary) -> OSStatus
}

struct SystemKeychainPersistence: KeychainPersisting {
    func add(_ attributes: CFDictionary) -> OSStatus {
        SecItemAdd(attributes, nil)
    }

    func update(_ query: CFDictionary, attributes: CFDictionary) -> OSStatus {
        SecItemUpdate(query, attributes)
    }
}

enum KeychainStore {
    private static let service = "com.kylbutlr.todo-tracker"
    private static func account(for server: URL?) -> String {
        guard let server, server.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) != ServerConnection.legacyOrigin else { return "api-session" }
        return "api-session:\(server.absoluteString)"
    }

    static func save(token: String, server: URL? = nil) throws {
        try save(token: token, persistence: SystemKeychainPersistence(), server: server)
    }

    static func save(token: String, persistence: KeychainPersisting, server: URL? = nil) throws {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account(for: server),
        ]

        let updateAttributes: [String: Any] = [
            kSecValueData as String: data,
        ]
        let updateStatus = persistence.update(
            query as CFDictionary,
            attributes: updateAttributes as CFDictionary
        )

        if updateStatus == errSecSuccess {
            return
        }

        guard updateStatus == errSecItemNotFound else {
            throw KeychainError.unhandled(updateStatus)
        }

        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = persistence.add(item as CFDictionary)
        guard status == errSecSuccess else {
            throw KeychainError.unhandled(status)
        }
    }

    static func token(server: URL? = nil) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account(for: server),
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            throw KeychainError.unhandled(status)
        }

        return token
    }

    static func removeToken(server: URL? = nil) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account(for: server),
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unhandled(status)
        }
    }
}

enum KeychainError: LocalizedError {
    case unhandled(OSStatus)

    var errorDescription: String? {
        switch self {
        case let .unhandled(status):
            return "Keychain operation failed with status \(status)."
        }
    }
}
