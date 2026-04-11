package ai.fmllabs.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.CookieManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetData")
public class WidgetDataPlugin extends Plugin {

    static final String PREFS_NAME = "calorie_widget_prefs";
    static final String KEY_COOKIE = "session_cookie";

    @PluginMethod
    public void syncAuth(PluginCall call) {
        String url = call.getString("url", "https://fmllabs.ai");
        CookieManager cm = CookieManager.getInstance();
        String cookies = cm.getCookie(url);

        if (cookies != null && !cookies.isEmpty()) {
            SharedPreferences prefs = getContext()
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_COOKIE, cookies).apply();
        }
        call.resolve();
    }

    @PluginMethod
    public void refreshWidget(PluginCall call) {
        Context ctx = getContext();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        ComponentName widget = new ComponentName(ctx, CalorieWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(widget);
        if (ids != null && ids.length > 0) {
            CalorieWidgetProvider.requestUpdate(ctx, ids);
        }
        call.resolve();
    }
}
