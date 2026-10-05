import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as rules from '../ci-wait.js';
import { emitSwift, OUTPUT, emitKotlin, KOTLIN_OUTPUT, emitCpp, CPP_OUTPUT, emitHermesRules, HERMES_OUTPUT } from '../../../scripts/generate-ci-wait.mjs';
const root = fileURLToPath(new URL('../../..', import.meta.url));

describe('Node/Swift CI wait command parity', () => {
  it('keeps the native classifier generated from the common grammar and bounds', () => {
    expect(readFileSync(join(root, OUTPUT), 'utf8')).toBe(emitSwift(rules));
    expect(readFileSync(join(root, KOTLIN_OUTPUT), 'utf8')).toBe(emitKotlin(rules));
    expect(readFileSync(join(root, CPP_OUTPUT), 'utf8')).toBe(emitCpp(rules));
    expect(readFileSync(join(root, HERMES_OUTPUT), 'utf8')).toBe(emitHermesRules(rules));
  });
  it.skipIf(process.platform !== 'darwin')('executes every common command vector in Swift', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentdeck-ci-wait-parity-'));
    try {
      const main = join(dir, 'main.swift');
      writeFileSync(main, `import Foundation
let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let vectors = try JSONSerialization.jsonObject(with: data) as! [[String: Any]]
for (index, vector) in vectors.enumerated() {
    let result = CiWaitRules.classify(command: vector["command"], runInBackground: vector["background"])
    if let expected = vector["expected"] as? [String: Any] {
        guard let result else { fatalError("Missing intent at vector \\(index)") }
        let actual = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result)) as! [String: Any]
        precondition(NSDictionary(dictionary: actual).isEqual(to: expected), "Wrong intent at vector \\(index)")
    } else { precondition(result == nil, "Invented intent at vector \\(index)") }
 }
@globalActor actor DaemonActor { static let shared = DaemonActor() }
@DaemonActor func verifyLifecycle() throws {
let lifecycleData = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))
let scenarios = try JSONSerialization.jsonObject(with: lifecycleData) as! [[String: Any]]
for scenario in scenarios {
    let tracker = CiWaitTracker()
    for step in scenario["steps"] as! [[String: Any]] {
        let now = step["at"] as! Int
        tracker.note("session", event: step["event"] as! String, json: step["payload"] as! [String: Any], now: now)
        let actual = tracker.snapshot("session", now: now)
        if let expected = step["expected"] as? [String: Any] {
            precondition(NSDictionary(dictionary: actual ?? [:]).isEqual(to: expected), "Lifecycle mismatch")
        } else { precondition(actual == nil, "Wait was not cleared") }
    }
}
}
try await verifyLifecycle()
// The native timeline store runs without starting persistence or a daemon.
// Dependencies outside this replay fail loudly if unexpectedly reached.
enum AuthManager { static var agentDeckDir: URL { fatalError("Unexpected auth directory access") } }
enum ObservedAgentRules { static func rawSessionId(_ value: String) -> String { fatalError("Unexpected session lookup") } }
let timelineData = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[4]))
let timelineVectors = try JSONSerialization.jsonObject(with: timelineData) as! [[String: Any]]
for vector in timelineVectors {
    let store = DaemonTimelineStore(persistFile: URL(fileURLWithPath: "/unused-ci-parity.json"))
    let before = try JSONSerialization.data(withJSONObject: vector["before"]!)
    let incoming = try JSONSerialization.data(withJSONObject: vector["incoming"]!)
    await store.add(try JSONDecoder().decode(DaemonTimelineEntry.self, from: before))
    await store.add(try JSONDecoder().decode(DaemonTimelineEntry.self, from: incoming))
    let actual = await store.getAll()
    precondition(actual.count == (vector["action"] as! String == "add" ? 2 : 1), "Scheduled CI dedup mismatch")
}
let accountingData = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3]))
let accounting = try JSONSerialization.jsonObject(with: accountingData) as! [[String: Any]]
for vector in accounting {
    let actual = CiWaitAccounting.foregroundMs(vector["events"] as! [[String: Any]], turnIndex: vector["turnIndex"] as! Int,
        start: vector["start"] as! Int, end: vector["end"] as! Int)
    precondition(actual == vector["expected"] as! Int, "CI accounting mismatch")
}
`);
      execFileSync('swiftc', ['-swift-version', '6', join(root, OUTPUT), join(root, 'apple/AgentDeck/Daemon/Timeline/DaemonTimelineStore.swift'), main, '-o', join(dir, 'parity')], { timeout: 60_000 });
      execFileSync(join(dir, 'parity'), [join(root, 'shared/ci-wait-vectors.json'), join(root, 'shared/ci-wait-lifecycle-vectors.json'), join(root, 'shared/ci-wait-accounting-vectors.json'), join(root, 'shared/timeline-ci-dedup-vectors.json')], { timeout: 10_000 });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 75_000);
});
