import { randomUUID } from "node:crypto";
import { PostgresDurableWorkerAdapter } from "./postgres-adapter";
import { SqliteDurableWorkerAdapter } from "./sqlite-adapter";
import { reconciler, workerTick } from "./worker";

const workerId = process.env.OUTBOUND_WORKER_ID ?? `worker-${randomUUID()}`;

const adapter = (() => {
  const store = process.env.OUTBOUND_STORE ?? "sqlite";
  if (store === "postgres") {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required when OUTBOUND_STORE=postgres");
    return new PostgresDurableWorkerAdapter(databaseUrl);
  }
  return new SqliteDurableWorkerAdapter(process.env.OUTBOUND_SQLITE_PATH);
})();

async function loop() {
  const now = new Date().toISOString();
  await reconciler(adapter, now);
  const result = await workerTick(adapter, workerId);
  if (result.status !== "IDLE") {
    console.log("[outbound.worker]", result);
  }
}

setInterval(() => {
  loop().catch((err) => console.error("[outbound.worker.error]", err));
}, 1500);

loop().catch((err) => {
  console.error("[outbound.worker.fatal]", err);
  process.exit(1);
});
