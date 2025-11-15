package com.localmodules.audiomode

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.app.ActivityManager
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioModeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val audioManager: AudioManager =
        reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    
    private val activityManager: ActivityManager =
        reactContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    
    private val handler = Handler(Looper.getMainLooper())
    private var cleanupRunnable: Runnable? = null
    private var isMonitoring = false

    override fun getName(): String = "AudioModeModule"

    @ReactMethod
    fun setModeNormal() {
        audioManager.mode = AudioManager.MODE_NORMAL
    }

    @ReactMethod
    fun setModeInCall() {
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
    }

    @ReactMethod
    fun setSpeakerOn(on: Boolean) {
        audioManager.isSpeakerphoneOn = on
    }

    @ReactMethod
    fun resetAudioState() {
        try {
            // Reset completo del estado de audio
            audioManager.mode = AudioManager.MODE_NORMAL
            audioManager.isSpeakerphoneOn = false
            audioManager.abandonAudioFocus(null)
        } catch (e: Exception) {
            // Log error pero no fallar
        }
    }

    @ReactMethod
    fun startAudioMonitoring() {
        if (isMonitoring) return
        isMonitoring = true
        
        cleanupRunnable = Runnable {
            try {
                // Verificar si la app está en primer plano
                if (!isAppInForeground()) {
                    // App no está en primer plano, limpiar audio
                    resetAudioState()
                }
            } catch (e: Exception) {
                // Log error pero continuar
            }
            
            // Programar siguiente verificación
            if (isMonitoring) {
                handler.postDelayed(cleanupRunnable!!, 2000) // Cada 2 segundos
            }
        }
        
        handler.postDelayed(cleanupRunnable!!, 2000)
    }

    @ReactMethod
    fun stopAudioMonitoring() {
        isMonitoring = false
        cleanupRunnable?.let { handler.removeCallbacks(it) }
        cleanupRunnable = null
    }

    private fun isAppInForeground(): Boolean {
        return try {
            val runningTasks = activityManager.getRunningTasks(1)
            if (runningTasks.isNotEmpty()) {
                val topActivity = runningTasks[0].topActivity
                topActivity?.packageName == reactApplicationContext.packageName
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    @ReactMethod
    fun startCleanupService() {
        try {
            val intent = Intent(reactApplicationContext, AudioCleanupService::class.java)
            reactApplicationContext.startService(intent)
        } catch (e: Exception) {
            // Log error pero no fallar
        }
    }

    @ReactMethod
    fun stopCleanupService() {
        try {
            val intent = Intent(reactApplicationContext, AudioCleanupService::class.java)
            reactApplicationContext.stopService(intent)
        } catch (e: Exception) {
            // Log error pero no fallar
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopAudioMonitoring()
        resetAudioState()
    }
}
