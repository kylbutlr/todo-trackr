import Foundation
import Testing
@testable import TodoTracker

struct QuickCaptureSourceTests {
    @Test("Recognizes Slack as the foreground Quick Capture source")
    func recognizesSlack() {
        #expect(
            GlobalQuickCaptureController.taskSource(
                forBundleIdentifier: "com.tinyspeck.slackmacgap"
            ) == .slack
        )
    }

    @Test("Keeps other native Quick Captures manual")
    func keepsOtherApplicationsManual() {
        #expect(
            GlobalQuickCaptureController.taskSource(
                forBundleIdentifier: "com.apple.Safari"
            ) == .manual
        )
    }

    @MainActor
    @Test("Builds a Slack request from the captured foreground application")
    func buildsSlackRequest() {
        let controller = GlobalQuickCaptureController()

        controller.prepareCapture(from: SelectedTextSnapshot(
            selectedText: "Review saved items",
            needsAccessibilityPermission: false,
            sourceApplicationBundleIdentifier: "com.tinyspeck.slackmacgap",
            sourceApplicationName: "Slack"
        ))

        #expect(controller.request?.suggestedTitle == "Review saved items")
        #expect(controller.request?.source == .slack)
        #expect(controller.request?.sourceApplicationName == "Slack")
    }

    @Test("Encodes Slack on the native create request")
    func encodesSlackCreateRequest() throws {
        let input = CreateTaskInput(
            title: "Review saved items",
            listId: UUID(),
            source: .slack
        )
        let object = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(input)) as? [String: Any]
        )

        #expect(object["source"] as? String == "slack")
    }
}
