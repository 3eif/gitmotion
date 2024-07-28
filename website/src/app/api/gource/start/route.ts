import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import redis from "@/lib/redis.ts";

const RUST_SERVER_URL = "http://localhost:8081";

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW = 60 * 60;

async function checkRateLimit(ip: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const key = `ratelimit:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RATE_LIMIT_WINDOW;

  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now, now.toString());
  multi.zrange(key, 0, -1);
  multi.expire(key, RATE_LIMIT_WINDOW);

  const results = await multi.exec();
  if (!results) {
    throw new Error("Failed to execute Redis commands");
  }

  const requests = (results[2][1] as string[]).length;
  const reset = Math.floor(results[3][1] as number);

  return {
    success: requests <= RATE_LIMIT,
    limit: RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - requests),
    reset,
  };
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    const { success, limit, reset, remaining } = await checkRateLimit(ip);

    if (!success) {
      console.log("Rate limit exceeded");
      return NextResponse.json(
        {
          error:
            "You've generated too many requests for the day. Try again in a few hours. Send me an email at seifaziz10@gmail.com if you would pay for a highher rate limit.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }

    const { repo_url } = await request.json();
    console.log("Sending request to Rust server:", repo_url);

    const response = await fetch(`${RUST_SERVER_URL}/start-gource`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received response from Rust server:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error starting Gource job:", error);
    return NextResponse.json(
      { error: "Failed to start Gource job" },
      { status: 500 }
    );
  }
}
