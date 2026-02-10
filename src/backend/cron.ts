import { Cron } from "croner";
import { cleanupDownloads } from "./server.ts";
import { cleanupInactiveAgents } from "./agent.ts";

export function startCronJobs() {
  // Clean up old downloads every 15 minutes
  new Cron("*/15 * * * *", cleanupDownloads);
  cleanupDownloads();

  // Clean up inactive agents every 5 minutes
  new Cron("*/5 * * * *", cleanupInactiveAgents);
}
