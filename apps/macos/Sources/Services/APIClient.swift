import Foundation

actor APIClient {
    static let shared = APIClient(activity: ConnectionTelemetry.recorder)

    nonisolated let activity: ConnectionRecorder?
    private var baseURL: URL
    private let credential: (@Sendable () throws -> String?)?
    private var capabilities = InstallationCapabilities.legacy
    private nonisolated let connectionGeneration = ConnectionGeneration()
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private var taskSnapshots: [String: TaskSnapshot] = [:]

    private struct TaskSnapshot {
        let etag: String?
        let tasks: [TaskItem]
    }

    init(
        baseURL: URL = APIClient.configuredBaseURL(),
        session: URLSession = .shared,
        activity: ConnectionRecorder? = nil,
        credential: (@Sendable () throws -> String?)? = nil
    ) {
        self.credential = credential
        self.activity = activity
        self.baseURL = baseURL
        self.session = session

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

            if let date = formatter.date(from: value) {
                return date
            }

            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: value) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid ISO-8601 date."
            )
        }
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
    }

    nonisolated static func configuredBaseURL() -> URL {
        ServerConnection.configuredURL()
    }

    func configure(server: URL) {
        connectionGeneration.invalidate()
        baseURL = server
        capabilities = .legacy
        taskSnapshots = [:]
        UserDefaults.standard.set(server.absoluteString, forKey: ServerConnection.preferenceKey)
    }

    func installation() async throws -> InstallationCapabilities {
        do {
            let settings: InstallationCapabilities = try await send(path: "/api/installation", requiresAuthentication: false)
            guard settings.apiVersion == 1, ["password", "none"].contains(settings.authenticationMode) else { throw APIError.invalidResponse }
            capabilities = settings
            return settings
        } catch APIError.serverStatus(404) {
            capabilities = .legacy
            return .legacy
        }
    }

    func validateSession() async throws {
        struct Session: Decodable { let authenticated: Bool }
        let result: Session = try await send(path: "/api/auth/session")
        guard result.authenticated else { throw APIError.unauthorized }
    }

    func login(password: String) async throws {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        struct LoginBody: Encodable {
            let password: String
            let client = "macos"
        }

        struct LoginResponse: Decodable {
            let token: String
        }

        let response: LoginResponse = try await send(
            path: "/api/auth/login",
            method: "POST",
            body: LoginBody(password: password),
            requiresAuthentication: false
        )
        try KeychainStore.save(token: response.token, server: baseURL)
            }
    }

    func workPermission() async throws -> WorkPermission {
        try await send(path: "/api/work-state", method: "GET")
    }

    func resumeWork() async throws {
        try await sendWithoutResponse(path: "/api/work-resume", method: "POST")
    }

    func listTasks() async throws -> [TaskItem] {
        try await fetchTasks(path: "/api/tasks")
    }

    func listOpenTasks() async throws -> [TaskItem] {
        try await fetchTasks(path: "/api/tasks?status=open")
    }

    private func fetchTasks(path: String) async throws -> [TaskItem] {
        struct TasksResponse: Decodable {
            let tasks: [TaskItem]
        }

        var request = try makeRequest(
            path: path,
            method: "GET",
            body: nil,
            requiresAuthentication: true
        )
        if let etag = taskSnapshots[path]?.etag {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }

        let (data, response) = try await recordedData(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        if httpResponse.statusCode == 304, let snapshot = taskSnapshots[path] {
            return snapshot.tasks
        }

        try validate(response: response, data: data)
        let tasks = try decoder.decode(TasksResponse.self, from: data).tasks
        taskSnapshots[path] = TaskSnapshot(
            etag: httpResponse.value(forHTTPHeaderField: "ETag"),
            tasks: tasks
        )
        return tasks
    }

    func listTaskLists() async throws -> [TaskListItem] {
        struct ListsResponse: Decodable {
            let lists: [TaskListItem]
        }

        let response: ListsResponse = try await send(path: "/api/lists")
        return response.lists
    }

    func reviewSummary() async throws -> ReviewSummary {
        struct ReviewSummaryResponse: Decodable { let summary: ReviewSummary }
        let response: ReviewSummaryResponse = try await send(path: "/api/review-summary")
        return response.summary
    }

    func shortcutBoard() async throws -> ShortcutBoardSnapshot {
        struct BoardResponse: Decodable { let board: ShortcutBoardSnapshot }
        let response: BoardResponse = try await send(path: "/api/shortcut-board")
        return response.board
    }

    func syncShortcutNow() async throws -> Bool {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        struct SyncResponse: Decodable {
            struct Result: Decodable {
                let outcome: String
                let applied: Int
            }

            let result: Result
        }

        let response: SyncResponse = try await send(
            path: "/api/connections/shortcut/sync",
            method: "POST"
        )
        return response.result.outcome == "applied"
            }
    }

    func setShortcutBoardStar(externalReference: String, isStarred: Bool) async throws {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        struct StarBody: Encodable { let isStarred: Bool }

        try await sendWithoutResponse(
            path: "/api/shortcut-board/\(externalReference)",
            method: "PATCH",
            body: StarBody(isStarred: isStarred)
        )
            }
    }

    func createTaskList(name: String) async throws -> TaskListItem {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        struct CreateListBody: Encodable { let name: String }
        struct ListResponse: Decodable { let list: TaskListItem }

        let response: ListResponse = try await send(
            path: "/api/lists",
            method: "POST",
            body: CreateListBody(name: name)
        )
        return response.list
            }
    }

    func createTask(_ input: CreateTaskInput) async throws -> TaskItem {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        struct TaskResponse: Decodable {
            let task: TaskItem
        }

        let response: TaskResponse = try await send(
            path: "/api/tasks",
            method: "POST",
            body: input
        )
        return response.task
            }
    }

    func updateTask(id: UUID, input: UpdateTaskInput) async throws -> TaskItem {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        struct TaskResponse: Decodable {
            let task: TaskItem
        }

        let response: TaskResponse = try await send(
            path: "/api/tasks/\(id.uuidString.lowercased())",
            method: "PATCH",
            body: input
        )
        return response.task
            }
    }

    func deleteTask(id: UUID) async throws {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        try await sendWithoutResponse(
            path: "/api/tasks/\(id.uuidString.lowercased())",
            method: "DELETE"
        )
            }
    }

    func listCodexSessions(taskId: UUID) async throws -> [CodexSessionItem] {
        struct SessionsResponse: Decodable { let sessions: [CodexSessionItem] }
        let response: SessionsResponse = try await send(
            path: "/api/tasks/\(taskId.uuidString.lowercased())/codex-sessions"
        )
        return response.sessions
    }

    func attachCodexSession(taskId: UUID, reference: String) async throws -> CodexSessionItem {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        struct AttachBody: Encodable { let reference: String }
        struct SessionResponse: Decodable { let session: CodexSessionItem }
        let response: SessionResponse = try await send(
            path: "/api/tasks/\(taskId.uuidString.lowercased())/codex-sessions",
            method: "POST",
            body: AttachBody(reference: reference)
        )
        return response.session
            }
    }

    func detachCodexSession(id: UUID) async throws {
        return try await ConnectionContext.$trigger.withValue(ConnectionContext.trigger ?? .manual) {
        try await sendWithoutResponse(
            path: "/api/codex-sessions/\(id.uuidString.lowercased())",
            method: "DELETE"
        )
            }
    }

    nonisolated func signOut() throws {
        connectionGeneration.invalidate()
        try KeychainStore.removeToken(server: Self.configuredBaseURL())
    }

    nonisolated func hasStoredSession() -> Bool {
        (try? KeychainStore.token(server: Self.configuredBaseURL())) != nil
    }

    private func send<ResponseBody: Decodable>(
        path: String,
        method: String = "GET",
        requiresAuthentication: Bool = true
    ) async throws -> ResponseBody {
        let request = try makeRequest(
            path: path,
            method: method,
            body: nil,
            requiresAuthentication: requiresAuthentication
        )
        return try await perform(request)
    }

    private func send<ResponseBody: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body,
        requiresAuthentication: Bool = true
    ) async throws -> ResponseBody {
        let data = try encoder.encode(body)
        let request = try makeRequest(
            path: path,
            method: method,
            body: data,
            requiresAuthentication: requiresAuthentication
        )
        return try await perform(request)
    }

    private func sendWithoutResponse(
        path: String,
        method: String
    ) async throws {
        let request = try makeRequest(
            path: path,
            method: method,
            body: nil,
            requiresAuthentication: true
        )
        let (_, response) = try await recordedData(for: request)
        try validate(response: response, data: nil)
    }

    private func sendWithoutResponse<Body: Encodable>(
        path: String,
        method: String,
        body: Body
    ) async throws {
        let data = try encoder.encode(body)
        let request = try makeRequest(
            path: path,
            method: method,
            body: data,
            requiresAuthentication: true
        )
        let (responseData, response) = try await recordedData(for: request)
        try validate(response: response, data: responseData)
    }

    private func makeRequest(
        path: String,
        method: String,
        body: Data?,
        requiresAuthentication: Bool
    ) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        if requiresAuthentication && capabilities.authenticationMode != "none" {
            let storedToken: String?
            if let credential { storedToken = try credential() }
            else { storedToken = try KeychainStore.token(server: baseURL) }
            guard let token = storedToken else {
                throw APIError.unauthorized
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func perform<ResponseBody: Decodable>(
        _ request: URLRequest
    ) async throws -> ResponseBody {
        let (data, response) = try await recordedData(for: request)
        try validate(response: response, data: data)
        return try decoder.decode(ResponseBody.self, from: data)
    }


    private func recordedData(for request: URLRequest) async throws -> (Data, URLResponse) {
        let revision = connectionGeneration.current()
        let result = try await rawRecordedData(for: request)
        guard revision == connectionGeneration.current() else { throw APIError.connectionChanged }
        return result
    }

    private func rawRecordedData(for request: URLRequest) async throws -> (Data, URLResponse) {
        guard let activity else { return try await session.data(for: request) }
        let path = request.url?.path ?? ""
        let operation: ConnectionOperation
        switch path {
        case "/api/work-state": operation = .workState
        case "/api/work-resume": operation = .catchUp
        case "/api/auth/login": operation = .authentication
        case "/api/tasks": operation = .tasks
        case "/api/lists": operation = .lists
        case "/api/review-summary": operation = .review
        case "/api/connections/shortcut/sync": operation = .shortcut
        default:
            if path.contains("codex-sessions") { operation = .sessions }
            else if path.hasPrefix("/api/tasks/") { operation = .taskChange }
            else if path.hasPrefix("/api/shortcut-board") { operation = .shortcut }
            else { operation = .unknown }
        }
        return try await activity.data(for: request, session: session, operation: operation,
                                       trigger: operation == .workState ? .control : operation == .unknown ? .unknown : .automatic)
    }

    private func validate(response: URLResponse, data: Data?) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }
            if httpResponse.statusCode == 404 { throw APIError.serverStatus(404) }

            let message: String
            if let data,
               let payload = try? decoder.decode(ErrorResponse.self, from: data) {
                message = payload.error
                if payload.code == "TASK_CONFLICT", let currentTask = payload.currentTask {
                    throw APIError.taskConflict(message, currentTask)
                }
            } else {
                message = "Request failed with status \(httpResponse.statusCode)."
            }

            throw APIError.server(message)
        }
    }
}

private struct ErrorResponse: Decodable {
    let error: String
    let code: String?
    let currentTask: TaskItem?
}

private final class ConnectionGeneration: @unchecked Sendable {
    private let lock = NSLock()
    private var revision = 0
    func current() -> Int { lock.withLock { revision } }
    func invalidate() { lock.withLock { revision += 1 } }
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case server(String)
    case taskConflict(String, TaskItem)
    case unauthorized
    case connectionChanged
    case serverStatus(Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Todo Trackr has an invalid server URL."
        case .invalidResponse:
            return "Todo Trackr received an invalid server response."
        case let .server(message):
            return message
        case let .taskConflict(message, _):
            return message
        case .unauthorized:
            return "Your session has expired. Sign in again."
        case .connectionChanged:
            return "The server connection changed. Try again on the selected server."
        case let .serverStatus(status):
            return "The server returned HTTP \(status)."
        }
    }
}
