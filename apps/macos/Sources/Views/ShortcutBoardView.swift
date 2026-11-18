import SwiftUI

struct ShortcutBoardListView: View {
    @EnvironmentObject private var store: TaskStore
    @AppStorage("todo-trackr.shortcut-board.scope") private var scopeRaw = ShortcutBoardScope.either.rawValue
    @State private var search = ""
    var automaticallySelectFirstStory = true
    var isCompact = false

    private var scope: ShortcutBoardScope {
        get { ShortcutBoardScope(rawValue: scopeRaw) ?? .either }
        nonmutating set { scopeRaw = newValue.rawValue }
    }

    private var stories: [ShortcutBoardStory] {
        store.shortcutStories(scope: scope, search: search)
    }

    private var sections: [ShortcutBoardSection] {
        ShortcutBoardGrouping.sections(for: stories)
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text("LIVE SOURCE WORKSPACE")
                    .font(DesignTokens.sans(12, weight: .bold))
                    .tracking(1.1)
                    .foregroundStyle(DesignTokens.action)
                HStack(alignment: .firstTextBaseline) {
                    Text("Shortcut")
                        .font(DesignTokens.sans(32, weight: .bold))
                        .tracking(-0.64)
                        .foregroundStyle(DesignTokens.text)
                    Spacer()
                    Text("\(stories.count) \(stories.count == 1 ? "story" : "stories")")
                        .font(DesignTokens.mono(12))
                        .foregroundStyle(DesignTokens.textMuted)
                }
            }
            .padding(.horizontal, isCompact ? 20 : 28)
            .padding(.top, isCompact ? 20 : 28)

            HStack(spacing: 8) {
                TextField("Search Shortcut", text: $search)
                    .textFieldStyle(.roundedBorder)
                Picker("Scope", selection: Binding(get: { scope }, set: { scope = $0 })) {
                    ForEach(ShortcutBoardScope.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                .pickerStyle(.menu)
                .frame(minWidth: 150)
            }
            .padding(.horizontal, isCompact ? 20 : 28)
            .padding(.vertical, 20)

            if stories.isEmpty && !store.isShortcutBoardLoading {
                ContentUnavailableView(
                    "No matching Stories",
                    systemImage: "link",
                    description: Text("No active Shortcut Stories match \(scope.title.lowercased()).")
                )
                .frame(maxHeight: .infinity)
            } else {
                List {
                    ForEach(sections) { section in
                        Section {
                            ForEach(section.stories) { story in
                                ShortcutBoardListRow(story: story)
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        store.selectedShortcutStoryReference = story.externalReference
                                    }
                                    .listRowBackground(
                                        store.selectedShortcutStoryReference == story.externalReference
                                            ? DesignTokens.selected
                                            : DesignTokens.surface
                                    )
                            }
                        } header: {
                            HStack(spacing: 8) {
                                Text(section.title)
                                    .foregroundStyle(sectionTitleColor(section.id))
                                Rectangle()
                                    .fill(DesignTokens.border)
                                    .frame(height: 1)
                                Text("\(section.stories.count)")
                                    .font(DesignTokens.mono(10))
                                    .foregroundStyle(DesignTokens.textMuted)
                            }
                            .font(DesignTokens.sans(11, weight: .bold))
                        }
                    }
                }
                .listStyle(.inset)
                .scrollContentBackground(.hidden)
                .appSurfaceBackground(.canvas)
                .refreshable { await ConnectionContext.$trigger.withValue(.manual) { await store.refreshShortcutBoard() } }
            }
        }
        .appSurfaceBackground(.canvas)
        .navigationTitle("Shortcut")
        .task {
            if store.shortcutBoardStories.isEmpty {
                await store.refreshShortcutBoard()
            }
        }
        .onChange(of: stories.map(\.externalReference), initial: true) { _, references in
            guard automaticallySelectFirstStory else {
                if let selected = store.selectedShortcutStoryReference, !references.contains(selected) {
                    store.selectedShortcutStoryReference = nil
                }
                return
            }
            if store.selectedShortcutStoryReference == nil
                || !references.contains(store.selectedShortcutStoryReference!) {
                store.selectedShortcutStoryReference = references.first
            }
        }
    }

    private func sectionTitleColor(_ sectionID: String) -> Color {
        switch sectionID {
        case "overdue": DesignTokens.danger
        case "today": DesignTokens.warning
        default: DesignTokens.textMuted
        }
    }
}

