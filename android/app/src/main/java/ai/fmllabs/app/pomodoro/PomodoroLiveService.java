package ai.fmllabs.app.pomodoro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import ai.fmllabs.app.MainActivity;
import ai.fmllabs.app.R;

public class PomodoroLiveService extends Service {
    public static final String ACTION_START = "ai.fmllabs.app.pomodoro.START";
    public static final String ACTION_RESUME = "ai.fmllabs.app.pomodoro.RESUME";
    public static final String ACTION_PAUSE = "ai.fmllabs.app.pomodoro.PAUSE";
    public static final String ACTION_RESET = "ai.fmllabs.app.pomodoro.RESET";
    public static final String ACTION_END = "ai.fmllabs.app.pomodoro.END";
    public static final String ACTION_STOP = "ai.fmllabs.app.pomodoro.STOP";

    public static final String EXTRA_DURATION_SECONDS = "durationSeconds";
    public static final String EXTRA_REMAINING_SECONDS = "remainingSeconds";

    private static final String CHANNEL_ID = "pomodoro_live_channel";
    private static final int FOREGROUND_ID = 1602;
    private static final int COMPLETED_ID = 1603;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean running = false;
    private boolean completed = false;
    private int durationSeconds = 25 * 60;
    private int remainingSeconds = 25 * 60;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            if (remainingSeconds > 0) {
                remainingSeconds -= 1;
                emitState("tick");
                updateForegroundNotification();
            }
            if (remainingSeconds <= 0) {
                running = false;
                completed = true;
                emitState("completed");
                showCompletedNotification();
                stopForeground(STOP_FOREGROUND_REMOVE);
                stopSelf();
                return;
            }
            handler.postDelayed(this, 1000);
        }
    };

    public static void enqueue(Context context, String action, int durationSeconds, int remainingSeconds) {
        Intent intent = new Intent(context, PomodoroLiveService.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_DURATION_SECONDS, Math.max(1, durationSeconds));
        intent.putExtra(EXTRA_REMAINING_SECONDS, Math.max(0, remainingSeconds));
        ContextCompat.startForegroundService(context, intent);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        int incomingDuration = intent != null ? intent.getIntExtra(EXTRA_DURATION_SECONDS, durationSeconds) : durationSeconds;
        int incomingRemaining = intent != null ? intent.getIntExtra(EXTRA_REMAINING_SECONDS, remainingSeconds) : remainingSeconds;

        if (incomingDuration > 0) durationSeconds = incomingDuration;
        if (incomingRemaining >= 0) remainingSeconds = Math.min(incomingRemaining, durationSeconds);

        if (ACTION_START.equals(action) || ACTION_RESUME.equals(action)) {
            completed = false;
            running = true;
            startForeground(FOREGROUND_ID, buildForegroundNotification());
            handler.removeCallbacks(ticker);
            handler.postDelayed(ticker, 1000);
            emitState(ACTION_START.equals(action) ? "start" : "resume");
        } else if (ACTION_PAUSE.equals(action)) {
            running = false;
            handler.removeCallbacks(ticker);
            updateForegroundNotification();
            emitState("pause");
        } else if (ACTION_RESET.equals(action)) {
            running = false;
            completed = false;
            remainingSeconds = durationSeconds;
            handler.removeCallbacks(ticker);
            updateForegroundNotification();
            emitState("reset");
        } else if (ACTION_END.equals(action)) {
            running = false;
            completed = false;
            handler.removeCallbacks(ticker);
            emitState("end");
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        } else if (ACTION_STOP.equals(action)) {
            running = false;
            handler.removeCallbacks(ticker);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        } else {
            startForeground(FOREGROUND_ID, buildForegroundNotification());
            emitState("sync");
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacks(ticker);
        super.onDestroy();
    }

    private void emitState(String source) {
        PomodoroLiveEvents.dispatch(new PomodoroLiveEvents.State(
            durationSeconds,
            remainingSeconds,
            running,
            completed,
            source
        ));
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Pomodoro Live Timer",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Lock-screen Pomodoro controls and live countdown.");
        manager.createNotificationChannel(channel);
    }

    private Notification buildForegroundNotification() {
        String status = running ? "Focus session running" : "Focus session paused";
        String countdown = format(remainingSeconds);

        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
            this,
            6010,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag()
        );

        Intent pauseResumeIntent = new Intent(this, PomodoroActionReceiver.class);
        pauseResumeIntent.setAction(running ? ACTION_PAUSE : ACTION_RESUME);
        pauseResumeIntent.putExtra(EXTRA_DURATION_SECONDS, durationSeconds);
        pauseResumeIntent.putExtra(EXTRA_REMAINING_SECONDS, remainingSeconds);
        PendingIntent pauseResumePending = PendingIntent.getBroadcast(
            this,
            6011,
            pauseResumeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag()
        );

        Intent resetIntent = new Intent(this, PomodoroActionReceiver.class);
        resetIntent.setAction(ACTION_RESET);
        resetIntent.putExtra(EXTRA_DURATION_SECONDS, durationSeconds);
        resetIntent.putExtra(EXTRA_REMAINING_SECONDS, remainingSeconds);
        PendingIntent resetPending = PendingIntent.getBroadcast(
            this,
            6012,
            resetIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag()
        );

        Intent endIntent = new Intent(this, PomodoroActionReceiver.class);
        endIntent.setAction(ACTION_END);
        endIntent.putExtra(EXTRA_DURATION_SECONDS, durationSeconds);
        endIntent.putExtra(EXTRA_REMAINING_SECONDS, remainingSeconds);
        PendingIntent endPending = PendingIntent.getBroadcast(
            this,
            6013,
            endIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag()
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("Pomodoro")
            .setContentText(status + " • " + countdown)
            .setSubText("Use lock-screen controls")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openAppPending)
            .addAction(new NotificationCompat.Action(
                R.drawable.ic_launcher_foreground,
                running ? "Pause" : "Resume",
                pauseResumePending
            ))
            .addAction(new NotificationCompat.Action(
                R.drawable.ic_launcher_foreground,
                "Reset",
                resetPending
            ))
            .addAction(new NotificationCompat.Action(
                R.drawable.ic_launcher_foreground,
                "End",
                endPending
            ))
            .build();
    }

    private void updateForegroundNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        manager.notify(FOREGROUND_ID, buildForegroundNotification());
    }

    private void showCompletedNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("Pomodoro complete")
            .setContentText("Nice work. Your focus session just ended.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .build();
        manager.notify(COMPLETED_ID, notification);
    }

    private int immutableFlag() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
    }

    private static String format(int totalSeconds) {
        int safe = Math.max(0, totalSeconds);
        int mins = safe / 60;
        int secs = safe % 60;
        return String.format("%02d:%02d", mins, secs);
    }
}
