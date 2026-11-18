import Foundation
import Testing
@testable import TodoTracker

@Suite(.serialized)
struct ShortcutConnectionControlTests {
    func client(_ host: String) -> (APIClient, URLSession) {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ShortcutControlProtocol.self]
        let session = URLSession(configuration: config)
        return (APIClient(baseURL: URL(string: "https://\(host)")!, session: session, credential: { "synthetic-only" }), session)
    }

    @Test("Off uses one explicit PATCH and confirms a readback without sync or Task writes")
    func offAndReadback() async throws {
        ShortcutControlProtocol.log.reset()
        let (api, session) = client("success.fixture.invalid"); defer { session.invalidateAndCancel() }
        #expect(try await api.shortcutConnectionControl().controlMode == "automatic")
        #expect(try await api.turnOffShortcutConnection().isOff)
        #expect(ShortcutControlProtocol.log.read().requests == ["GET /api/connections/shortcut", "PATCH /api/connections/shortcut", "GET /api/connections/shortcut"])
        #expect(ShortcutControlProtocol.log.read().mode == "off")
    }

    @Test("An unconfirmed or unauthorized Off request is never retried")
    func failedWriteIsNotRetried() async {
        for host in ["unconfirmed.fixture.invalid", "unauthorized.fixture.invalid"] {
            ShortcutControlProtocol.log.reset()
            let (api, session) = client(host); defer { session.invalidateAndCancel() }
            await #expect(throws: (any Error).self) { try await api.turnOffShortcutConnection() }
            #expect(ShortcutControlProtocol.log.read().requests == ["PATCH /api/connections/shortcut"])
        }
    }
}

private final class ShortcutControlLog: @unchecked Sendable {
    private let lock = NSLock()
    private var requests: [String] = []
    private var mode: String?
    func reset() { lock.withLock { requests = []; mode = nil } }
    func add(_ request: URLRequest) -> Bool {
        lock.withLock {
            requests.append("\(request.httpMethod!) \(request.url!.path)")
            if request.httpMethod == "PATCH" {
                var bytes = request.httpBody
                if bytes == nil, let stream = request.httpBodyStream {
                    stream.open(); defer { stream.close() }
                    var buffer = [UInt8](repeating: 0, count: 128)
                    let count = stream.read(&buffer, maxLength: buffer.count)
                    if count > 0 { bytes = Data(buffer.prefix(count)) }
                }
                mode = bytes.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] }?["mode"]
            }
            return mode == "off"
        }
    }
    func read() -> (requests: [String], mode: String?) { lock.withLock { (requests, mode) } }
}

private final class ShortcutControlProtocol: URLProtocol, @unchecked Sendable {
    static let log = ShortcutControlLog()
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let off = Self.log.add(request)
        let unauthorized = request.url!.host == "unauthorized.fixture.invalid"
        let confirmed = request.url!.host != "unconfirmed.fixture.invalid"
        let json = unauthorized ? #"{"error":"Synthetic unauthorized"}"# : "{\"connection\":{\"controlMode\":\"\(off ? "off" : "automatic")\",\"paused\":\(off && confirmed)}}"
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: unauthorized ? 401 : 200, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(json.utf8)); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
