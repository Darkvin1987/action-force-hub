
import { runHistoricalSync } from "./lib/sync-cuckoo-sales-history.mjs";

runHistoricalSync(2).catch((error) => {
  console.error("2-month CUCKOO historical sync failed:", error);
  process.exitCode = 1;
});
