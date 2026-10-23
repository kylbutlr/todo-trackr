#!/usr/bin/env swift

import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write(Data("Usage: render-macos-icon.swift <output.png>\n".utf8))
    exit(64)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let pixelSize = 1_024
guard
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixelSize,
        pixelsHigh: pixelSize,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ),
    let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap)
else {
    FileHandle.standardError.write(Data("Unable to create icon graphics context.\n".utf8))
    exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphicsContext
defer { NSGraphicsContext.restoreGraphicsState() }

let context = graphicsContext.cgContext
context.setShouldAntialias(true)
context.clear(CGRect(x: 0, y: 0, width: pixelSize, height: pixelSize))

let iconRect = CGRect(x: 92, y: 92, width: 840, height: 840)
let iconPath = NSBezierPath(roundedRect: iconRect, xRadius: 190, yRadius: 190)
let gradient = NSGradient(colors: [
    NSColor(red: 13 / 255, green: 13 / 255, blue: 13 / 255, alpha: 1),
    NSColor(red: 59 / 255, green: 65 / 255, blue: 69 / 255, alpha: 1),
    NSColor(red: 137 / 255, green: 159 / 255, blue: 152 / 255, alpha: 1),
], atLocations: [0, 0.48, 1], colorSpace: .deviceRGB)!
gradient.draw(in: iconPath, angle: 45)

context.setStrokeColor(NSColor.white.cgColor)
context.setLineWidth(72)
context.setLineCap(.round)
context.setLineJoin(.round)
context.beginPath()
context.move(to: CGPoint(x: 315, y: 520))
context.addLine(to: CGPoint(x: 455, y: 375))
context.addLine(to: CGPoint(x: 730, y: 675))
context.strokePath()

guard
    let png = bitmap.representation(using: .png, properties: [:])
else {
    FileHandle.standardError.write(Data("Unable to encode icon PNG.\n".utf8))
    exit(1)
}

try png.write(to: outputURL, options: .atomic)
