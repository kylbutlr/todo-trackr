import SwiftUI

struct TaskDetailView: View {
    @EnvironmentObject private var store: TaskStore
    let task: TaskItem

    @State private var draft: TaskEditorDraft
    @State private var baseline: TaskEditorDraft
    @State private var codexSessions: [CodexSessionItem] = []
    @State private var codexReference = ""
    @State private var codexLoading = true
    @State private var codexSaving = false
    @State private var codexError: String?
    @FocusState private var notesFocused: Bool

    private var sourceManaged: Bool { task.source == .shortcut }

    init(task: TaskItem) {
        self.task = task
        let initialDraft = TaskEditorDraft(task: task)
        _draft = State(initialValue: initialDraft)
        _baseline = State(initialValue: initialDraft)
    }

    var body: some View {
        Form {
            Section("Task Details") {
                TextField("Title", text: $draft.title)
                    .foregroundStyle(DesignTokens.text)
                    .disabled(sourceManaged)
                TextEditor(text: $draft.notes)
                    .foregroundStyle(DesignTokens.text)
                    .scrollContentBackground(.hidden)
                    .contentMargins(.horizontal, 12, for: .scrollContent)
                    .contentMargins(.vertical, 10, for: .scrollContent)
                    .background(DesignTokens.surfaceRaised)
                    .frame(minHeight: 150)
                    .focused($notesFocused)
                    .overlay(alignment: .topLeading) {
                        if Self.shouldShowNotesPlaceholder(
                            notes: draft.notes,
                            isFocused: notesFocused
                        ) {
                            Text("Add context or next steps")
                                .foregroundStyle(.tertiary)
                                .padding(.top, 10)
                                .padding(.leading, 17)
                                .allowsHitTesting(false)
                        }
                    }
                LabeledContent("Added") {
                    Text(task.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(DesignTokens.mono(12))
                        .foregroundStyle(DesignTokens.textMuted)
                }
            }

            if task.source != .manual {
                Section("Source") {
                    if let sourceURL = task.sourceUrl {
                        Link(destination: sourceURL) {
                            Label(
                                task.sourceDetails.map { "Open \(task.source.label) \($0.externalReference)" }
                                    ?? "Open \(task.source.label)",
                                systemImage: "arrow.up.right.square"
                            )
                        }
                    } else {
                        Label("Captured from \(task.source.label)", systemImage: "link")
                            .foregroundStyle(DesignTokens.textMuted)
                    }
                    if let summary = task.sourceDetails?.summary {
                        Text(summary)
                            .foregroundStyle(DesignTokens.textMuted)
                    }
                    HStack(spacing: 8) {
                        if task.source == .shortcut {
                            ShortcutStateDueLabel(
                                workflowStateName: task.sourceDetails?.workflowStateName,
                                dueDate: task.dueAt,
                                fontSize: 12
                            )
                        } else if let state = task.sourceDetails?.workflowStateName {
                            Text(state)
                        }
                        if let size = task.sourceDetails?.size {
                            Text("Size \(size)")
                        }
                        if sourceManaged {
                            Text("Managed by Shortcut")
                        }
                    }
                    .font(DesignTokens.mono(11))
                    .foregroundStyle(DesignTokens.textMuted)
                }
            }

            if store.installation.integrations.codex {
                Section("Codex Work Session") {
                    if codexLoading {
                        ProgressView("Loading work sessions")
                            .controlSize(.small)
                    } else if codexSessions.isEmpty {
                        Text("No Codex conversation is attached yet.")
                            .foregroundStyle(DesignTokens.textMuted)
                    }

                    ForEach(codexSessions) { session in
                        VStack(alignment: .leading, spacing: 10) {
                            Label(session.status.label, systemImage: session.status.symbolName)
                                .font(DesignTokens.mono(11))
                                .foregroundStyle(session.status == .waitingForYou || session.status == .readyForReview ? DesignTokens.warning : DesignTokens.action)
                            Text(session.title ?? "Codex conversation")
                                .fontWeight(.semibold)
                            Text(session.latestSummary ?? "Waiting for the first progress update.")
                                .font(.callout)
                                .foregroundStyle(DesignTokens.textMuted)
                            HStack(spacing: 12) {
                                if let threadUrl = session.threadUrl {
                                    Link("Open in Codex", destination: threadUrl)
                                }
                                if let prUrl = session.prUrl {
                                    Link("Open PR", destination: prUrl)
                                }
                                Spacer()
                                Button("Detach") {
                                    Task { await detachCodexSession(session) }
                                }
                                .buttonStyle(.plain)
                                .foregroundStyle(DesignTokens.textMuted)
                                .disabled(codexSaving)
                            }
                        }
                        .padding(.vertical, 6)
                    }

                    HStack(spacing: 8) {
                        TextField("Codex conversation URL or thread ID", text: $codexReference)
                            .onSubmit { Task { await attachCodexSession() } }
                        Button(codexSaving ? "Attaching…" : "Attach") {
                            Task { await attachCodexSession() }
                        }
                        .disabled(codexReference.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || codexSaving)
                    }

                    if let codexError {
                        Text(codexError)
                            .foregroundStyle(DesignTokens.danger)
                    }
                }
            }

            Section("Planning") {
                Picker("List", selection: $draft.listId) {
                    ForEach(store.lists) { list in
                        Text(list.name).tag(list.id)
                    }
                }
                Picker("Priority", selection: $draft.priority) {
                    ForEach(TaskPriority.allCases, id: \.self) { priority in
                        Text(priority.label).tag(priority)
                    }
                }
                .disabled(sourceManaged)

                Toggle("Due date", isOn: $draft.hasDueDate)
                    .disabled(sourceManaged)
                if draft.hasDueDate {
                    DatePicker("Due", selection: $draft.dueAt)
                        .disabled(sourceManaged)
                }

                Toggle("Attention alarm", isOn: $draft.hasAlarm)
                if draft.hasAlarm {
                    DatePicker("Remind me", selection: $draft.alarmAt)
                    if task.isAlarmAttentionActive {
                        HStack {
                            Label("Needs Attention", systemImage: "bell.badge.fill")
                                .foregroundStyle(DesignTokens.danger)
                            Spacer()
                            Button("Clear Alarm") {
                                Task { await store.clearAlarm(task) }
                            }
                        }
                    }
                }
            }

            Section {
                Button("Save Changes") {
                    Task {
                        await store.save(
                            task,
                            title: draft.title,
                            notes: draft.notes,
                            priority: draft.priority,
                            dueAt: draft.hasDueDate ? draft.dueAt : nil,
                            alarmAt: draft.hasAlarm ? draft.alarmAt : nil,
                            listId: draft.listId
                        )
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(DesignTokens.action)
                .foregroundStyle(DesignTokens.ink)
                .controlSize(.large)
                .disabled(draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .keyboardShortcut(.defaultAction)

                if !sourceManaged {
                    Button("Delete Task", role: .destructive) {
                        Task { await store.delete(task) }
                    }
                    .controlSize(.large)
                }
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .appSurfaceBackground(.sidebar)
        .navigationTitle("Task Details")
        .task(id: task.id) {
            await loadCodexSessions()
        }
        .onChange(of: task.updateToken) { _, _ in
            let refreshedBaseline = TaskEditorDraft(task: task)
            draft = draft.reconciling(task, baseline: baseline)
            baseline = refreshedBaseline
        }
    }

    nonisolated static func shouldShowNotesPlaceholder(notes: String, isFocused _: Bool) -> Bool {
        notes.isEmpty
    }

    @MainActor
    private func loadCodexSessions() async {
        guard store.installation.integrations.codex else { codexLoading = false; return }
        codexLoading = true
        codexError = nil
        do {
            codexSessions = try await APIClient.shared.listCodexSessions(taskId: task.id)
        } catch {
            codexError = error.localizedDescription
        }
        codexLoading = false
    }

    @MainActor
    private func attachCodexSession() async {
        guard store.installation.integrations.codex else { return }
        let reference = codexReference.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !reference.isEmpty else { return }
        codexSaving = true
        codexError = nil
        do {
            let session = try await APIClient.shared.attachCodexSession(taskId: task.id, reference: reference)
            codexSessions.removeAll { $0.id == session.id }
            codexSessions.insert(session, at: 0)
            codexReference = ""
        } catch {
            codexError = error.localizedDescription
        }
        codexSaving = false
    }

    @MainActor
    private func detachCodexSession(_ session: CodexSessionItem) async {
        guard store.installation.integrations.codex else { return }
        codexSaving = true
        codexError = nil
        do {
            try await APIClient.shared.detachCodexSession(id: session.id)
            codexSessions.removeAll { $0.id == session.id }
        } catch {
            codexError = error.localizedDescription
        }
        codexSaving = false
    }
}
