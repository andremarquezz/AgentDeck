import Foundation

/// Deck-switchable settings of one OpenClaw session, in the Gateway's own words
/// (#463). Swift mirror of `openClawSessionSettings` in
/// `shared/src/session-settings.ts` — same precedence, same refusals:
///
/// - effort: the row's `thinkingLevels` ({id,label}), else its legacy
///   `thinkingOptions`, else the list `defaults`; current = `thinkingLevel`,
///   else the default; default = `thinkingDefault`.
/// - model: only when the `models.list` catalog lists something; current =
///   `modelProvider/model`; default = the catalog's `role: default` entry, else
///   the list defaults; `overridden` when `modelOverrideSource` is set.
///
/// Nothing is ever invented: a value the Gateway did not report is absent.
/// Output is the wire shape of `SessionSetting` (shared/src/protocol.ts).
enum OpenClawSessionSettings {
    /// A read crossing from the adapter actor to `@DaemonActor`. The dictionaries
    /// are built fresh per read and never mutated afterwards.
    struct Read: @unchecked Sendable {
        let settings: [[String: Any]]
        let error: String?
    }

    static func settings(
        row: [String: Any],
        defaults: [String: Any]?,
        catalog: [[String: Any]]?
    ) -> [[String: Any]] {
        var out: [[String: Any]] = []

        let models = (catalog ?? []).filter {
            ($0["available"] as? Bool) != false && text($0["key"]) != nil
        }
        if !models.isEmpty {
            var setting: [String: Any] = ["key": "model"]
            if let current = modelKey(row) { setting["current"] = current }
            let defaultModel = models.first { $0["role"] as? String == "default" }.flatMap { text($0["key"]) }
                ?? defaults.flatMap(modelKey)
            if let defaultModel { setting["default"] = defaultModel }
            if let source = row["modelOverrideSource"], !(source is NSNull) { setting["overridden"] = true }
            setting["options"] = models.compactMap { entry -> [String: Any]? in
                guard let key = text(entry["key"]) else { return nil }
                if let name = text(entry["name"]), name != key { return ["id": key, "label": name] }
                return ["id": key]
            }
            out.append(setting)
        }

        if let levels = thinkingOptions(row) ?? defaults.flatMap(thinkingOptions) {
            var setting: [String: Any] = ["key": "effort", "options": levels]
            let thinkingDefault = text(row["thinkingDefault"]) ?? defaults.flatMap { text($0["thinkingDefault"]) }
            if let current = text(row["thinkingLevel"]) ?? thinkingDefault { setting["current"] = current }
            if let thinkingDefault { setting["default"] = thinkingDefault }
            out.append(setting)
        }
        return out
    }

    /// `sessions.patch` params for a deck choice; `nil` value clears the override.
    static func patchParams(sessionKey: String, key: String, value: String?) -> [String: Any]? {
        let field: String
        switch key {
        case "model": field = "model"
        case "effort": field = "thinkingLevel"
        default: return nil
        }
        return ["key": sessionKey, field: value.map { $0 as Any } ?? NSNull()]
    }

    private static func thinkingOptions(_ row: [String: Any]) -> [[String: Any]]? {
        if let levels = row["thinkingLevels"] as? [[String: Any]] {
            let out = levels.compactMap { level -> [String: Any]? in
                guard let id = text(level["id"]) else { return nil }
                if let label = text(level["label"]), label != id { return ["id": id, "label": label] }
                return ["id": id]
            }
            if !out.isEmpty { return out }
        }
        if let ids = row["thinkingOptions"] as? [Any] {
            let out = ids.compactMap(text).map { ["id": $0] as [String: Any] }
            if !out.isEmpty { return out }
        }
        return nil
    }

    private static func modelKey(_ row: [String: Any]) -> String? {
        guard let model = text(row["model"]) else { return nil }
        if let provider = text(row["modelProvider"]), !model.contains("/") { return "\(provider)/\(model)" }
        return model
    }

    private static func text(_ value: Any?) -> String? {
        guard let s = value as? String else { return nil }
        let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
