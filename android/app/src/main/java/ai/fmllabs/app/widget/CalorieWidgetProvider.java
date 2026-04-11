package ai.fmllabs.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import ai.fmllabs.app.MainActivity;
import ai.fmllabs.app.R;

public class CalorieWidgetProvider extends AppWidgetProvider {

    private static final String API_URL = "https://www.fmllabs.ai/api/me/widget/nutrition";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void requestUpdate(Context ctx, int[] ids) {
        Intent intent = new Intent(ctx, CalorieWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        ctx.sendBroadcast(intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, mgr, id);
        }
    }

    private void updateWidget(Context context, AppWidgetManager mgr, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calorie);

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        views.setTextViewText(R.id.widget_status, "Loading…");
        views.setViewVisibility(R.id.widget_status, View.VISIBLE);
        mgr.updateAppWidget(widgetId, views);

        executor.execute(() -> {
            NutritionData data = fetchData(context);
            mainHandler.post(() -> applyData(context, mgr, widgetId, data));
        });
    }

    private void applyData(Context context, AppWidgetManager mgr, int widgetId, NutritionData data) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calorie);

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        if (data == null) {
            views.setTextViewText(R.id.widget_status, "Sign in to view");
            views.setViewVisibility(R.id.widget_status, View.VISIBLE);
            views.setTextViewText(R.id.widget_calories_remaining, "—");
            views.setTextViewText(R.id.widget_calories_pct, "");
            views.setTextViewText(R.id.widget_protein, "— / —g");
            views.setTextViewText(R.id.widget_carbs, "— / —g");
            views.setTextViewText(R.id.widget_fat, "— / —g");
            views.setProgressBar(R.id.widget_calories_progress, 100, 0, false);
        } else {
            views.setViewVisibility(R.id.widget_status, View.GONE);
            views.setTextViewText(R.id.widget_calories_remaining, String.valueOf(data.caloriesRemaining));

            int pct = data.caloriesTarget > 0
                    ? Math.min(100, Math.round(((float) data.caloriesFood / data.caloriesTarget) * 100))
                    : 0;
            views.setTextViewText(R.id.widget_calories_pct, data.caloriesFood + " / " + data.caloriesTarget + " kcal");
            views.setProgressBar(R.id.widget_calories_progress, 100, pct, false);

            views.setTextViewText(R.id.widget_protein, data.proteinGrams + " / " + data.proteinTarget + "g");
            views.setTextViewText(R.id.widget_carbs, data.carbsGrams + " / " + data.carbsTarget + "g");
            views.setTextViewText(R.id.widget_fat, data.fatGrams + " / " + data.fatTarget + "g");
        }

        mgr.updateAppWidget(widgetId, views);
    }

    private NutritionData fetchData(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(
                WidgetDataPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String cookie = prefs.getString(WidgetDataPlugin.KEY_COOKIE, null);
        if (cookie == null || cookie.isEmpty()) return null;

        HttpURLConnection conn = null;
        try {
            URL url = new URL(API_URL);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Cookie", cookie);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(10_000);

            int code = conn.getResponseCode();
            if (code != 200) return null;

            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            reader.close();

            JSONObject json = new JSONObject(sb.toString());
            NutritionData data = new NutritionData();
            data.caloriesFood = json.optInt("caloriesFood", 0);
            data.caloriesTarget = json.optInt("caloriesTarget", 2000);
            data.caloriesRemaining = json.optInt("caloriesRemaining", 2000);
            data.proteinGrams = json.optInt("proteinGrams", 0);
            data.proteinTarget = json.optInt("proteinTarget", 125);
            data.carbsGrams = json.optInt("carbsGrams", 0);
            data.carbsTarget = json.optInt("carbsTarget", 250);
            data.fatGrams = json.optInt("fatGrams", 0);
            data.fatTarget = json.optInt("fatTarget", 56);
            return data;
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    static class NutritionData {
        int caloriesFood;
        int caloriesTarget;
        int caloriesRemaining;
        int proteinGrams;
        int proteinTarget;
        int carbsGrams;
        int carbsTarget;
        int fatGrams;
        int fatTarget;
    }
}
