package com.project.human

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Per-action daily reminders, scheduled natively so they fire whether or not
 * the WebView is running.
 *
 * The web app owns the data: whenever actions change it hands us the full
 * list through [WebAppBridge], we persist it, and we rebuild every alarm from
 * that snapshot. Rebuilding wholesale (rather than diffing) keeps the two
 * sides from drifting apart when an action is renamed, retimed or deleted.
 */
object ReminderScheduler {

    private const val TAG = "ReminderScheduler"
    private const val PREFS = "ph_reminders"
    private const val KEY_PAYLOAD = "payload"

    const val CHANNEL_ID = "action_reminders"
    const val EXTRA_ACTION_ID = "action_id"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    /** One reminder as the web app describes it. */
    data class Reminder(
        val id: String,
        val name: String,
        val hour: Int,
        val minute: Int,
        val missionName: String
    )

    // ── Storage ──────────────────────────────────────────────────────────

    fun savePayload(context: Context, json: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_PAYLOAD, json).apply()
    }

    private fun loadPayload(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_PAYLOAD, "[]") ?: "[]"

    /**
     * Parses the web app's payload. Anything malformed is skipped rather than
     * thrown, so one bad row cannot cost the user every other reminder.
     */
    fun parse(json: String): List<Reminder> {
        val out = mutableListOf<Reminder>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val id = o.optString("id")
                val time = o.optString("time")
                if (id.isEmpty() || !time.matches(Regex("^\\d{1,2}:\\d{2}$"))) continue

                val parts = time.split(":")
                val hour = parts[0].toIntOrNull() ?: continue
                val minute = parts[1].toIntOrNull() ?: continue
                if (hour !in 0..23 || minute !in 0..59) continue

                out.add(
                    Reminder(
                        id = id,
                        name = o.optString("name", "Your action"),
                        hour = hour,
                        minute = minute,
                        missionName = o.optString("missionName", "")
                    )
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Bad reminder payload", e)
        }
        return out
    }

    // ── Scheduling ───────────────────────────────────────────────────────

    /** Replaces every scheduled alarm with the ones in [json]. */
    fun sync(context: Context, json: String) {
        cancelAll(context)
        savePayload(context, json)
        scheduleAll(context)
    }

    /** Re-arms everything from the last saved snapshot (used after reboot). */
    fun scheduleAll(context: Context) {
        ensureChannel(context)
        val reminders = parse(loadPayload(context))
        for (r in reminders) scheduleNext(context, r)
        Log.i(TAG, "Scheduled ${reminders.size} reminder(s)")
    }

    private fun cancelAll(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (r in parse(loadPayload(context))) {
            am.cancel(pendingIntentFor(context, r, PendingIntent.FLAG_NO_CREATE) ?: continue)
        }
    }

    /** Schedules [r] for its next occurrence — today if still ahead, else tomorrow. */
    fun scheduleNext(context: Context, r: Reminder) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntentFor(context, r, PendingIntent.FLAG_UPDATE_CURRENT) ?: return

        val next = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, r.hour)
            set(Calendar.MINUTE, r.minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }.timeInMillis

        // Exact alarms need a user-granted permission on Android 12+. Rather
        // than demand it (Play restricts USE_EXACT_ALARM to alarm-clock apps),
        // fall back to an inexact wake-up, which the system may delay a little
        // but still delivers.
        val canBeExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
        try {
            if (canBeExact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
            }
        } catch (e: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
        }
    }

    private fun pendingIntentFor(context: Context, r: Reminder, flag: Int): PendingIntent? {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra(EXTRA_ACTION_ID, r.id)
            putExtra(EXTRA_TITLE, r.name)
            putExtra(
                EXTRA_BODY,
                if (r.missionName.isEmpty()) "Time to level up." else r.missionName
            )
        }
        return PendingIntent.getBroadcast(
            context,
            r.id.hashCode(),
            intent,
            flag or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** Finds a stored reminder by id so the receiver can re-arm tomorrow's alarm. */
    fun find(context: Context, id: String): Reminder? =
        parse(loadPayload(context)).firstOrNull { it.id == id }

    // ── Notification channel ─────────────────────────────────────────────

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "Action reminders",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Nudges for the actions you scheduled a time for"
            enableLights(true)
            lightColor = Color.parseColor("#9333EA")
            enableVibration(true)
            setShowBadge(true)
        }
        nm.createNotificationChannel(channel)
    }

    fun buildNotification(context: Context, title: String, body: String): Notification {
        val open = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_tab", "today")
        }
        val contentIntent = PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
        }

        return builder
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    setColor(Color.parseColor("#9333EA"))
                }
            }
            .build()
    }
}
