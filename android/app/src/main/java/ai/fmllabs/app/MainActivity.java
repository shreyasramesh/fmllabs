package ai.fmllabs.app;

import android.os.Bundle;

import ai.fmllabs.app.pomodoro.PomodoroLivePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PomodoroLivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
