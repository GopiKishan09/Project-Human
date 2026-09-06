package com.project.human

import android.Manifest
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Fires at a reminder's time: posts the notification, then re-arms the same
 * reminder for tomorrow (AlarmManager one-shots do not repeat on their own,
 * and a repeating alarm would drift across DST).
 */
class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val actionId = intent.getStringExtra(ReminderScheduler.EXTRA_ACTION_ID) ?: return
        val title = intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "Your action"
        val body = intent.getStringExtra(ReminderScheduler.EXTRA_BODY) ?: "Time to level up."

        if (canPostNotifications(context)) {
            ReminderScheduler.ensureChannel(context)
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(
                actionId.hashCode(),
                ReminderScheduler.buildNotification(context, title, body)
            )
            Log.i("ReminderReceiver", "Reminder delivered for " + actionId)
        }

        // Re-arm for the next day, but only while the action still exists.
        ReminderScheduler.find(context, actionId)?.let {
            ReminderScheduler.scheduleNext(context, it)
        }
    }

    private fun canPostNotifications(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }
}
