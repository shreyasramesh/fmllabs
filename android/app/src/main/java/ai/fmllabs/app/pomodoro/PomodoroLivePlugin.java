package ai.fmllabs.app.pomodoro;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PomodoroLive")
public class PomodoroLivePlugin extends Plugin implements PomodoroLiveEvents.Listener {
    @Override
    public void load() {
        super.load();
        PomodoroLiveEvents.setListener(this);
    }

    @Override
    protected void handleOnDestroy() {
        PomodoroLiveEvents.clearListener(this);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void start(PluginCall call) {
        int durationSeconds = Math.max(1, call.getInt("durationSeconds", 25 * 60));
        int remainingSeconds = Math.max(0, call.getInt("remainingSeconds", durationSeconds));
        PomodoroLiveService.enqueue(getContext(), PomodoroLiveService.ACTION_START, durationSeconds, remainingSeconds);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        int durationSeconds = Math.max(1, call.getInt("durationSeconds", 25 * 60));
        int remainingSeconds = Math.max(0, call.getInt("remainingSeconds", durationSeconds));
        PomodoroLiveService.enqueue(getContext(), PomodoroLiveService.ACTION_RESUME, durationSeconds, remainingSeconds);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        PomodoroLiveEvents.State s = PomodoroLiveEvents.getLastState();
        PomodoroLiveService.enqueue(getContext(), PomodoroLiveService.ACTION_PAUSE, s.durationSeconds, s.remainingSeconds);
        call.resolve();
    }

    @PluginMethod
    public void reset(PluginCall call) {
        int durationSeconds = Math.max(1, call.getInt("durationSeconds", PomodoroLiveEvents.getLastState().durationSeconds));
        PomodoroLiveService.enqueue(getContext(), PomodoroLiveService.ACTION_RESET, durationSeconds, durationSeconds);
        call.resolve();
    }

    @PluginMethod
    public void end(PluginCall call) {
        PomodoroLiveEvents.State s = PomodoroLiveEvents.getLastState();
        PomodoroLiveService.enqueue(getContext(), PomodoroLiveService.ACTION_END, s.durationSeconds, s.remainingSeconds);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        PomodoroLiveEvents.State s = PomodoroLiveEvents.getLastState();
        PomodoroLiveService.enqueue(getContext(), PomodoroLiveService.ACTION_STOP, s.durationSeconds, s.remainingSeconds);
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(toJs(PomodoroLiveEvents.getLastState()));
    }

    @Override
    public void onStateChanged(PomodoroLiveEvents.State state) {
        notifyListeners("pomodoroStateChanged", toJs(state), true);
    }

    private JSObject toJs(PomodoroLiveEvents.State state) {
        JSObject obj = new JSObject();
        obj.put("durationSeconds", state.durationSeconds);
        obj.put("remainingSeconds", state.remainingSeconds);
        obj.put("running", state.running);
        obj.put("completed", state.completed);
        obj.put("source", state.source);
        return obj;
    }
}
