package com.project.human

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var isProceeding = false
    private var isActivityAlive = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            setContentView(R.layout.activity_splash)
        } catch (e: Exception) {
            // If splash layout fails, go straight to main activity
            launchMainActivity()
            return
        }

        connectivityManager = try {
            getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        } catch (e: Exception) {
            null
        }

        isActivityAlive = true

        // Delay launch to show splash screen for 2 seconds before verifying connection
        mainHandler.postDelayed({
            if (isActivityAlive && !isFinishing) {
                checkConnectionAndProceed()
            }
        }, 2000)
    }

    private fun isOnline(): Boolean {
        val cm = connectivityManager ?: return false
        return try {
            val network = cm.activeNetwork ?: return false
            val capabilities = cm.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (e: Exception) {
            false
        }
    }

    private fun checkConnectionAndProceed() {
        if (isOnline()) {
            launchMainActivity()
        } else {
            showOfflineScreen()
        }
    }

    private fun launchMainActivity() {
        if (!isProceeding) {
            isProceeding = true
            unregisterNetworkCallback()

            try {
                val intent = Intent(this, MainActivity::class.java)
                // Only forward deep-link data URI, not extras (to avoid conflicts with LauncherActivity)
                intent.data = getIntent()?.data
                startActivity(intent)
            } catch (e: Exception) {
                // If MainActivity launch fails, try without data
                try {
                    val fallbackIntent = Intent(this, MainActivity::class.java)
                    startActivity(fallbackIntent)
                } catch (e2: Exception) {
                    // Fatal: cannot launch main activity at all
                }
            }

            finish()
        }
    }

    private fun showOfflineScreen() {
        try {
            setContentView(R.layout.activity_main)

            // Setup Retry Button click listener
            val btnRetry = findViewById<Button>(R.id.btn_retry)
            btnRetry?.setOnClickListener {
                if (isOnline()) {
                    launchMainActivity()
                }
            }

            // Register auto-reconnect callback
            registerNetworkCallback()
        } catch (e: Exception) {
            // If offline screen fails to render, just try launching main anyway
            launchMainActivity()
        }
    }

    private fun registerNetworkCallback() {
        if (networkCallback == null) {
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    super.onAvailable(network)
                    mainHandler.post {
                        if (isActivityAlive && !isFinishing && isOnline()) {
                            launchMainActivity()
                        }
                    }
                }
            }
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            try {
                connectivityManager?.registerNetworkCallback(request, networkCallback!!)
            } catch (e: Exception) {
                // Ignore fallback registration failures
            }
        }
    }

    private fun unregisterNetworkCallback() {
        networkCallback?.let {
            try {
                connectivityManager?.unregisterNetworkCallback(it)
            } catch (e: Exception) {
                // Ignore
            }
            networkCallback = null
        }
    }

    override fun onDestroy() {
        isActivityAlive = false
        mainHandler.removeCallbacksAndMessages(null)
        unregisterNetworkCallback()
        super.onDestroy()
    }
}
