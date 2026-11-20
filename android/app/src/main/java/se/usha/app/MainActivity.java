package se.usha.app;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Inloggningen bor i cookies i webbvyn. Android skriver dem till disk med
     * fördröjning, så en app som sveps bort strax efter inloggning tappade
     * sessionen. Spara dem varje gång appen lämnas.
     */
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
