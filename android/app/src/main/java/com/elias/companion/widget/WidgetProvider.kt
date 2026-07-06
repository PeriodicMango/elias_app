// ---------------------------------------------------------------------------
// EliasWidgetProvider — Android home screen widget (Glance)
// ---------------------------------------------------------------------------
// Placeholder. Renders persona name + latest greeting in a 2x2 widget.
// Data is read from SharedPreferences, written by the Capacitor WidgetBridge
// plugin (frontend/js/core/WidgetBridge.js).
//
// Setup:
//   dependencies { implementation("androidx.glance:glance-appwidget:1.1.+") }
//   Register in AndroidManifest.xml as a <receiver>
// ---------------------------------------------------------------------------

package com.elias.companion.widget

import android.content.Context
import android.content.SharedPreferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.*
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

/**
 * Interface for widget data exchange.
 *
 * The Capacitor WidgetBridge plugin implements this to write data
 * to SharedPreferences that the widget reads on refresh.
 */
interface WidgetDataBridge {
    fun updateWidget(personaName: String, greeting: String, unreadCount: Int)
    fun scheduleRefresh(intervalMinutes: Int)
}

/**
 * 2x2 widget showing current persona and latest greeting.
 *
 * Layout:
 *   ┌─────────────┐
 *   │  Persona    │
 *   │  "嗯…"      │
 *   │             │
 *   │         📋 1│
 *   └─────────────┘
 */
class EliasWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val prefs: SharedPreferences =
            context.getSharedPreferences("elias-widget", Context.MODE_PRIVATE)

        val persona = prefs.getString("persona", "Elias") ?: "Elias"
        val greeting = prefs.getString("greeting", "嗯。") ?: "嗯。"
        val unread = prefs.getInt("unread", 0)

        provideContent {
            Column(
                modifier = GlanceModifier
                    .fillMaxSize()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = persona,
                    style = TextStyle(
                        color = ColorProvider(0xFF5B9AFF.toInt())
                    )
                )

                Spacer(modifier = GlanceModifier.height(6.dp))

                Text(
                    text = greeting,
                    style = TextStyle(
                        color = ColorProvider(0xFF1D1D2F.toInt())
                    ),
                    maxLines = 2
                )

                if (unread > 0) {
                    Spacer(modifier = GlanceModifier.height(8.dp))
                    Text(
                        text = "$unread 条新消息",
                        style = TextStyle(
                            color = ColorProvider(0xFF8E98A8.toInt())
                        )
                    )
                }
            }
        }
    }
}

/**
 * Widget receiver — registered in AndroidManifest.xml as:
 * <receiver android:name=".widget.EliasWidgetReceiver" ... />
 */
class EliasWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = EliasWidget()
}
