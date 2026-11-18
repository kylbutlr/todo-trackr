import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../apps/macos/Sources/Views/MiniDashboardView.swift", import.meta.url),
  "utf8",
);
const windowControllerSource = readFileSync(
  new URL(
    "../apps/macos/Sources/Services/MiniDashboardWindowController.swift",
    import.meta.url,
  ),
  "utf8",
);

describe("Mini Trackr quick add", () => {
  it("moves sync to the title bar and keeps the header controls aligned", () => {
    const header = source.slice(
      source.indexOf("private var header: some View"),
      source.indexOf("private var signedInContent: some View"),
    );
    const title = header.indexOf('Text("Mini Trackr")');
    const spacer = header.indexOf("Spacer()", title);
    const star = header.indexOf('Image(systemName: starredOnly ? "star.fill" : "star")', spacer);
    const pin = header.indexOf('Image(systemName: alwaysOnTop ? "pin.fill" : "pin")', star);

    expect(title).toBeGreaterThan(-1);
    expect(header.slice(title)).toContain(".font(DesignTokens.sans(16, weight: .bold))");
    expect(header).not.toContain('Text("MINI DASHBOARD")');
    expect(header).not.toContain('Text(starredOnly ? "Starred" : "Open Tasks")');
    expect(header).not.toContain("MiniDashboardSyncStatusView");
    expect(spacer).toBeGreaterThan(title);
    expect(star).toBeGreaterThan(spacer);
    expect(pin).toBeGreaterThan(star);
    expect(windowControllerSource).toContain("installSyncStatusAccessory(on: panel, store: store)");
    expect(windowControllerSource).toContain("accessoryController.layoutAttribute = .right");
    expect(windowControllerSource).toContain("MiniDashboardSyncStatusView()");
    expect(windowControllerSource).toContain(".frame(width: 44, height: 28)");
  });

  it("starts collapsed and exposes a dedicated launcher", () => {
    expect(source).toContain("@State private var isQuickAddExpanded = false");
    expect(source).toContain("if !isQuickAddExpanded");
    expect(source).toContain("quickAddLauncher");
    expect(source).toContain('accessibilityLabel("Show Add to Inbox")');
  });

  it("keeps submit to the left of the close control when expanded", () => {
    const quickAdd = source.slice(source.indexOf("private var quickAdd: some View"));
    expect(quickAdd.indexOf("Button(action: createTask)")).toBeGreaterThan(-1);
    expect(quickAdd.indexOf("Button(action: collapseQuickAdd)")).toBeGreaterThan(
      quickAdd.indexOf("Button(action: createTask)"),
    );
    expect(quickAdd).toContain(".focused($isQuickAddFocused)");
  });

  it("collapses only after a task is created successfully", () => {
    const createTask = source.slice(source.indexOf("private func createTask()"));
    expect(createTask).toContain("if created {");
    expect(createTask).toContain("collapseQuickAdd()");
  });

  it("keeps both quick-add states above the scrolling timeline", () => {
    const signedIn = source.slice(
      source.indexOf("private var signedInContent: some View"),
      source.indexOf("private var signedOutContent: some View"),
    );

    expect(signedIn).toContain(".zIndex(MiniDashboardLayer.timeline)");
    expect(signedIn).toContain(".zIndex(MiniDashboardLayer.quickAdd)");
  });

  it("animates opening and closing with the shared spring", () => {
    const expand = source.slice(
      source.indexOf("private func expandQuickAdd()"),
      source.indexOf("private func collapseQuickAdd()"),
    );
    const collapse = source.slice(source.indexOf("private func collapseQuickAdd()"));

    expect(expand).toContain("withAnimation(MiniDashboardMotion.quickAdd)");
    expect(collapse).toContain("withAnimation(MiniDashboardMotion.quickAdd)");
  });
});
