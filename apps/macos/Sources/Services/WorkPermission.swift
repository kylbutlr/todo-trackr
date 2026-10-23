import Foundation

struct WorkPermission: Decodable, Sendable {
    let configured: Bool
    let state: String
    let revision: Int
    let leaseSeconds: Double
    let catchUpPending: Bool?
    var valid: Bool {
        ["active", "standby", "unavailable"].contains(state) && revision >= 0 && leaseSeconds.isFinite && (0...60).contains(leaseSeconds)
    }
}
