package com.project.human

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar

    companion object {
        private const val BASE_URL = "https://project-human.netlify.app/"
        private const val WEB_VIEW_STATE_KEY = "webViewState"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Match the app theme colors
        window.statusBarColor = Color.parseColor("#0a0a0f")
        window.navigationBarColor = Color.parseColor("#0a0a0f")

        // Build layout programmatically — no XML needed
        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0a0a0f"))
        }

        // Thin progress bar at the top
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                6
            )
            isIndeterminate = false
            max = 100
            progressDrawable.setColorFilter(
                Color.parseColor("#4f8cff"),
                android.graphics.PorterDuff.Mode.SRC_IN
            )
            visibility = View.GONE
        }

        // WebView — fullscreen, no browser chrome
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#0a0a0f"))
        }

        rootLayout.addView(webView)
        rootLayout.addView(progressBar)
        setContentView(rootLayout)

        // Configure WebView settings for full app-like experience
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

            // Make it feel native — no zoom controls
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            // User agent — append app identifier
            userAgentString = "$userAgentString ProjectHumanApp/1.0"
        }

        // Enable cookies for Firebase Auth
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        // Progress bar handling
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }

        // Handle navigation — keep everything inside the app
        webView.webViewClient = object : WebViewClient() {

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
            }

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
                // Only handle main frame errors
                if (request?.isForMainFrame == true) {
                    super.onReceivedError(view, request, error)
                }
            }
        }

        // Restore WebView state or load fresh
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            val url = buildLaunchUrl()
            webView.loadUrl(url)
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

    // Handle back button — navigate within WebView history first
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
