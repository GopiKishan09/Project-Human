package com.project.human

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent

class MainActivity : AppCompatActivity() {

    private var hasLaunchedTab = false

    companion object {
        private const val BASE_URL = "https://project-human.netlify.app/"
        private const val KEY_LAUNCHED = "hasLaunchedTab"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Dark background matching the app theme
        window.statusBarColor = Color.parseColor("#0a0a0f")
        window.navigationBarColor = Color.parseColor("#0a0a0f")

        // Create a simple branded loading screen
        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0a0a0f"))
        }

        val centerLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.CENTER
            }
        }

        val logo = ImageView(this).apply {
            setImageResource(R.drawable.ic_launcher_foreground)
            layoutParams = LinearLayout.LayoutParams(192, 192).apply {
                gravity = android.view.Gravity.CENTER_HORIZONTAL
                bottomMargin = 48
            }
        }

        val title = TextView(this).apply {
            text = "PROJECT HUMAN"
            setTextColor(Color.WHITE)
            textSize = 28f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            letterSpacing = 0.15f
            gravity = android.view.Gravity.CENTER
        }

        centerLayout.addView(logo)
        centerLayout.addView(title)
        rootLayout.addView(centerLayout)
        setContentView(rootLayout)

        hasLaunchedTab = savedInstanceState?.getBoolean(KEY_LAUNCHED, false) ?: false

        if (!hasLaunchedTab) {
            launchCustomTab()
        }
    }

    private fun launchCustomTab() {
        hasLaunchedTab = true

        val url = buildLaunchUrl()

        val colorParams = CustomTabColorSchemeParams.Builder()
            .setToolbarColor(Color.parseColor("#0a0a0f"))
            .setSecondaryToolbarColor(Color.parseColor("#0a0a0f"))
            .setNavigationBarColor(Color.parseColor("#0a0a0f"))
            .build()

        val customTabsIntent = CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(colorParams)
            .setColorScheme(CustomTabsIntent.COLOR_SCHEME_DARK)
            .setUrlBarHidingEnabled(true)
            .setShowTitle(false)
            .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
            .build()

        try {
            customTabsIntent.launchUrl(this, Uri.parse(url))
        } catch (e: Exception) {
            // Fallback: open in default browser
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (e2: Exception) {
                // No browser available
            }
        }
    }

    private fun buildLaunchUrl(): String {
        val builder = Uri.parse(BASE_URL).buildUpon()
            .appendQueryParameter("utm_source", "android-app")

        val targetTab = try {
            intent?.getStringExtra("target_tab")
                ?: if (intent?.data?.isHierarchical == true) {
                    intent?.data?.getQueryParameter("tab")
                } else null
        } catch (e: Exception) {
            null
        }

        if (!targetTab.isNullOrEmpty()) {
            builder.appendQueryParameter("tab", targetTab)
        }

        return builder.build().toString()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)

        // Re-launch Custom Tab with deep-link
        val tab = try {
            if (intent?.data?.isHierarchical == true) {
                intent.data?.getQueryParameter("tab")
            } else null
        } catch (e: Exception) {
            null
        }

        if (!tab.isNullOrEmpty()) {
            hasLaunchedTab = false
            launchCustomTab()
        }
    }

    override fun onRestart() {
        super.onRestart()
        // User returned from Chrome Custom Tab (pressed back)
        // Re-launch the Custom Tab to keep the app experience
        if (hasLaunchedTab) {
            hasLaunchedTab = false
            launchCustomTab()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_LAUNCHED, hasLaunchedTab)
    }
}
