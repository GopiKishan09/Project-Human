package com.project.human

import android.app.Activity
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface

/**
 * The web app's handle on native reminders, injected as `AndroidReminders`.
 *
 * Everything here runs on a WebView binder thread, so anything touching the
 * UI is posted back to the activity.
 */
class WebAppBridge(private val activity: Activity) {

    /** Lets the web app hide reminder settings when running in a browser. */
    @JavascriptInterface
    fun isAvailable(): Boolean = true

    /** Replaces all scheduled reminders with [json] (an array of {id,name,time,missionName}). */
    @JavascriptInterface
    fun syncReminders(json: String) {
        ReminderScheduler.sync(activity.applicationContext, json)
    }

    /** True once the user has allowed notifications (always true before Android 13). */
    @JavascriptInterface
    fun hasPermission(): Boolean = NotificationPermission.isGranted(activity)

    /** Shows the system notification prompt; no-op if already granted. */
    @JavascriptInterface
    fun requestPermission() {
        activity.runOnUiThread { NotificationPermission.request(activity) }
    }

    /**
     * True when the OS will honour exact alarm times. When false, reminders
     * still arrive, just batched by the system — worth telling the user.
     */
    @JavascriptInterface
    fun hasExactAlarms(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val am = activity.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return am.canScheduleExactAlarms()
    }

    /** Opens the OS screen where exact alarms can be allowed. */
    @JavascriptInterface
    fun openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        activity.runOnUiThread {
            try {
                activity.startActivity(
                    Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                        .setData(Uri.parse("package:" + activity.packageName))
                )
            } catch (e: Exception) {
                activity.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                        .setData(Uri.parse("package:" + activity.packageName))
                )
            }
        }
    }
}
