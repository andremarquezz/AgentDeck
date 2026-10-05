package dev.agentdeck.terrarium.renderer

import dev.agentdeck.terrarium.toTerrariumState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.hypot

@org.junit.runner.RunWith(org.robolectric.RobolectricTestRunner::class)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.NATIVE)
class EinkAnimationTimingTest {
    @Test fun `e-ink static companion preserves actual resident homes and clears on null`() {
        val creatures=(0..3).map { dev.agentdeck.terrarium.AgentCreatureState("ci$it","claude-code",dev.agentdeck.terrarium.OctopusVisualState.FLOATING,false,it,"CI QA $it") }
        val state=dev.agentdeck.terrarium.TerrariumState(dev.agentdeck.terrarium.OctopusVisualState.FLOATING,dev.agentdeck.terrarium.CrayfishVisualState.DORMANT,
            dev.agentdeck.terrarium.TetraVisualState.ABSENT,dev.agentdeck.terrarium.EnvironmentVisualState.CALM,agents=creatures,
            ciWaits=creatures.associate { it.sessionId to dev.agentdeck.net.CiWaitStatus(phase="unknown",agentWaiting=true) })
        val context=org.robolectric.RuntimeEnvironment.getApplication() as android.content.Context
        val sprite=dev.agentdeck.terrarium.ciCompanionBitmap(context)
        val frame=renderEinkFrame(state,800,600,textScale=2f,ciSprite=sprite)
        val cleared=renderEinkFrame(state.copy(ciWaits=emptyMap()),800,600,textScale=2f,ciSprite=sprite)
        val pixels=IntArray(800*600);val empty=IntArray(800*600)
        frame.getPixels(pixels,0,800,0,0,800,600);cleared.getPixels(empty,0,800,0,0,800,600)
        assertTrue(!pixels.contentEquals(empty))
        val inactive=renderEinkFrame(state.copy(ciWaits=state.ciWaits.mapValues { it.value.copy(agentWaiting=false) }),800,600,textScale=2f,ciSprite=sprite)
        inactive.getPixels(pixels,0,800,0,0,800,600)
        assertTrue("Nonwaiting records do not create an orbital companion",pixels.contentEquals(empty))
    }

    @Test fun `e-ink refresh key notices CI changes when ordinary session state stays idle`() {
        val row = dev.agentdeck.net.SessionInfo(id = "ci",port = 0,agentType = "hermes",state = "idle",
            waitingOn = dev.agentdeck.net.CiWaitStatus(phase = "unknown",agentWaiting = true))
        val state = dev.agentdeck.state.DashboardState(agentType = "daemon",siblingSessions = listOf(row))
        val changed = state.copy(siblingSessions = listOf(row.copy(waitingOn = row.waitingOn!!.copy(phase = "running"))))
        val cleared = state.copy(siblingSessions = listOf(row.copy(waitingOn = null)))
        fun key(s: dev.agentdeck.state.DashboardState) = dev.agentdeck.ui.screen.buildEinkTerrariumRefreshKey(s,s.toTerrariumState())
        assertTrue(key(state) != key(changed)); assertTrue(key(state) != key(cleared))
    }


    @Test
    fun `LCD uses vsync and physical e-ink uses fast partial cadence`() {
        assertEquals(0L, einkAnimationFrameIntervalMs(physicalEink = false))
        assertEquals(100L, einkAnimationFrameIntervalMs(physicalEink = true))
    }

    @Test
    fun `animation frame advance is elapsed-time based and bounded`() {
        assertEquals(0.25f, einkAnimationFrameAdvance(100L), 0.001f)
        assertEquals(1.0f, einkAnimationFrameAdvance(400L), 0.001f)
        assertEquals(1.5f, einkAnimationFrameAdvance(5_000L), 0.001f)
    }

