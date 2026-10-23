enum MenuBarPointerEvent {
    case leftMouseUp
    case rightMouseUp
}

enum MenuBarClickAction: Equatable {
    case openWorkspace
    case showMenu
}

enum MenuBarClickBehavior {
    static func action(for event: MenuBarPointerEvent) -> MenuBarClickAction {
        switch event {
        case .leftMouseUp: .openWorkspace
        case .rightMouseUp: .showMenu
        }
    }
}
