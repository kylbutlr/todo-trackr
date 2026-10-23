import Foundation
import Testing
@testable import TodoTracker
struct WorkPermissionTests {
    @Test("Standalone installations do not require Switchr permission")
    func standaloneCapability() throws {
        let json = #"{"apiVersion":1,"authenticationMode":"none","integrations":{"shortcut":false,"granola":false,"codex":false},"workSwitch":false}"#
        let installation = try JSONDecoder().decode(InstallationCapabilities.self, from: Data(json.utf8))
        #expect(!installation.usesWorkSwitch)
        #expect(InstallationCapabilities.legacy.usesWorkSwitch)
    }
    @Test("Malformed or unbounded permissions are rejected")
    func rejectsInvalidPermissions() {
        #expect(!WorkPermission(configured: true, state: "active", revision: 1, leaseSeconds: 61, catchUpPending: false).valid)
        #expect(!WorkPermission(configured: true, state: "unknown", revision: 1, leaseSeconds: 60, catchUpPending: false).valid)
        #expect(!WorkPermission(configured: true, state: "active", revision: 1, leaseSeconds: .nan, catchUpPending: false).valid)
        #expect(WorkPermission(configured: true, state: "standby", revision: 1, leaseSeconds: 0, catchUpPending: false).valid)
    }
}
