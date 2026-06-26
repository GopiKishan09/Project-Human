package com.project.human

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var loadingOverlay: FrameLayout
    private var hasPageLoaded = false

    companion object {
        private const val BASE_URL = "https://project-human.netlify.app/"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Match the app theme colors
        window.statusBarColor = Color.parseColor("#0a0a0f")
        window.navigationBarColor = Color.parseColor("#0a0a0f")

        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0a0a0f"))
        }

        // ── WebView (behind the loading overlay) ──
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#0a0a0f"))
        }
        rootLayout.addView(webView)

        // ── Loading Overlay (on top of WebView) ──
        loadingOverlay = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#0a0a0f"))
        }

        val centerContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
            }
        }

        // Lightning bolt icon ⚡
        val iconView = TextView(this).apply {
            text = "⚡"
            textSize = 48f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                bottomMargin = 32
            }
        }

        // Pulsing glow animation on the icon
        val pulseAnimator = ObjectAnimator.ofFloat(iconView, "alpha", 0.4f, 1f).apply {
            duration = 1000
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
        }
        pulseAnimator.start()

        // App title
        val titleView = TextView(this).apply {
            text = "PROJECT HUMAN"
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.2f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                bottomMargin = 8
            }
        }

        // Subtitle
        val subtitleView = TextView(this).apply {
            text = "Build Your Character"
            setTextColor(Color.parseColor("#666680"))
            textSize = 14f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                bottomMargin = 48
            }
        }

        // Small circular spinner
        val spinner = ProgressBar(this).apply {
            layoutParams = LinearLayout.LayoutParams(48, 48).apply {
                gravity = Gravity.CENTER_HORIZONTAL
            }
            isIndeterminate = true
            indeterminateTintList = android.content.res.ColorStateList.valueOf(
                Color.parseColor("#4f8cff")
            )
        }

        centerContent.addView(iconView)
        centerContent.addView(titleView)
        centerContent.addView(subtitleView)
        centerContent.addView(spinner)
        loadingOverlay.addView(centerContent)
        rootLayout.addView(loadingOverlay)

        setContentView(rootLayout)

        // ── WebView Settings ──
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

            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            // Fix Google Sign-In 403: strip WebView markers
            userAgentString = userAgentString
                .replace("; wv)", ")")
                .replace("Version/4.0 ", "")
        }

        // Enable cookies for Firebase Auth
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        // ── WebView Client ──
        webView.webViewClient = object : WebViewClient() {

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (!hasPageLoaded) {
                    hasPageLoaded = true
                    // Smooth fade-out of loading overlay
                    loadingOverlay.animate()
                        .alpha(0f)
                        .setDuration(400)
                        .setListener(object : AnimatorListenerAdapter() {
                            override fun onAnimationEnd(animation: Animator) {
                                loadingOverlay.visibility = View.GONE
                                pulseAnimator.cancel()
                            }
                        })
                        .start()
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                if (url.contains("project-human.netlify.app")) return false

                if (url.contains("accounts.google.com") ||
                    url.contains("googleapis.com") ||
                    url.contains("gstatic.com") ||
                    url.contains("firebaseapp.com") ||
                    url.contains("firebase") ||
                    url.contains("google.com/o/oauth") ||
                    url.contains("google.com/signin")) {
                    return false
                }

                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (e: Exception) { }
                return true
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    super.onReceivedError(view, request, error)
                }
            }
        }

        // Load page
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
            // If restoring, hide overlay immediately
            loadingOverlay.visibility = View.GONE
            hasPageLoaded = true
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
        } catch (e: Exception) { null }

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
            if (intent?.data?.isHierarchical == true) intent.data?.getQueryParameter("tab") else null
        } catch (e: Exception) { null }

        if (!tab.isNullOrEmpty()) {
            webView.loadUrl(Uri.parse(BASE_URL).buildUpon()
                .appendQueryParameter("utm_source", "android-app")
                .appendQueryParameter("tab", tab)
                .build().toString())
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() { super.onResume(); webView.onResume() }
    override fun onPause() { webView.onPause(); super.onPause() }
    override fun onDestroy() { webView.destroy(); super.onDestroy() }
}
