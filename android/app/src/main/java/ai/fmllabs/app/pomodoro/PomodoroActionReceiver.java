package ai.fmllabs.app.pomodoro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class PomodoroActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        int duration = intent.getIntExtra(PomodoroLiveService.EXTRA_DURATION_SECONDS, 25 * 60);
        int remaining = intent.getIntExtra(PomodoroLiveService.EXTRA_REMAINING_SECONDS, duration);
        PomodoroLiveService.enqueue(context, action, duration, remaining);
    }
}
