import Security
import Testing
@testable import TodoTracker

struct KeychainStoreTests {
    @Test("Saving an existing session updates it without deleting it")
    func saveUpdatesExistingSession() throws {
        let persistence = KeychainPersistenceSpy(updateStatus: errSecSuccess)

        try KeychainStore.save(token: "updated-token", persistence: persistence)

        #expect(persistence.updateCallCount == 1)
        #expect(persistence.addCallCount == 0)
    }

    @Test("Saving the first session creates a Keychain item")
    func saveCreatesMissingSession() throws {
        let persistence = KeychainPersistenceSpy(updateStatus: errSecItemNotFound)

        try KeychainStore.save(token: "first-token", persistence: persistence)

        #expect(persistence.updateCallCount == 1)
        #expect(persistence.addCallCount == 1)
    }
}

private final class KeychainPersistenceSpy: KeychainPersisting {
    private let updateStatus: OSStatus
    private(set) var addCallCount = 0
    private(set) var updateCallCount = 0

    init(updateStatus: OSStatus) {
        self.updateStatus = updateStatus
    }

    func add(_ attributes: CFDictionary) -> OSStatus {
        addCallCount += 1
        return errSecSuccess
    }

    func update(_ query: CFDictionary, attributes: CFDictionary) -> OSStatus {
        updateCallCount += 1
        return updateStatus
    }
}
