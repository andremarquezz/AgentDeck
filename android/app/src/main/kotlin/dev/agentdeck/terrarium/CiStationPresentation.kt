package dev.agentdeck.terrarium

import android.graphics.Canvas
import android.graphics.Paint
import dev.agentdeck.net.CiWaitStatus
import dev.agentdeck.ui.theme.DesignTokens
import androidx.compose.ui.graphics.toArgb
import kotlin.math.sin

internal fun ciStationLabel(wait: CiWaitStatus): String {
    val phase = if (wait.phase in listOf("queued", "running", "passed", "failed")) wait.phase.uppercase() else "UNKNOWN"
    return "CI $phase" + (wait.pr?.let { " #$it" } ?: "") + (wait.checks?.let { " · ${it.passed}/${it.total}" } ?: "")
}
internal fun ciStationBadge(wait: CiWaitStatus) = when (wait.phase) {
    "running" -> wait.checks?.let { "${it.passed}/${it.total}" } ?: "CI running"
    "queued" -> "CI queued"
    "passed" -> "CI ✓"
    "failed" -> "CI !"
    else -> "CI ?"
}
internal fun ciStationColor(wait: CiWaitStatus?) = when (wait?.phase) {
    "queued", "running" -> DesignTokens.Session.working
    "passed" -> DesignTokens.UI.ok
    "failed" -> DesignTokens.Session.error
    else -> DesignTokens.Session.idle
}
internal fun ciStationQueue(state: TerrariumState, visible: Set<String>): List<String> =
    state.ciWaitingIds.intersect(visible).sortedWith(compareBy<String> { state.ciWaits[it]?.openedAt ?: 0L }.thenBy { it })
        .take(TerrariumRules.NATIVE_RESIDENT_LIMIT)
internal fun ciStationPosition(slot: Int, wait: CiWaitStatus?): Pair<Float, Float> =
    TerrariumRules.CI_STATION_X + (slot % TerrariumRules.CI_STATION_QUEUE_COLUMNS.toInt()) * TerrariumRules.CI_STATION_QUEUE_GAP to
        TerrariumRules.CI_STATION_QUEUE_Y - (slot / TerrariumRules.CI_STATION_QUEUE_COLUMNS.toInt()) * TerrariumRules.CI_STATION_QUEUE_RISE -
        (if (wait?.phase == "unknown") TerrariumRules.CI_STATION_UNKNOWN_DISTANCE else 0f)

/** A presentation path only. Simulation homes, touch identity and evidence stay canonical. */
internal class CiStationVisits(private val clock: () -> Long = System::nanoTime) {
    private val positions = mutableMapOf<String, Pair<Float, Float>>()
    private var previous = emptyMap<String, CiWaitStatus>()
    private val hops = mutableMapOf<String, Float>()
    private var lastFrame = 0L
    var time = 0f; private set
    var queue = emptyList<String>(); private set
    fun update(state: TerrariumState, originals: Map<String, Pair<Float, Float>>, animate: Boolean = true): Map<String, Pair<Float, Float>> {
        val now = clock()
        val dt = if (lastFrame == 0L) 0f else ((now-lastFrame)/1_000_000_000f).coerceIn(0f,.05f)
        lastFrame = now
        val step = if (animate) dt else 0f
        time += step
        queue = ciStationQueue(state, originals.keys)
        for ((id, base) in originals) {
            val wait = state.ciWaits[id]
            if (wait?.phase == "passed" && previous[id] != null && previous[id]?.phase != "passed") hops[id] = TerrariumRules.CI_STATION_HOP_SECONDS
            val slot = queue.indexOf(id)
            var target = if (slot >= 0) ciStationPosition(slot, wait) else base
            val left = hops[id] ?: 0f
            if (left > 0f) {
                val age = TerrariumRules.CI_STATION_HOP_SECONDS-left
                target = target.first to target.second - maxOf(0f, sin(age/TerrariumRules.CI_STATION_HOP_SECONDS*Math.PI.toFloat()))*TerrariumRules.CI_STATION_HOP_HEIGHT
                hops[id] = maxOf(0f, left-step)
            }
            if (id in positions || slot >= 0 || left > 0f) {
                val old = positions[id] ?: base
                val blend = if (animate) minOf(1f, step*TerrariumRules.CI_STATION_RESPONSE_RATE) else 1f
                val p = if (animate) old.first+(target.first-old.first)*blend to old.second+(target.second-old.second)*blend else target
                positions[id] = p
                if (slot < 0 && left == 0f && kotlin.math.hypot(p.first-base.first,p.second-base.second) < .002f) positions.remove(id)
            }
        }
        positions.keys.retainAll(originals.keys); hops.keys.retainAll(originals.keys)
        previous = state.ciWaits
        return positions
    }
}

internal fun drawCiStation(canvas: Canvas, paint: Paint, state: TerrariumState, queue: List<String>, positions: Map<String, Pair<Float, Float>>, time: Float,
    x: Float = canvas.width*TerrariumRules.CI_STATION_X, y: Float = canvas.height*TerrariumRules.CI_STATION_Y,
    width: Float = canvas.width*TerrariumRules.CI_STATION_WIDTH_FRAC, drawResident: Boolean = true) {
    val unit = width/8f
    val first = queue.firstOrNull()?.let { state.ciWaits[it] }
    val asleep = queue.isEmpty()
    paint.style = Paint.Style.FILL; paint.alpha = 255
    if (drawResident) {
        paint.color = DesignTokens.Ink.s700.toArgb()
        canvas.drawOval(x-width/2, y+unit*2, x+width/2, y+unit*4, paint)
        paint.color = DesignTokens.Coral.s500.toArgb()
        paint.alpha = if (asleep || first?.phase == "unknown") (TerrariumRules.CI_STATION_ASLEEP_OPACITY*255).toInt() else 255
        CiWaitVisual.shrimp.forEachIndexed { row,bits -> for (col in 0 until 8) if (bits and (1 shl (7-col)) != 0)
            canvas.drawRect(x-width/2+col*unit,y-unit*5+row*unit,x-width/2+(col+1)*unit,y-unit*5+(row+1)*unit,paint) }
    }
    paint.textAlign = Paint.Align.CENTER; paint.textSize = maxOf(9f,minOf(12f,canvas.width*.015f))
    paint.color = ciStationColor(first).toArgb(); paint.alpha = 255
    canvas.drawText(if (asleep) "CI · asleep" else first?.let(::ciStationLabel) ?: "CI UNKNOWN",x,y+unit*6,paint)
    for (id in queue) {
        val p = positions[id] ?: continue
        paint.color = ciStationColor(state.ciWaits[id]).toArgb(); paint.alpha = 110
        paint.strokeWidth = 1f
        canvas.drawLine(x,y-unit*3,p.first,p.second,paint)
    }
    for ((id,p) in positions) state.ciWaits[id]?.let { wait ->
        paint.color = ciStationColor(wait).toArgb(); paint.alpha = 255
        paint.textSize = maxOf(9f,minOf(11f,canvas.width*.015f))
        canvas.drawText(ciStationBadge(wait),p.first,p.second+unit*3,paint)
    }
    if (first?.phase == "running") queue.firstOrNull()?.let { positions[it] }?.let { p ->
        val scan = .5f+.5f*sin(time*TerrariumRules.CI_STATION_SCAN_RATE)
        paint.color = DesignTokens.Tide.s50.toArgb(); paint.alpha = 190; paint.strokeWidth = 1f
        canvas.drawLine(p.first-width/3,p.second-unit*3+scan*unit*6,p.first+width/3,p.second-unit*3+scan*unit*6,paint)
    }
    paint.alpha = 255
}
