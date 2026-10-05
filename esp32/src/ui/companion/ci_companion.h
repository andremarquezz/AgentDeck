#pragma once
#include <stdint.h>
#include <math.h>
#include "../../state/ci_wait_generated.h"
#include "../terrarium/terrarium_rules_generated.h"

// Pure, allocation-free presentation of the existing compact phase evidence.
// A phase never claims an agent is blocked; terminal phases cannot orbit.
namespace CiCompanion {
inline uint32_t sessionHash(const char* id) {
    uint32_t hash = TerrariumRules::CiCompanionSeedOffset;
    for (const unsigned char* byte = reinterpret_cast<const unsigned char*>(id); byte && *byte; ++byte)
        hash = (hash ^ *byte) * TerrariumRules::CiCompanionSeedPrime;
    return hash;
}
inline bool moving(uint8_t phase) {
    return phase == CiWaitVisual::UNKNOWN || phase == CiWaitVisual::QUEUED || phase == CiWaitVisual::RUNNING;
}
struct Memo { uint32_t key = 0; float changedAt = 0; float lastAt = 0; float angle = 0; float speed = 0; uint8_t phase = 0; bool occupied = false; bool seen = false; };
inline bool visible(Memo& memo, uint32_t key, uint8_t phase, float now) {
    if (!moving(phase) && phase != CiWaitVisual::PASSED && phase != CiWaitVisual::FAILED) { memo.occupied = false; return false; }
    if (!memo.occupied || memo.key != key || memo.phase != phase || now < memo.changedAt) {
        if (!memo.occupied || memo.key != key || now < memo.lastAt) {
            memo.angle = 2.0f * 3.14159265358979323846f * float(key % TerrariumRules::CiCompanionSeedModulus) / TerrariumRules::CiCompanionSeedModulus
                + (moving(phase) ? 0.0f : TerrariumRules::CiCompanionStaticAngle);
        } else if (moving(memo.phase)) memo.angle += (now - memo.lastAt) * TerrariumRules::CiCompanionRadiansPerSecond * memo.speed;
        memo.key = key; memo.phase = phase; memo.changedAt = now; memo.occupied = true;
    } else if (moving(memo.phase)) memo.angle += (now - memo.lastAt) * TerrariumRules::CiCompanionRadiansPerSecond * memo.speed;
    memo.lastAt = now;
    memo.speed = phase == CiWaitVisual::QUEUED ? TerrariumRules::CiCompanionQueuedSpeed
        : phase == CiWaitVisual::UNKNOWN ? TerrariumRules::CiCompanionUnknownSpeed : 1.0f;
    memo.seen = true;
    return moving(phase) || now - memo.changedAt < TerrariumRules::CiCompanionResultSeconds;
}
}
