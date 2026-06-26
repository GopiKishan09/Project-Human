package com.project.human

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        private const val BASE_URL = "https://project-human.netlify.app/"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Match the app theme colors
        window.statusBarColor = Color.parseColor("#0a0a0f")
        window.navigationBarColor = Color.parseColor("#0a0a0f")

        // Fullscreen WebView — no extra UI elements
        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0a0a0f"))
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#0a0a0f"))
        }

        rootLayout.addView(webView)
        setContentView(rootLayout)

        // Configure WebView settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            allowFileAccess = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)
            useWideViewPort = true
            loadWithOverviewMode = true
            mediaPlaybackRequiresUserGesture = false

            // No zoom controls — native feel
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            // Fix Google Sign-In 403 disallowed_useragent:
            // Remove WebView markers so Google treats this as a regular browser
            userAgentString = userAgentString
                .replace("; wv)", ")")
                .replace("Version/4.0 ", "")
        }

        // Enable cookies for Firebase Auth
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        // Handle navigation — keep everything inside the app
        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // Keep project-human URLs inside the WebView
                if (url.contains("project-human.netlify.app")) {
                    return false
                }

                // Google Sign-In flows must stay in WebView
                if (url.contains("accounts.google.com") ||
                    url.contains("googleapis.com") ||
                    url.contains("gstatic.com") ||
                    url.contains("firebaseapp.com") ||
                    url.contains("firebase") ||
                    url.contains("google.com/o/oauth") ||
                    url.contains("google.com/signin")) {
                    return false
                }

                // External links open in browser
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (e: Exception) {
                    // No browser available
                }
                return true
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    super.onReceivedError(view, request, error)
                }
            }
        }

        // Restore WebView state or load fresh
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(buildLaunchUrl())
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

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)

        val tab = try {
            if (intent?.data?.isHierarchical == true) {
                intent.data?.getQueryParameter("tab")
            } else null
        } catch (e: Exception) {
            null
        }

        if (!tab.isNullOrEmpty()) {
            val url = Uri.parse(BASE_URL).buildUpon()
                .appendQueryParameter("utm_source", "android-app")
                .appendQueryParameter("tab", tab)
                .build().toString()
            webView.loadUrl(url)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
