import CoreFoundation
import Testing
@testable import TodoTracker

private struct AccessibilityNode {
    let text: String?
}

struct SelectedTextReaderTests {
    @Test("Finds and trims text from the first selected accessibility candidate")
    func findsSelection() {
        let candidates = [
            AccessibilityNode(text: nil),
            AccessibilityNode(text: "  Selected Slack request  "),
            AccessibilityNode(text: "Later selection"),
        ]

        let selected = SelectedTextReader.firstSelectedText(
            in: candidates,
            selectedText: { $0.text }
        )

        #expect(selected == "Selected Slack request")
    }

    @Test("Ignores empty accessibility selections")
    func ignoresEmptySelection() {
        let selected = SelectedTextReader.firstSelectedText(
            in: [AccessibilityNode(text: " \n "), AccessibilityNode(text: nil)],
            selectedText: { $0.text }
        )

        #expect(selected == nil)
    }

    @Test("Reads a selection from an accessibility value and range")
    func readsSelectionFromValueAndRange() {
        let selected = SelectedTextReader.selectedSubstring(
            in: "Please review the saved items in Slack",
            range: CFRange(location: 7, length: 22)
        )

        #expect(selected == "review the saved items")
    }

    @Test("Rejects an invalid accessibility selection range")
    func rejectsInvalidSelectionRange() {
        let selected = SelectedTextReader.selectedSubstring(
            in: "Short text",
            range: CFRange(location: 50, length: 4)
        )

        #expect(selected == nil)
    }
}
