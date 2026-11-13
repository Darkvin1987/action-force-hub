
import { runHistoricalSync } from "./lib/sync-cuckoo-sales-history.mjs";

runHistoricalSync(6).catch((error) => {
  console.error("6-month CUCKOO historical sync failed:", error);
  process.exitCode = 1;
});
