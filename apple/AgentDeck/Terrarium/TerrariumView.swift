// TerrariumView.swift — 60fps animated aquarium using TimelineView + Canvas

import SwiftUI

struct TerrariumView: View {
    let terrariumState: TerrariumState
    var includeHabitat: Bool = true

    /// Optional tap handler: receives the session ID of the tapped creature.
    /// Works on macOS (click) and iOS/iPadOS (touch) — both use the same
    /// overlay + hit-test math because SwiftUI normalizes `onTapGesture` to
    /// the gesture recognizer that matches the platform.
    var onCreatureTapped: ((String) -> Void)?

    /// Optional tap handler invoked when a tap lands on empty water — i.e.
    /// `creatureAtPoint` returned nil. Mirrors the ESP32 firmware's
    /// "tap aquarium background to hide HUD" pattern so the iOS dashboard
    /// can fade SessionListPanel + TopologyRail for an unobstructed view.
    /// Cross-platform safe; the call site decides whether to wire it up.
    var onBackgroundTapped: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var renderer = TerrariumRenderer()

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60)) { timeline in
            Canvas { context, size in
                let dt = renderer.deltaTime(now: timeline.date)

                renderer.animateHermes = !reduceMotion
                renderer.update(dt: dt, state: terrariumState)
                renderer.draw(context: &context, size: size, includeHabitat: includeHabitat)
                if !terrariumState.ciWaitingIDs.isEmpty {
                    let unit = size.width * CGFloat(TerrariumRules.ciStationWidthFrac) / 8
                    let x = size.width * CGFloat(TerrariumRules.ciStationX)
                    let y = size.height * CGFloat(TerrariumRules.ciStationY)
                    for (row, bits) in CiWaitVisual.shrimp.enumerated() {
                        for col in 0..<8 where bits & (1 << (7 - col)) != 0 {
                            context.fill(Path(CGRect(x: x + CGFloat(col) * unit, y: y + CGFloat(row) * unit,
                                width: unit, height: unit)), with: .color(DesignTokens.Coral.s500))
                        }
                    }
                    context.draw(Text("CI · \(terrariumState.ciWaitingIDs.count)").font(.caption.monospaced())
                        .foregroundColor(DesignTokens.Tide.s50), at: CGPoint(x: x + unit * 4, y: y - unit))
                }
            }
        }
        .overlay {
            if onCreatureTapped != nil || onBackgroundTapped != nil {
                GeometryReader { geo in
                    Color.clear
                        .contentShape(Rectangle())
                        .onTapGesture { location in
                            let nx = Float(location.x / geo.size.width)
                            let ny = Float(location.y / geo.size.height)
                            if let sessionId = renderer.creatureAtPoint(nx: nx, ny: ny) {
                                onCreatureTapped?(sessionId)
                            } else {
                                onBackgroundTapped?()
                            }
                        }
                }
            }
        }
    }
}
