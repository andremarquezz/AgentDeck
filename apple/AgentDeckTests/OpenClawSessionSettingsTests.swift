import XCTest
@testable import AgentDeck

/// #463: Swift mirror of `shared/src/__tests__/session-settings.test.ts`. Row and
/// defaults shapes captured from a live OpenClaw Gateway (2026.9.8).
final class OpenClawSessionSettingsTests: XCTestCase {
    private let levels: [[String: Any]] = ["off", "low", "medium", "high"].map { ["id": $0, "label": $0] }
    private let catalog: [[String: Any]] = [
        ["key": "openai/gpt-6-sol", "name": "GPT-6 Sol", "role": "default", "available": true],
        ["key": "zai/glm-5.3", "name": "zai/glm-5.3", "role": "configured", "available": true],
        ["key": "gone/model", "name": "Gone", "role": "configured", "available": false],
    ]

    func testProjectsRowLevelsCurrentAndDefaultVerbatim() {
        let row: [String: Any] = [
            "thinkingLevel": "medium", "thinkingLevels": levels, "thinkingDefault": "high",
            "modelProvider": "openai", "model": "gpt-6-sol", "modelOverrideSource": NSNull(),
        ]
        let out = OpenClawSessionSettings.settings(row: row, defaults: nil, catalog: catalog)
        XCTAssertEqual(out.map { $0["key"] as? String }, ["model", "effort"])
        let model = out[0], effort = out[1]
        XCTAssertEqual(model["current"] as? String, "openai/gpt-6-sol")
        XCTAssertEqual(model["default"] as? String, "openai/gpt-6-sol")
        XCTAssertNil(model["overridden"])
        XCTAssertEqual((model["options"] as? [[String: Any]])?.map { $0["id"] as? String }, ["openai/gpt-6-sol", "zai/glm-5.3"])
        XCTAssertEqual((model["options"] as? [[String: Any]])?.first?["label"] as? String, "GPT-6 Sol")
        XCTAssertEqual(effort["current"] as? String, "medium")
        XCTAssertEqual(effort["default"] as? String, "high")
        // A label equal to its id is dropped, as in the TS projection.
        XCTAssertNil((effort["options"] as? [[String: Any]])?.first?["label"])
    }

    func testOverrideBinaryLabelAndDefaultsFallback() {
        let row: [String: Any] = [
            "modelOverrideSource": "user", "model": "glm-5.3", "modelProvider": "zai",
            "thinkingLevels": [["id": "off", "label": "off"], ["id": "low", "label": "on"]],
        ]
        let out = OpenClawSessionSettings.settings(row: row, defaults: ["thinkingDefault": "low"], catalog: catalog)
        XCTAssertEqual(out[0]["overridden"] as? Bool, true)
        XCTAssertEqual((out[1]["options"] as? [[String: Any]])?.last?["label"] as? String, "on")
        XCTAssertEqual(out[1]["current"] as? String, "low")
    }

    func testNeverInventsAndNoCatalogMeansNoModelSetting() {
        XCTAssertTrue(OpenClawSessionSettings.settings(row: [:], defaults: nil, catalog: nil).isEmpty)
        let out = OpenClawSessionSettings.settings(row: ["thinkingOptions": ["on", "off"]], defaults: nil, catalog: [])
        XCTAssertEqual(out.count, 1)
        XCTAssertNil(out[0]["current"])
        XCTAssertNil(out[0]["default"])
    }

    func testPatchParamsMapKeysAndClearWithNull() {
        let effort = OpenClawSessionSettings.patchParams(sessionKey: "k", key: "effort", value: "high")
        XCTAssertEqual(effort?["thinkingLevel"] as? String, "high")
        let cleared = OpenClawSessionSettings.patchParams(sessionKey: "k", key: "model", value: nil)
        XCTAssertTrue(cleared?["model"] is NSNull)
        XCTAssertNil(OpenClawSessionSettings.patchParams(sessionKey: "k", key: "fastMode", value: "on"))
    }
}
