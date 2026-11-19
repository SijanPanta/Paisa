package com.bespoke.paisa;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

final class FileFlowController extends WebChromeClient {

    private static final int RC_FILE_CHOOSER = 1001;
    private static final int RC_CREATE_DOCUMENT = 1002;

    private final Activity activity;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String pendingSaveContent;

    FileFlowController(Activity activity) {
        this.activity = activity;
    }

    @Override
    public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (fileChooserCallback != null) {
            // A previous picker was still pending; clear it.
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        fileChooserCallback = callback;
        try {
            activity.startActivityForResult(params.createIntent(), RC_FILE_CHOOSER);
            return true;
        } catch (Exception e) {
            fileChooserCallback = null;
            return false;
        }
    }

    void saveFile(final String fileName, final String mimeType, final String content) {
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "application/octet-stream");
                intent.putExtra(Intent.EXTRA_TITLE, fileName != null ? fileName : "backup.txt");
                pendingSaveContent = content;
                activity.startActivityForResult(intent, RC_CREATE_DOCUMENT);
            } catch (Exception e) {
                pendingSaveContent = null;
                Toast.makeText(activity, "No file manager found to save the file", Toast.LENGTH_SHORT).show();
            }
        });
    }

    boolean onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == RC_FILE_CHOOSER) {
            if (fileChooserCallback != null) {
                fileChooserCallback.onReceiveValue(FileChooserParams.parseResult(resultCode, data));
                fileChooserCallback = null;
            }
        } else if (requestCode == RC_CREATE_DOCUMENT) {
            String content = pendingSaveContent;
            pendingSaveContent = null;
            Uri uri = (data != null) ? data.getData() : null;
            if (resultCode == Activity.RESULT_OK && uri != null && content != null) {
                try (OutputStream os = activity.getContentResolver().openOutputStream(uri)) {
                    if (os != null) {
                        os.write(content.getBytes(StandardCharsets.UTF_8));
                        os.flush();
                        Toast.makeText(activity, "Backup saved", Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(activity, "Failed to save file", Toast.LENGTH_SHORT).show();
                    }
                } catch (IOException e) {
                    Toast.makeText(activity, "Failed to save file", Toast.LENGTH_SHORT).show();
                }
            }
        } else {
            return false;
        }
        return true;
    }
}
