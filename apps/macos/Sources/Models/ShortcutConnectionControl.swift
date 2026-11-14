import Foundation

struct ShortcutConnectionControl: Decodable, Sendable {
    let controlMode: String
    let paused: Bool
    var isOff: Bool { controlMode == "off" && paused }
}
