import Testing
@testable import TodoTracker

struct TaskDetailPlaceholderTests {
    @Test("Keeps the empty Notes placeholder while the editor has focus")
    func keepsPlaceholderWhileFocused() {
        #expect(
            TaskDetailView.shouldShowNotesPlaceholder(
                notes: "",
                isFocused: true
            )
        )
    }

    @Test("Shows the empty Notes placeholder before editing")
    func showsPlaceholderBeforeEditing() {
        #expect(
            TaskDetailView.shouldShowNotesPlaceholder(
                notes: "",
                isFocused: false
            )
        )
    }

    @Test("Never shows the Notes placeholder over saved content")
    func hidesPlaceholderOverContent() {
        #expect(
            TaskDetailView.shouldShowNotesPlaceholder(
                notes: "Follow up tomorrow",
                isFocused: false
            ) == false
        )
    }
}
