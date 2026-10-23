// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "TodoTracker",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "TodoTracker", targets: ["TodoTracker"])
    ],
    dependencies: [
        .package(
            url: "https://github.com/sparkle-project/Sparkle",
            exact: "2.9.5"
        )
    ],
    targets: [
        .executableTarget(
            name: "TodoTracker",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle")
            ],
            path: "Sources",
            exclude: ["Resources"],
            linkerSettings: [
                .linkedFramework("Security"),
                .unsafeFlags([
                    "-Xlinker", "-rpath",
                    "-Xlinker", "@executable_path/../Frameworks"
                ])
            ]
        ),
        .testTarget(
            name: "TodoTrackerTests",
            dependencies: ["TodoTracker"],
            path: "Tests"
        )
    ]
)
