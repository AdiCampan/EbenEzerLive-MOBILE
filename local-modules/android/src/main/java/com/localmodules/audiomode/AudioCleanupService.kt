package com.localmodules.audiomode

import android.app.ActivityManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

class AudioCleanupService : Service() {

    private val TAG = "AudioCleanupService"
    private lateinit var audioManager: AudioManager
    private lateinit var activityManager: ActivityManager
    private val handler = Handler(Looper.getMainLooper())
    private var cleanupRunnable: Runnable? = null
    private var isMonitoring = false

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        Log.d(TAG, "AudioCleanupService created.")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "AudioCleanupService started.")
        
        // Iniciar monitoreo continuo
        startMonitoring()
        
        // Mantener el servicio vivo
        return START_STICKY
    }

    private fun startMonitoring() {
        if (isMonitoring) return
        isMonitoring = true
        
        cleanupRunnable = Runnable {
            try {
                // Verificar si la app principal está corriendo
                if (!isAppRunning()) {
                    Log.d(TAG, "App principal no detectada, limpiando audio...")
                    resetAudioState()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error en monitoreo: ${e.message}")
            }
            
            // Programar siguiente verificación cada 3 segundos
            if (isMonitoring) {
                handler.postDelayed(cleanupRunnable!!, 3000)
            }
        }
        
        handler.postDelayed(cleanupRunnable!!, 3000)
    }

    private fun stopMonitoring() {
        isMonitoring = false
        cleanupRunnable?.let { handler.removeCallbacks(it) }
        cleanupRunnable = null
    }

    private fun isAppRunning(): Boolean {
        return try {
            val runningTasks = activityManager.getRunningTasks(10)
            runningTasks.any { taskInfo ->
                taskInfo.baseActivity?.packageName == packageName
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking running tasks: ${e.message}")
            false
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d(TAG, "App task removed. Forcing audio cleanup.")
        resetAudioState()
        super.onTaskRemoved(rootIntent)
        stopSelf()
    }

    override fun onDestroy() {
        Log.d(TAG, "AudioCleanupService destroyed.")
        stopMonitoring()
        resetAudioState()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun resetAudioState() {
        try {
            audioManager.mode = AudioManager.MODE_NORMAL
            audioManager.isSpeakerphoneOn = false
            audioManager.abandonAudioFocus(null)
            Log.d(TAG, "✅ Audio state successfully reset by service.")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error resetting audio state in service: ${e.message}")
        }
    }
}