struct ShortcutBoardDetailView: View {
    @EnvironmentObject private var store: TaskStore
    let story: ShortcutBoardStory

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("SHORTCUT STORY")
                            .font(DesignTokens.sans(11, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(DesignTokens.action)
                        Text(story.title)
                            .font(DesignTokens.sans(22, weight: .bold))
                            .foregroundStyle(DesignTokens.text)
                    }
                    Spacer(minLength: 12)
                    Button {
                        Task { await store.toggleShortcutBoardStar(story) }
                    } label: {
                        Image(systemName: story.isStarred ? "star.fill" : "star")
                            .foregroundStyle(story.isStarred ? DesignTokens.warning : DesignTokens.textMuted)
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                }

                Divider().overlay(DesignTokens.border)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Source")
                        .font(DesignTokens.sans(12, weight: .medium))
                        .foregroundStyle(DesignTokens.textMuted)
                    Link("Open SC-\(story.externalReference)", destination: story.sourceUrl)
                        .font(DesignTokens.sans(13, weight: .semibold))
                        .foregroundStyle(DesignTokens.action)
                }

                FlowLayout(spacing: 6) {
                    ShortcutFact(text: ShortcutMetadataLabels.stateAndDueDate(story.workflowStateName, story.parsedDueDate))
                    ShortcutFact(text: story.relationshipLabel)
                    ShortcutFact(text: story.priority == .none ? "No priority" : story.priority.label)
                    if let size = story.size { ShortcutFact(text: "Size \(size)") }
                }

                Text("Read-only from Shortcut. Todo Trackr never changes this Story.")
                    .font(DesignTokens.sans(12))
                    .foregroundStyle(DesignTokens.textMuted)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(DesignTokens.surface, in: RoundedRectangle(cornerRadius: 8))
                    .overlay { RoundedRectangle(cornerRadius: 8).stroke(DesignTokens.border) }

                Spacer(minLength: 0)
            }
            .padding(28)
        }
        .appSurfaceBackground(.sidebar)
    }
}

private struct ShortcutBoardListRow: View {
    @EnvironmentObject private var store: TaskStore
    let story: ShortcutBoardStory

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 11) {
                VStack(spacing: 2) {
                    Link(destination: story.sourceUrl) {
                        Image(systemName: "link")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(DesignTokens.action)
                            .frame(width: 24, height: 24)
                            .background(DesignTokens.selected, in: RoundedRectangle(cornerRadius: 7))
                    }
                    .buttonStyle(.plain)
                    .help("Open SC-\(story.externalReference) in Shortcut")
                }
                .frame(width: 46)

                Text(story.title)
                    .foregroundStyle(DesignTokens.text)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    Task { await store.toggleShortcutBoardStar(story) }
                } label: {
                    Image(systemName: story.isStarred ? "star.fill" : "star")
                        .foregroundStyle(story.isStarred ? DesignTokens.warning : DesignTokens.textMuted)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 7) {
                Color.clear.frame(width: 46)
                Text(story.externalReference)
                    .font(DesignTokens.mono(10))
                    .foregroundStyle(DesignTokens.textMuted)
                    .lineLimit(1)
                Label(story.epicName ?? "Shortcut", systemImage: "link")
                    .font(DesignTokens.mono(11))
                    .foregroundStyle(DesignTokens.action)
                    .lineLimit(1)
                Circle()
                    .fill(priorityColor)
                    .frame(width: 7, height: 7)
                Text(story.priority == .none ? "No priority" : story.priority.label)
                    .font(DesignTokens.mono(12))
                    .foregroundStyle(story.priority == .none ? DesignTokens.textMuted : priorityColor)
                Text(story.relationshipLabel)
                    .font(DesignTokens.mono(11))
                    .foregroundStyle(DesignTokens.textMuted)
                Spacer(minLength: 0)
                ShortcutStateDueLabel(
                    workflowStateName: story.workflowStateName,
                    dueDate: story.parsedDueDate,
                    fontSize: 12
                )
                .layoutPriority(1)
            }
        }
        .padding(.vertical, 4)
    }

    private var priorityColor: Color {
        switch story.priority {
        case .none, .lowest: DesignTokens.textMuted
        case .low: DesignTokens.success
        case .medium: DesignTokens.warning
        case .high, .highest: DesignTokens.danger
        }
    }
}

private struct ShortcutFact: View {
    let text: String

    var body: some View {
        Text(text)
            .font(DesignTokens.mono(10))
            .foregroundStyle(DesignTokens.textMuted)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(DesignTokens.surfaceRaised, in: Capsule())
    }
}

private struct FlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        layout(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = layout(proposal: ProposedViewSize(width: bounds.width, height: bounds.height), subviews: subviews)
        for (index, point) in result.points.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        let width = proposal.width ?? .infinity
        var points: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return (CGSize(width: width.isFinite ? width : x, height: y + rowHeight), points)
    }
}
