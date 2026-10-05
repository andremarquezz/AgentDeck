package dev.agentdeck.terrarium

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.compose.ui.graphics.toArgb
import dev.agentdeck.ui.theme.DesignTokens
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AquariumResidentOverlayTest {

    @Test fun `CI visits are bounded and return to simulation home`() {
        val visits = CiStationVisits { 1L }
        val originals = (0..47).associate { "s$it" to (.5f to .6f) }
        val waits = originals.mapValues { (id,_) -> dev.agentdeck.net.CiWaitStatus(phase = "running",agentWaiting = true,openedAt = id.drop(1).toLong()) }
        val state = TerrariumState(OctopusVisualState.FLOATING,CrayfishVisualState.DORMANT,TetraVisualState.CIRCLING,EnvironmentVisualState.CALM,
            ciWaits = waits,ciWaitingIds = waits.keys)
        val positions = visits.update(state,originals,animate = false).toMap()
        assertEquals(TerrariumRules.NATIVE_RESIDENT_LIMIT,visits.queue.size)
        assertEquals(ciStationPosition(0,waits["s0"]),positions["s0"])
        assertEquals(listOf("s0","s1","s2","s3","s4","s5","s6","s7"),visits.queue)
        val cleared = state.copy(ciWaits = emptyMap(),ciWaitingIds = emptySet())
        assertTrue(visits.update(cleared,originals,animate = false).isEmpty())
        assertTrue(visits.queue.isEmpty())
        val permission = AquariumResident("p","codex","Permission",OctopusVisualState.ASKING)
        val running = AquariumResident("s0","codex","Work",OctopusVisualState.FLOATING,ciWait = waits["s0"])
        assertEquals(permission,visibleAquariumResidents(listOf(running,permission),null).first())
    }

    @Test fun `CI uncertainty stays neutral and only running moves its inspection sweep`() {
        fun snapshot(phase: String?, time: Float): IntArray {
            val state = TerrariumState(OctopusVisualState.FLOATING,CrayfishVisualState.DORMANT,TetraVisualState.CIRCLING,EnvironmentVisualState.CALM,
                ciWaits = phase?.let { mapOf("s" to dev.agentdeck.net.CiWaitStatus(phase = it,agentWaiting = true,
                    checks = dev.agentdeck.net.CiWaitChecks(10,7,0,3),pr = 432)) } ?: emptyMap())
            val bitmap = Bitmap.createBitmap(1000,700,Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap); canvas.drawColor(TerrariumColors.DeepSea.toArgb())
            val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                typeface = android.graphics.Typeface.createFromAsset(RuntimeEnvironment.getApplication().assets,"fonts/IBMPlexSans-Regular.ttf")
            }
            drawCiStation(canvas,paint,state,if (phase == null) emptyList() else listOf("s"),mapOf("s" to (140f to 322f)),time)
            System.getenv("AGENTDECK_CI_VISUAL_OUTPUT")?.let { output ->
                val file = java.io.File(output,"android-station-${phase ?: "asleep"}-$time.png"); file.parentFile.mkdirs()
                file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }
            }
            return IntArray(bitmap.width*bitmap.height).also { bitmap.getPixels(it,0,bitmap.width,0,0,bitmap.width,bitmap.height); bitmap.recycle() }
        }
        val unknown = snapshot("unknown",0f)
        assertFalse(unknown.any { it == DesignTokens.UI.ok.toArgb() })
        assertArrayEquals(unknown,snapshot("unknown",1f))
        assertTrue(snapshot("passed",0f).any { it == DesignTokens.UI.ok.toArgb() })
        assertTrue(snapshot("failed",0f).any { it == DesignTokens.Session.error.toArgb() })
        assertFalse(snapshot("running",0f).contentEquals(snapshot("running",1f)))
        assertFalse(snapshot(null,0f).contentEquals(unknown))
        assertFalse(snapshot("queued",0f).contentEquals(unknown))
    }

    private val painter get() = AquariumResidentOverlay(RuntimeEnvironment.getApplication())

    @Test fun `all six kinds render a filled working badge and keep activity when labels hide`() {
        for (kind in listOf("claudecode", "codex", "openclaw", "opencode", "antigravity", "kiro")) {
            val item = AquariumResident(kind, kind, kind, OctopusVisualState.WORKING)
            val pixels = render(item, labels = true)
            assertTrue(kind, pixels.count { it == DesignTokens.Session.working.toArgb() } > 100)
            val viewing = render(item, labels = false)
            assertTrue("Activity survives viewing mode: $kind", viewing.any { it != 0 })
            assertFalse("Badge is hidden with labels", viewing.any { it == DesignTokens.Session.working.toArgb() })
            assertFalse("Bars move with phase", viewing.contentEquals(render(item, labels = false, phase = 1f)))
            assertArrayEquals("Frozen phase is stable", viewing, render(item, labels = false))
        }
    }

    @Test fun `state changes clear work cue immediately even with frozen phase and selection`() {
        val item = AquariumResident("session", "claudecode", "Project", OctopusVisualState.WORKING)
        for (state in listOf(OctopusVisualState.FLOATING, OctopusVisualState.ASKING, OctopusVisualState.SLEEPING)) {
            val stopped = item.copy(state = state)
            assertTrue(render(stopped, labels = false).all { it == 0 })
            assertTrue("Selection remains independent", render(stopped, labels = false, selected = true).any { it != 0 })
            assertFalse(render(stopped, labels = true).any { it == DesignTokens.Session.working.toArgb() })
        }
    }

    @Test fun `a yielding WORKING tag leaves no opaque badge over the resident behind it`() {
        val item = AquariumResident("s", "claudecode", "Project", OctopusVisualState.WORKING)
        val solid = DesignTokens.Session.working.toArgb()
        val whole = renderTag(item, ResidentLabelDecision("s", ResidentLabelMode.FULL,
            TerrariumRules.NATIVE_LABEL_BACKING_OPACITY, 1f, 1f))
        assertTrue("An unobstructed badge is solid", whole.count { it == solid } > 100)
        val yielding = renderTag(item, ResidentLabelDecision("s", ResidentLabelMode.FULL,
            TerrariumRules.NATIVE_LABEL_YIELD_BACKING_OPACITY, 1f, TerrariumRules.NATIVE_LABEL_YIELD_SIGNAL_OPACITY))
        assertEquals("A yielding badge is never opaque", 0, yielding.count { it == solid })
        assertTrue("…but still drawn", yielding.count { it ushr 24 in 1..254 } > 100)
    }

    private fun renderTag(item: AquariumResident, decision: ResidentLabelDecision): IntArray {
        val bitmap = Bitmap.createBitmap(600, 500, Bitmap.Config.ARGB_8888)
        painter.drawTag(Canvas(bitmap), item, 250f, 100f, decision)
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        bitmap.recycle()
        return pixels
    }

    private fun render(item: AquariumResident, labels: Boolean, phase: Float = 0f, selected: Boolean = false): IntArray {
        val bitmap = Bitmap.createBitmap(600, 500, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val overlay = painter
        overlay.drawCues(canvas, item, 250f, 300f, 100f, phase, selected)
        if (labels) overlay.drawTag(canvas, item, 250f, 100f, ResidentLabelDecision(item.id, ResidentLabelMode.FULL, 1f, 1f))
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        bitmap.recycle()
        return pixels
    }
}
