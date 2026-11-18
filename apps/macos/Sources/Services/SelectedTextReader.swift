import ApplicationServices
import AppKit
import Carbon.HIToolbox
import Foundation

struct SelectedTextSnapshot: Equatable, Sendable {
    let selectedText: String?
    let needsAccessibilityPermission: Bool
    let sourceApplicationBundleIdentifier: String?
    let sourceApplicationName: String?
}

enum SelectedTextReader {
    private static let parentInspectionLimit = 12
    private static let copyTimeout: TimeInterval = 0.25

    static func capture() -> SelectedTextSnapshot {
        let trusted = AXIsProcessTrusted()
        let application = NSWorkspace.shared.frontmostApplication
        return SelectedTextSnapshot(
            selectedText: trusted ? selectedText(from: application) : nil,
            needsAccessibilityPermission: !trusted,
            sourceApplicationBundleIdentifier: application?.bundleIdentifier,
            sourceApplicationName: application?.localizedName
        )
    }

    static func selectedText() -> String? {
        guard AXIsProcessTrusted() else { return nil }
        return selectedText(from: NSWorkspace.shared.frontmostApplication)
    }

    private static func selectedText(from application: NSRunningApplication?) -> String? {
        guard let application else { return nil }
        return accessibleSelectedText(processIdentifier: application.processIdentifier)
            ?? copiedSelectedText()
    }

    private static func accessibleSelectedText(processIdentifier: pid_t) -> String? {
        let system = AXUIElementCreateSystemWide()
        var focusedValue: CFTypeRef?
        let systemFocusedElement = AXUIElementCopyAttributeValue(
            system,
            kAXFocusedUIElementAttribute as CFString,
            &focusedValue
        ) == .success
            ? focusedValue.map { unsafeDowncast($0, to: AXUIElement.self) }
            : nil

        let application = AXUIElementCreateApplication(processIdentifier)
        var applicationFocusedValue: CFTypeRef?
        let applicationFocusedElement = AXUIElementCopyAttributeValue(
            application,
            kAXFocusedUIElementAttribute as CFString,
            &applicationFocusedValue
        ) == .success
            ? applicationFocusedValue.map { unsafeDowncast($0, to: AXUIElement.self) }
            : nil

        var focusedWindowValue: CFTypeRef?
        let focusedWindow = AXUIElementCopyAttributeValue(
            application,
            kAXFocusedWindowAttribute as CFString,
            &focusedWindowValue
        ) == .success
            ? focusedWindowValue.map { unsafeDowncast($0, to: AXUIElement.self) }
            : nil

        var candidates = [systemFocusedElement, applicationFocusedElement, focusedWindow, application]
            .compactMap { $0 }
        if let focusedElement = systemFocusedElement ?? applicationFocusedElement {
            candidates.append(contentsOf: parents(of: focusedElement, limit: parentInspectionLimit))
        }

        return firstSelectedText(in: candidates, selectedText: selectedText(in:))
    }

    static func firstSelectedText<Element>(
        in candidates: [Element],
        selectedText: (Element) -> String?
    ) -> String? {
        for element in candidates {
            if let selected = selectedText(element)?.trimmingCharacters(in: .whitespacesAndNewlines),
               !selected.isEmpty {
                return selected
            }
        }

        return nil
    }

    private static func selectedText(in element: AXUIElement) -> String? {
        var selectedValue: CFTypeRef?
        if AXUIElementCopyAttributeValue(
            element,
            kAXSelectedTextAttribute as CFString,
            &selectedValue
        ) == .success,
        let selectedText = selectedValue as? String {
            let trimmed = selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }

        var fullValue: CFTypeRef?
        var selectedRangeValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(
            element,
            kAXValueAttribute as CFString,
            &fullValue
        ) == .success,
        let fullText = fullValue as? String,
        AXUIElementCopyAttributeValue(
            element,
            kAXSelectedTextRangeAttribute as CFString,
            &selectedRangeValue
        ) == .success,
        let selectedRangeValue,
        CFGetTypeID(selectedRangeValue) == AXValueGetTypeID() else {
            return nil
        }

        let axRangeValue = unsafeDowncast(selectedRangeValue, to: AXValue.self)
        var range = CFRange()
        guard AXValueGetValue(axRangeValue, .cfRange, &range) else { return nil }
        return selectedSubstring(in: fullText, range: range)
    }

    static func selectedSubstring(in value: String, range: CFRange) -> String? {
        let text = value as NSString
        guard range.location >= 0,
              range.length > 0,
              range.location <= text.length,
              range.length <= text.length - range.location else {
            return nil
        }

        let selected = text.substring(
            with: NSRange(location: range.location, length: range.length)
        ).trimmingCharacters(in: .whitespacesAndNewlines)
        return selected.isEmpty ? nil : selected
    }

    private static func copiedSelectedText() -> String? {
        let pasteboard = NSPasteboard.general
        let savedItems = snapshotItems(from: pasteboard)
        let originalChangeCount = pasteboard.changeCount

        guard postCopyShortcut() else { return nil }

        let deadline = Date().addingTimeInterval(copyTimeout)
        while pasteboard.changeCount == originalChangeCount, Date() < deadline {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.01))
        }

        guard pasteboard.changeCount != originalChangeCount else { return nil }
        let copied = pasteboard.string(forType: .string)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        restore(savedItems, to: pasteboard)
        return copied?.isEmpty == false ? copied : nil
    }

    private static func postCopyShortcut() -> Bool {
        guard let keyDown = CGEvent(
            keyboardEventSource: nil,
            virtualKey: CGKeyCode(kVK_ANSI_C),
            keyDown: true
        ),
        let keyUp = CGEvent(
            keyboardEventSource: nil,
            virtualKey: CGKeyCode(kVK_ANSI_C),
            keyDown: false
        ) else {
            return false
        }

        keyDown.flags = .maskCommand
        keyUp.flags = .maskCommand
        keyDown.post(tap: .cghidEventTap)
        keyUp.post(tap: .cghidEventTap)
        return true
    }

    private static func snapshotItems(from pasteboard: NSPasteboard) -> [[NSPasteboard.PasteboardType: Data]] {
        pasteboard.pasteboardItems?.map { item in
            Dictionary(uniqueKeysWithValues: item.types.compactMap { type in
                item.data(forType: type).map { (type, $0) }
            })
        } ?? []
    }

    private static func restore(
        _ snapshots: [[NSPasteboard.PasteboardType: Data]],
        to pasteboard: NSPasteboard
    ) {
        pasteboard.clearContents()
        let items = snapshots.map { snapshot in
            let item = NSPasteboardItem()
            for (type, data) in snapshot {
                item.setData(data, forType: type)
            }
            return item
        }
        if !items.isEmpty {
            pasteboard.writeObjects(items)
        }
    }

    private static func parents(of element: AXUIElement, limit: Int) -> [AXUIElement] {
        var parents: [AXUIElement] = []
        var current = element

        for _ in 0..<limit {
            var parentValue: CFTypeRef?
            guard AXUIElementCopyAttributeValue(
                current,
                kAXParentAttribute as CFString,
                &parentValue
            ) == .success,
            let parentValue else {
                break
            }

            let parent = unsafeDowncast(parentValue, to: AXUIElement.self)
            parents.append(parent)
            current = parent
        }

        return parents
    }
}
