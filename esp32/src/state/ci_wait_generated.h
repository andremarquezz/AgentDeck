// GENERATED from shared/src/ci-wait.ts. No heap or mutable storage.
#pragma once
#include <stdint.h>
#include <string.h>
namespace CiWaitVisual {
static constexpr unsigned long CYCLE_MS = 6000;
static constexpr unsigned long SHOW_AFTER_MS = 3000;
static constexpr uint32_t HELPER_COLOR = 0xE2E8F0;
static constexpr uint8_t NONE = 0;
static constexpr uint8_t UNKNOWN = 1;
static constexpr uint8_t QUEUED = 2;
static constexpr uint8_t RUNNING = 3;
static constexpr uint8_t PASSED = 4;
static constexpr uint8_t FAILED = 5;
static constexpr uint8_t GITHUB[8] = {60, 126, 195, 195, 195, 231, 70, 36};
inline uint8_t phase(const char* value) {
    if (value && !strcmp(value, "unknown")) return 1;
    if (value && !strcmp(value, "queued")) return 2;
    if (value && !strcmp(value, "running")) return 3;
    if (value && !strcmp(value, "passed")) return 4;
    if (value && !strcmp(value, "failed")) return 5;
    return UNKNOWN;
}
}