    @Test
    fun `fish simulation scales movement for partial color frames`() {
        val fullStepSchool = EinkFishSchool()
        val partialStepSchool = EinkFishSchool()
        val initial = fullStepSchool.fish.map { it.x to it.y }

        fullStepSchool.update(
            streaming = false,
            stepScale = 1f,
        )
        partialStepSchool.update(
            streaming = false,
            stepScale = 0.25f,
        )

        val fullDistance = totalDistance(initial, fullStepSchool)
        val partialDistance = totalDistance(initial, partialStepSchool)

        assertTrue(fullDistance > 0f)
        assertTrue("partial frames should interpolate instead of sprinting", partialDistance < fullDistance * 0.5f)
    }

    @Test
    fun `fish trajectory is identical across display cadences`() {
        val mono = EinkFishSchool()
        val color = EinkFishSchool()
        repeat(300) {
            mono.update(false, 1f)
            repeat(4) { color.update(false, 0.25f) }
        }
        mono.fish.zip(color.fish).forEach { (a, b) ->
            assertEquals(a.x, b.x, 0.000001f)
            assertEquals(a.y, b.y, 0.000001f)
            assertEquals(a.facing, b.facing, 0.000001f)
        }
    }

    @Test
    fun `fish cross the aquarium rather than orbiting in place`() {
        val school = EinkFishSchool()
        var minX = 1f
        var maxX = 0f
        var reversals = 0
        var previousDirection = school.fish.first().facing > 0
        repeat(160) {
            val oldX = school.fish.first().x
            school.update(false)
            val fish = school.fish.first()
            minX = minOf(minX, fish.x)
            maxX = maxOf(maxX, fish.x)
            val direction = fish.facing > 0
            if (direction != previousDirection) reversals++
            previousDirection = direction
            if (kotlin.math.abs(fish.facing) > 0.05f) {
                assertTrue("must face the direction of travel", (fish.x - oldX) * fish.facing > 0f)
            }
            assertTrue("back stays upright", kotlin.math.abs(fish.pitch) <= 9f)
        }
        assertTrue("should traverse most of the tank", maxX - minX > 0.65f)
        assertTrue("no repeated U-turns within a shoal", reversals in 1..3)
    }

    @Test
    fun `state changes and repeated laps preserve continuous bounded motion`() {
        val school = EinkFishSchool()
        repeat(4000) { frame ->
            val before = school.fish.map { Triple(it.x, it.y, it.facing) }
            school.update(frame % 300 < 100, hovering = frame % 300 in 100..199)
            school.fish.zip(before).forEach { (fish, old) ->
                assertTrue(hypot(fish.x - old.first, fish.y - old.second) <= 0.018f)
                assertTrue(kotlin.math.abs(fish.facing - old.third) <= 0.05f)
                assertTrue(fish.x in 0.15f..0.85f && fish.y in 0.20f..0.51f)
            }
        }
    }

    @Test
    fun `fish advance on every 60Hz frame without coarse simulation stalls`() {
        val school = EinkFishSchool()
        repeat(120) {
            val before = school.fish.first().x
            school.update(false, stepScale = 16f / 400f)
            assertTrue(school.fish.first().x != before)
        }
    }

    @Test
    fun `routine vendor modes never carry full refresh or blocking flags`() {
        for (waveform in listOf(1, 2, 4)) {
            assertEquals(0, onyxUpdateMode(waveform, false) and (32 or 64))
        }
        assertEquals(98, onyxUpdateMode(2, true))
    }

    @Test
    fun `reader habitat is monotonic native grayscale with dark tones reserved for agents`() {
        val levels = (0..255).map(::einkHabitatGray)
        assertTrue(levels.all { it % 17 == 0 && it in 102..255 })
        assertTrue(levels.zipWithNext().all { (a, b) -> a <= b })
        assertEquals(255, levels.last())
        assertTrue(levels.distinct().size >= 8)
    }

    private fun totalDistance(initial: List<Pair<Float, Float>>, school: EinkFishSchool): Float =
        school.fish.zip(initial).sumOf { (fish, start) ->
            hypot((fish.x - start.first).toDouble(), (fish.y - start.second).toDouble())
        }.toFloat()
}
