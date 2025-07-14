import { RateLimiterPrisma } from "rate-limiter-flexible";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function getUsageTracker() {
  const { has } = await auth();
  const hasProAccess = has({
    plan: "pro",
  });
  const usageTracker = new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "Usage",
    points: hasProAccess ? 100 : 1,
    duration: 30 * 24 * 60 * 60,
  });

  return usageTracker;
}

export async function consumeCredits() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  const usageTracker = getUsageTracker();
  const result = (await usageTracker).consume(userId, 1);
  return result;
}

export async function getUsageStatus() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  const usageTracker = await getUsageTracker();
  const res = await usageTracker.get(userId);

  return res;
}
