import SwiftUI

/// Read-only visits keyed by observed session identity. Permission always owns
/// the resident; an outcome never claims a fresh check or an agent action.
enum CiStationPresentation {
    static func label(_ wait: CiWaitStatus) -> String {
        let phase = ["queued", "running", "passed", "failed"].contains(wait.phase) ? wait.phase.uppercased() : "UNKNOWN"
        return "CI \(phase)" + (wait.pr.map { " #\($0)" } ?? "")
            + (wait.checks.map { " · \($0.passed)/\($0.total)" } ?? "")
    }
    static func badge(_ wait: CiWaitStatus) -> String {
        switch wait.phase {
        case "running": wait.checks.map { "\($0.passed)/\($0.total)" } ?? "CI running"
        case "queued": "CI queued"
        case "passed": "CI ✓"
        case "failed": "CI !"
        default: "CI ?"
        }
    }
    static func color(_ wait: CiWaitStatus?) -> Color {
        switch wait?.phase {
        case "queued", "running": DesignTokens.Session.working
        case "passed": DesignTokens.UI.ok
        case "failed": DesignTokens.Session.error
        default: DesignTokens.Session.idle
        }
    }
    static func queue(_ state: TerrariumState, visibleIDs: Set<String>) -> [String] {
        state.ciWaitingIDs.intersection(visibleIDs).sorted {
            let a = state.ciWaits[$0]?.openedAt ?? 0, b = state.ciWaits[$1]?.openedAt ?? 0
            return a == b ? $0 < $1 : a < b
        }.prefix(TerrariumRules.nativeResidentLimit).map { $0 }
    }
    static func position(slot: Int, wait: CiWaitStatus?) -> SIMD2<Float> {
        let columns = Int(TerrariumRules.ciStationQueueColumns)
        return [TerrariumRules.ciStationX + Float(slot % columns) * TerrariumRules.ciStationQueueGap,
                TerrariumRules.ciStationQueueY - Float(slot / columns) * TerrariumRules.ciStationQueueRise
                    - (wait?.phase == "unknown" ? TerrariumRules.ciStationUnknownDistance : 0)]
    }
    static func draw(context: inout GraphicsContext, size: CGSize, state: TerrariumState,
                     queue: [String], positions: [String: SIMD2<Float>], time: Float) {
        let x = CGFloat(TerrariumRules.ciStationX) * size.width
        let y = CGFloat(TerrariumRules.ciStationY) * size.height
        let width = CGFloat(TerrariumRules.ciStationWidthFrac) * size.width
        let unit = width / 8
        let first = queue.first.flatMap { state.ciWaits[$0] }
        let asleep = queue.isEmpty
        let dim = asleep || first?.phase == "unknown"
        context.fill(Path(ellipseIn: CGRect(x: x-width/2, y: y+unit*2, width: width, height: unit*2)),
                     with: .color(DesignTokens.Ink.s700))
        for (row, bits) in CiWaitVisual.shrimp.enumerated() {
            for col in 0..<8 where bits & (1 << (7-col)) != 0 {
                context.fill(Path(CGRect(x: x-width/2+CGFloat(col)*unit, y: y-unit*5+CGFloat(row)*unit,
                                         width: unit, height: unit)),
                             with: .color(DesignTokens.Coral.s500.opacity(dim ? Double(TerrariumRules.ciStationAsleepOpacity) : 1)))
            }
        }
        let label = asleep ? "CI · asleep" : first.map(Self.label) ?? "CI UNKNOWN"
        context.draw(Text(label).font(.custom("IBMPlexSans", size: max(9, min(12, size.width*0.015))))
            .foregroundColor(color(first)), at: CGPoint(x: x+width, y: y), anchor: .leading)
        for id in queue {
            guard let position = positions[id] else { continue }
            var line = Path(); line.move(to: CGPoint(x: x, y: y-unit*3))
            line.addLine(to: CGPoint(x: CGFloat(position.x)*size.width, y: CGFloat(position.y)*size.height))
            context.stroke(line, with: .color(color(state.ciWaits[id]).opacity(0.45)), style: StrokeStyle(lineWidth: 1, dash: [3,4]))
        }
        for (id, position) in positions.sorted(by: { $0.key < $1.key }) {
            guard let wait = state.ciWaits[id] else { continue }
            context.draw(Text(Self.badge(wait)).font(.custom("IBMPlexSans", size: max(9, min(11, size.width*0.015))))
                .foregroundColor(color(wait)), at: CGPoint(x: CGFloat(position.x)*size.width, y: CGFloat(position.y)*size.height+unit*3))
        }

        if first?.phase == "running", let id = queue.first, let p = positions[id] {
            let scan = CGFloat(0.5 + 0.5 * sin(time * TerrariumRules.ciStationScanRate))
            let cx = CGFloat(p.x)*size.width, cy = CGFloat(p.y)*size.height
            var sweep = Path(); sweep.move(to: CGPoint(x: cx-width/3, y: cy-unit*3+scan*unit*6))
            sweep.addLine(to: CGPoint(x: cx+width/3, y: cy-unit*3+scan*unit*6))
            context.stroke(sweep, with: .color(DesignTokens.Tide.s50.opacity(0.75)), lineWidth: 1)
        }
    }
}
