// GENERATED FILE — DO NOT EDIT.
// Source of truth: shared/src/terrarium-rules.ts
// Regenerate: pnpm generate-terrarium-rules (drift gated by shared/src/__tests__/terrarium-rules.test.ts)
#pragma once

// Cross-platform terrarium rules. See shared/src/terrarium-rules.ts for
// what each value means and the clearance invariant they encode.
// C++11-safe (util/-grade): plain constexpr floats, no dependencies.
namespace TerrariumRules {
constexpr float CiStationX = 0.14f;
constexpr float CiStationY = 0.63f;
constexpr float CiStationWidthFrac = 0.13f;
constexpr float CiStationQueueGap = 0.13f;
constexpr float CiStationQueueRise = 0.15f;
constexpr float CiStationQueueColumns = 4.0f;
constexpr float CiStationQueueY = 0.46f;
constexpr float CiStationUnknownDistance = 0.04f;
constexpr float CiStationResponseRate = 4.0f;
constexpr float CiStationScanRate = 1.4f;
constexpr float CiStationAsleepOpacity = 0.45f;
constexpr float CiStationHopHeight = 0.035f;
constexpr float CiStationHopSeconds = 1.2f;
constexpr float CiStationNativeX = -2.4f;
constexpr float CiStationNativeY = 0.65f;
constexpr float CiStationNativeZ = 1.9f;
constexpr float CiStationNativeScale = 0.7f;
constexpr float CiStationNativeQueueScale = 0.55f;
constexpr float CiStationNativeQueueGap = 1.25f;
constexpr float CiStationNativeQueueY = 1.8f;
constexpr float CiStationNativeQueueZ = 0.1f;
constexpr float CrayfishHomeX = 0.78f;
constexpr float CrayfishSittingY = 0.64f;
constexpr float CrayfishWidthFraction = 0.11f;
constexpr float CrayfishClearMaxX = 0.62f;
constexpr float FloorRestYMin = 0.56f;
constexpr float FloorRestYMax = 0.64f;
constexpr float AntigravityHoverYMin = 0.48f;
constexpr float AntigravityHoverYMax = 0.54f;
constexpr float ResterMaxWidthFraction = 0.096f;
// Name tags (DESIGN.md §6.4): at or above this many residents idle tags collapse.
constexpr int NativeLabelDenseResidentCount = 5;
}  // namespace TerrariumRules
