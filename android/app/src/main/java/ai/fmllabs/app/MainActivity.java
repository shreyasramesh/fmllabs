package ai.fmllabs.app;

import android.os.Bundle;

import ai.fmllabs.app.pomodoro.PomodoroLivePlugin;
import ai.fmllabs.app.widget.WidgetDataPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PomodoroLivePlugin.class);
        registerPlugin(WidgetDataPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
