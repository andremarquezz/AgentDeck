import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as rules from '../ci-wait.js';
import { emitSwift, OUTPUT } from '../../../scripts/generate-ci-wait.mjs';
const root = fileURLToPath(new URL('../../..', import.meta.url));

describe('Node/Swift CI wait command parity', () => {
  it('keeps the native classifier generated from the common grammar and bounds', () => {
    expect(readFileSync(join(root, OUTPUT), 'utf8')).toBe(emitSwift(rules));
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
`);
      execFileSync('swiftc', ['-swift-version', '6', join(root, OUTPUT), main, '-o', join(dir, 'parity')], { timeout: 60_000 });
      execFileSync(join(dir, 'parity'), [join(root, 'shared/ci-wait-vectors.json'), join(root, 'shared/ci-wait-lifecycle-vectors.json')], { timeout: 10_000 });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 75_000);
});
