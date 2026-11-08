
import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "action-force-hub",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-08",
    compatibilityFlags: ["nodejs_compat"],

    // Enable the temporary workers.dev address.
    workersDev: true,

    // Keep version preview URLs disabled.
    previewUrls: false,

    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },

    env: {
      ASSETS: bindings.assets(),
      SUPABASE_SECRET_KEY: bindings.secret(),
      CUCKOO_API_BASE_URL: bindings.text(
        "https://mapi.cuckoo.com.my/SalesAPI"
      ),
      CUCKOO_API_APP_NAME: bindings.secret(),
      CUCKOO_API_KEY: bindings.secret(),

      // Vinext persistent cache
      VINEXT_KV_CACHE: bindings.kv(),
    },
  }),
});
