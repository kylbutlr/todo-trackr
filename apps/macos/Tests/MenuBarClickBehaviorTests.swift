import Testing
@testable import TodoTracker

struct MenuBarClickBehaviorTests {
    @Test("Left click opens the workspace")
    func leftClickOpensWorkspace() {
        #expect(MenuBarClickBehavior.action(for: .leftMouseUp) == .openWorkspace)
    }

    @Test("Right click opens the menu")
    func rightClickOpensMenu() {
        #expect(MenuBarClickBehavior.action(for: .rightMouseUp) == .showMenu)
    }
}
