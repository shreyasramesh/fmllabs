package ai.fmllabs.app.pomodoro;

public final class PomodoroLiveEvents {
    private PomodoroLiveEvents() {}

    public interface Listener {
        void onStateChanged(State state);
    }

    public static final class State {
        public final int durationSeconds;
        public final int remainingSeconds;
        public final boolean running;
        public final boolean completed;
        public final String source;

        public State(int durationSeconds, int remainingSeconds, boolean running, boolean completed, String source) {
            this.durationSeconds = durationSeconds;
            this.remainingSeconds = remainingSeconds;
            this.running = running;
            this.completed = completed;
            this.source = source;
        }
    }

    private static Listener listener;
    private static State lastState = new State(25 * 60, 25 * 60, false, false, "init");

    public static synchronized void setListener(Listener next) {
        listener = next;
    }

    public static synchronized void clearListener(Listener current) {
        if (listener == current) listener = null;
    }

    public static synchronized State getLastState() {
        return lastState;
    }

    public static synchronized void dispatch(State state) {
        lastState = state;
        if (listener != null) listener.onStateChanged(state);
    }
}
