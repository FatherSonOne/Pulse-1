package io.qntmpulse.app;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure WebView to handle permission requests for camera/microphone
        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Auto-grant permissions for audio/video capture from our WebView
                // The actual Android runtime permissions are handled separately
                runOnUiThread(() -> {
                    request.grant(request.getResources());
                });
            }
        });
    }
}
