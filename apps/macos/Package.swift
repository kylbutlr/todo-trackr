// swift-tools-version: 6.2
import Foundation
import PackageDescription

let profile = ProcessInfo.processInfo.environment["TODO_TRACKR_BUILD_PROFILE"] ?? "public"
guard ["public", "personal"].contains(profile) else { fatalError("Unknown Todo Trackr build profile") }
let personal = profile == "personal"
struct ExtraTarget: Decodable { let name: String; let path: String; let dependencies: [String] }
struct PersonalPackage: Decodable {
    let libraries: [ExtraTarget]
    let executables: [ExtraTarget]
    let appDependencies: [String]
    let testDependencies: [String]
}
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let config: PersonalPackage? = personal ? {
    guard let data = try? Data(contentsOf: root.appendingPathComponent("Personal/build.json")),
          let config = try? JSONDecoder().decode(PersonalPackage.self, from: data) else {
        fatalError("Personal build requires the local Personal integration package; public builds do not")
    }
    return config
}() : nil
var products: [Product] = [.executable(name: "TodoTracker", targets: ["TodoTracker"])]
var dependencies: [Target.Dependency] = [.product(name: "Sparkle", package: "Sparkle")]
var targets: [Target] = []
if let config {
    for library in config.libraries {
        targets.append(.target(name: library.name, dependencies: library.dependencies.map { .byName(name: $0) }, path: "Personal/\(library.path)"))
    }
    for executable in config.executables {
        products.append(.executable(name: executable.name, targets: [executable.name]))
        targets.append(.executableTarget(name: executable.name, dependencies: executable.dependencies.map { .byName(name: $0) }, path: "Personal/\(executable.path)"))
    }
    dependencies += config.appDependencies.map { .byName(name: $0) }
}
let commonExcludes = ["Resources", "Sources/Resources", "Tests", "Package.swift", "Package.resolved"]
targets += [.executableTarget(
    name: "TodoTracker", dependencies: dependencies, path: ".",
    exclude: commonExcludes + (personal ? ["Sources/Models/PublicWorkIntegration.swift", "Personal/build.json", "Personal/Shared", "Personal/NativeHost", "Personal/Acceptance", "Personal/Tests"] : ["Personal"]),
    sources: personal ? ["Sources", "Personal/Sources"] : ["Sources"],
    linkerSettings: [.linkedFramework("Security"), .unsafeFlags(["-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"])]
)]
targets += [.testTarget(name: "TodoTrackerTests", dependencies: ["TodoTracker"], path: "Tests")]
if let config {
    targets += [.testTarget(name: "PersonalIntegrationTests", dependencies: [.byName(name: "TodoTracker")] + config.testDependencies.map { .byName(name: $0) }, path: "Personal/Tests")]
}
let package = Package(name: "TodoTracker", platforms: [.macOS(.v14)], products: products,
    dependencies: [.package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.9.5")], targets: targets)
