import Foundation
import Testing
@testable import TodoTracker

struct ConnectionIntegrationTests {
    @Test func APIBoundaryPreservesManualAndAutomaticReasons() async throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent(".build/connections-test/" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let recorder = ConnectionRecorder(app: .todo, directory: root, version: "test", automaticFlush: false)
        recorder.setPermission(.off, revision: 12)
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ConnectionTestProtocol.self]
        let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
        let api = APIClient(baseURL: URL(string: "https://fixture.invalid")!, session: session, activity: recorder, credential: { "test-only" })
        _ = try await api.workPermission()
        _ = try await api.syncShortcutNow()
        _ = try await ConnectionContext.$trigger.withValue(.automatic) { try await api.syncShortcutNow() }
        _ = try await ConnectionContext.$trigger.withValue(.manual) { try await api.listOpenTasks() }
        recorder.flush(cleanShutdown: true)
        let history = ConnectionJournal.read(app: .todo, directory: root)
        #expect(history.starts.count == 4)
        #expect(history.starts.map(\.trigger) == [.control, .manual, .automatic, .manual])
        #expect(history.starts.filter(\.violation).count == 1)
        #expect(history.events.count == 8)
    }
}
private final class ConnectionTestProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let data: Data
        switch request.url!.path {
        case "/api/work-state": data = Data(#"{"configured":true,"state":"standby","revision":12,"leaseSeconds":0}"#.utf8)
        case "/api/connections/shortcut/sync": data = Data(#"{"result":{"outcome":"applied","applied":0}}"#.utf8)
        default: data = Data(#"{"tasks":[]}"#.utf8)
        }
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
