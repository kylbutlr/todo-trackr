import AppKit
import SwiftUI
import Testing
@testable import TodoTracker

@MainActor
struct MiniDashboardLayoutTests {
    @Test("Shortcut metadata supplies both labels when values are missing")
    func shortcutMetadataFallbacks() throws {
        let dueDate = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 29, hour: 12)))
        let septemberDate = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 28, hour: 12)))
        let octoberDate = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 1, hour: 12)))
        #expect(ShortcutMetadataLabels.workflowState("Production Approved") == "Production Approved")
        #expect(ShortcutMetadataLabels.workflowState(nil) == "N/A")
        #expect(ShortcutMetadataLabels.workflowState("  ") == "N/A")
        #expect(ShortcutMetadataLabels.dueDate(dueDate) != "N/A")
        #expect(ShortcutMetadataLabels.dueDate(nil) == "N/A")
        #expect(ShortcutMetadataLabels.numericDueDate(dueDate) == "9/29")
        #expect(ShortcutMetadataLabels.numericDueDate(septemberDate) == "9/28")
        #expect(ShortcutMetadataLabels.numericDueDate(octoberDate) == "10/1")
        #expect(ShortcutMetadataLabels.numericDueDate(nil) == "N/A")
        #expect(ShortcutMetadataLabels.stateAndDueDate(nil, nil) == "N/A | N/A")
        #expect(ShortcutMetadataLabels.stateAndDueDate("Production Approved", dueDate).contains("Production Approved | "))
    }

    @Test("Shortcut metadata renders at compact and expanded Mini widths")
    func renderShortcutMetadata() throws {
        let fonts = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .deletingLastPathComponent().appendingPathComponent("Sources/Resources/Fonts")
        for font in ["Geist-Variable.ttf", "GeistMono-Variable.ttf"] {
            CTFontManagerRegisterFontsForURL(fonts.appendingPathComponent(font) as CFURL, .process, nil)
        }
        let previewDirectory = ProcessInfo.processInfo.environment["TODO_TRACKR_MINI_METADATA_PREVIEW_DIRECTORY"]
        let dueDate = try #require(ISO8601DateFormatter().date(from: "2026-09-29T19:00:00Z"))

        for width in [CGFloat(340), 480] {
            for (label, state, date) in [
                ("undated", Optional("Production Approved"), Optional<Date>.none),
                ("dated", Optional("Production Approved"), Optional(dueDate)),
                ("missing-state", Optional<String>.none, Optional<Date>.none),
            ] {
                let renderer = ImageRenderer(content:
                    MiniShortcutMetadataLines(
                        reference: "123456",
                        epicName: "Example Client and Epic with a Longer Name",
                        priority: .high,
                        workflowStateName: state,
                        dueDate: date,
                        epicColor: DesignTokens.action,
                        priorityColor: DesignTokens.danger
                    )
                    .frame(width: width - 44)
                    .padding(10)
                    .background(DesignTokens.surface)
                )
                renderer.scale = 2
                let image = try #require(renderer.nsImage)
                #expect(image.size.height > 30)
                if let previewDirectory {
                    let tiff = try #require(image.tiffRepresentation)
                    let bitmap = try #require(NSBitmapImageRep(data: tiff))
                    let png = try #require(bitmap.representation(using: .png, properties: [:]))
                    try png.write(to: URL(fileURLWithPath: previewDirectory)
                        .appendingPathComponent("mini-shortcut-metadata-\(label)-\(Int(width)).png"))
                }
            }
        }
    }

    @Test("Pinned section headings conceal the rows scrolling behind them")
    func pinnedHeaderIsOpaque() throws {
        // A pinned header must render identically over different underlying rows,
        // including with the app's default translucent-window appearance.
        func render(over color: Color) throws -> Data {
            let renderer = ImageRenderer(content:
                MiniDashboardSectionHeader(id: "later", title: "Later", count: 2)
                    .frame(width: 310)
                    .background(color)
            )
            return try #require(renderer.nsImage?.tiffRepresentation)
        }
        #expect(try render(over: .red) == render(over: .blue))
    }

    @Test("Render the fixed sync footer with a scrolled timeline")
    func renderScrolledFooter() throws {
        guard let directory = ProcessInfo.processInfo.environment["TODO_TRACKR_SYNC_PREVIEW_DIRECTORY"] else { return }
        let fonts = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .deletingLastPathComponent().appendingPathComponent("Sources/Resources/Fonts")
        for font in ["Geist-Variable.ttf", "GeistMono-Variable.ttf"] {
            CTFontManagerRegisterFontsForURL(fonts.appendingPathComponent(font) as CFURL, .process, nil)
        }
        let defaults = UserDefaults(suiteName: "MiniFooterTests.\(UUID())")!
        let schedule = ShortcutSyncSchedule(defaults: defaults, now: { .distantPast })
        for width in [CGFloat(340), 480] {
            let view = NSHostingView(rootView:
                VStack(spacing: 0) {
                    Text("Mini Trackr").font(DesignTokens.sans(16, weight: .bold))
                        .frame(maxWidth: .infinity, alignment: .leading).padding(14)
                    ScrollView {
                        LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                            ForEach(0..<3) { section in
                                Section {
                                    ForEach(0..<8) { row in
                                        Text("Task \(section + 1).\(row + 1)")
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .padding(16).background(DesignTokens.surface)
                                    }
                                } header: {
                                    MiniDashboardSectionHeader(id: "later", title: "Later \(section + 1)", count: 8)
                                }
                            }
                        }.padding(.horizontal, 12)
                    }.clipped()
                    MiniDashboardSyncFooter(schedule: schedule, workSwitchStatus: "Switchr: Pending", isVisible: { true }, sync: {})
                }
                .foregroundStyle(DesignTokens.text)
                .background(DesignTokens.canvas)
            )
            view.frame = NSRect(x: 0, y: 0, width: width, height: 480)
            view.layoutSubtreeIfNeeded()
            func scrollView(in parent: NSView) -> NSScrollView? {
                if let scroll = parent as? NSScrollView { return scroll }
                return parent.subviews.compactMap { scrollView(in: $0) }.first
            }
            let scroll = try #require(scrollView(in: view))
            for offset in [CGFloat(0), 125, 600] {
                scroll.contentView.scroll(to: NSPoint(x: 0, y: offset))
                scroll.reflectScrolledClipView(scroll.contentView)
                view.layoutSubtreeIfNeeded()
                let bitmap = try #require(view.bitmapImageRepForCachingDisplay(in: view.bounds))
                view.cacheDisplay(in: view.bounds, to: bitmap)
                let png = try #require(bitmap.representation(using: .png, properties: [:]))
                try png.write(to: URL(fileURLWithPath: directory)
                    .appendingPathComponent("mini-footer-\(Int(width))-\(Int(offset)).png"))
            }
        }
    }
}
