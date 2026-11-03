package ua.kodik.python;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.ValueCallback;
import java.io.OutputStream;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/web/index.html";
    private WebView webView;
    private static final int OPEN_FILES = 501, SAVE_FILE = 502;
    private ValueCallback<Uri[]> fileCallback;
    private volatile byte[] pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(8,17,31));
        getWindow().setNavigationBarColor(Color.rgb(8,17,31));
        // Keep the page above system bars on Android 15+.
        android.widget.FrameLayout container = new android.widget.FrameLayout(this);
        container.setBackgroundColor(Color.rgb(8,17,31));
        container.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(container);
        PackageInfo engine = WebView.getCurrentWebViewPackage();
        if (engine == null || majorVersion(engine.versionName) < 112) {
            new AlertDialog.Builder(this).setTitle("Онови Android System WebView")
                .setMessage("Для запуску Python потрібен Android System WebView версії 112 або новішої. Онови його або Google Chrome через Google Play, потім відкрий Кодик знову.")
                .setPositiveButton("Відкрити Google Play", (dialog, which) -> {
                    String id = engine == null ? "com.google.android.webview" : engine.packageName;
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + id)));
                    finish();
                }).setNegativeButton("Закрити", (dialog, which) -> finish())
                .setCancelable(false).show();
            return;
        }
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(8,17,31));
        container.addView(webView, new android.widget.FrameLayout.LayoutParams(-1,-1));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, OPEN_FILES); }
                catch (RuntimeException error) {
                    fileCallback.onReceiveValue(null); fileCallback = null;
                    Toast.makeText(MainActivity.this, "Не вдалося відкрити вибір файлів", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
        webView.addJavascriptInterface(new ShareBridge(), "KodikAndroid");
        WebViewAssetLoader.AssetsPathHandler assets = new WebViewAssetLoader.AssetsPathHandler(this);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder().addPathHandler("/assets/", path -> {
            WebResourceResponse response = assets.handle(path);
            if (response != null && path.endsWith(".wasm")) response.setMimeType("application/wasm");
            return response;
        }).build();
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) {
                    WebResourceResponse response = loader.shouldInterceptRequest(uri);
                    if (response != null) return response;
                }
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
                        Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // The native bridge is only available to the bundled application.
                return !START.equals(request.getUrl().toString());
            }
        });
        webView.loadUrl(START);
    }

    private static int majorVersion(String version) {
        try { return Integer.parseInt(version.split("\\.")[0]); }
        catch (RuntimeException exception) { return 0; }
    }

    private final class ShareBridge {

        @JavascriptInterface public synchronized boolean saveFile(String filename, String encoded, String mime) {
            if (pendingExport != null || filename == null || encoded == null || encoded.length() > 28 * 1024 * 1024) return false;
            try {
                String name = new File(filename).getName().replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
                if (name.isEmpty() || name.equals(".") || name.equals("..")) return false;
                byte[] data = Base64.decode(encoded, Base64.DEFAULT);
                pendingExport = data;
                String type = "application/json".equals(mime) ? "application/json" : "text/plain".equals(mime) ? "text/plain" : "application/octet-stream";
                runOnUiThread(() -> {
                    try {
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type);
                        intent.putExtra(Intent.EXTRA_TITLE, name);
                        startActivityForResult(intent, SAVE_FILE);
                    } catch (RuntimeException error) {
                        pendingExport = null; notifySave(false, false);
                    }
                });
                return true;
            } catch (RuntimeException error) { pendingExport = null; return false; }
        }
        @JavascriptInterface public boolean sharePng(String encoded) {
            if (encoded == null || encoded.length() > 28 * 1024 * 1024) return false;
            try {
                byte[] image = Base64.decode(encoded, Base64.DEFAULT);
                byte[] signature = {(byte)137,80,78,71,13,10,26,10};
                if (image.length < signature.length) return false;
                for (int i=0; i<signature.length; i++) if (image[i] != signature[i]) return false;
                File directory = new File(getCacheDir(), "shared");
                if (!directory.isDirectory() && !directory.mkdirs()) return false;
                // A unique file keeps an earlier share valid while a new one is created.
                File file = File.createTempFile("kodik-", ".png", directory);
                try (FileOutputStream output = new FileOutputStream(file)) { output.write(image); }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName()+".files", file);
                runOnUiThread(() -> {
                    try {
                        Intent intent = new Intent(Intent.ACTION_SEND).setType("image/png");
                        intent.putExtra(Intent.EXTRA_STREAM, uri);
                        intent.setClipData(ClipData.newRawUri("Кодик", uri));
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(intent, "Поділитись кодом і виконанням"));
                    } catch (RuntimeException exception) {
                        Toast.makeText(MainActivity.this, "Не вдалося відкрити меню поширення", Toast.LENGTH_LONG).show();
                    }
                });
                return true;
            } catch (Exception exception) { return false; }
        }
    }


    private void notifySave(boolean ok, boolean cancelled) {
        runOnUiThread(() -> {
            if (webView == null || isDestroyed()) return;
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('kodik-native-save',{detail:{ok:" + ok + ",cancelled:" + cancelled + "}}))", null);
        });
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_FILES) {
            if (fileCallback == null) return;
            java.util.ArrayList<Uri> uris = new java.util.ArrayList<>();
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    for (int i=0;i<data.getClipData().getItemCount();i++) {
                        Uri uri = data.getClipData().getItemAt(i).getUri();
                        if ("content".equals(uri.getScheme())) uris.add(uri);
                    }
                } else if (data.getData() != null && "content".equals(data.getData().getScheme())) uris.add(data.getData());
            }
            fileCallback.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0]));
            fileCallback = null;
        }
        if (request == SAVE_FILE) {
            byte[] bytes = pendingExport; pendingExport = null;
            if (result != RESULT_OK || data == null || data.getData() == null) { notifySave(false, true); return; }
            if (bytes == null) { notifySave(false, false); return; }
            Uri uri = data.getData();
            new Thread(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) throw new java.io.IOException("No stream");
                    output.write(bytes); notifySave(true, false);
                } catch (Exception error) { notifySave(false, false); }
            }, "kodik-export").start();
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        pendingExport = null;
        if (webView != null) {
            webView.removeJavascriptInterface("KodikAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }
}
