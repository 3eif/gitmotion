import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import redis from "@/lib/redis.ts";
import crypto from "crypto";
import { GourceSettings } from "@/components/gource-input";

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW = 60 * 60;

function encryptToken(token: string): string {
  const algorithm = "aes-256-ctr";
  const iv = crypto.randomBytes(16);

  if (!process.env.SECRET_KEY) {
    throw new Error("SECRET_KEY environment variable is not set");
  }

  const key = crypto
    .createHash("sha256")
    .update(String(process.env.SECRET_KEY))
    .digest();

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(token), cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

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

async function sendRequestToRustServer(
  repo_url: string,
  access_token?: string,
  settings?: GourceSettings
) {
  const body: any = { repo_url };

  if (access_token) {
    body.access_token = access_token;
  }

  if (settings) {
    body.settings = settings;
  }

  console.log("Sending request to Rust server:", body);
  console.log(`${process.env.API_URL}/start-gource`);
  const response = await fetch(`${process.env.API_URL}/start-gource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HTTP error! status: ${response.status}, message: ${errorText}`
    );
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  // try {
  //   const ip = request.headers.get("x-forwarded-for") || "unknown";

  //   const { success, limit, reset, remaining } = await checkRateLimit(ip);

  //   if (!success) {
  //     console.log("Rate limit exceeded");
  //     return NextResponse.json(
  //       {
  //         error:
  //           "You've generated too many requests for the day. Try again in a few hours. Send me an email at seifaziz10@gmail.com if you would pay for a higher rate limit.",
  //       },
  //       {
  //         status: 429,
  //         headers: {
  //           "X-RateLimit-Limit": limit.toString(),
  //           "X-RateLimit-Remaining": remaining.toString(),
  //           "X-RateLimit-Reset": reset.toString(),
  //         },
  //       }
  //     );
  //   }

  const { repo_url, access_token, settings } = await request.json();

  let encryptedToken;
  if (access_token) {
    encryptedToken = encryptToken(access_token);
  }

  const count = await redis.get("generations");
  await redis.set("generations", Number(count) + 1);

  const data = await sendRequestToRustServer(
    repo_url,
    encryptedToken,
    settings
  );
  return NextResponse.json(data);
  // } catch (error) {
  //   console.error("Error starting Gource job:", error);
  //   return NextResponse.json(
  //     { error: "Failed to start Gource job" },
  //     { status: 500 }
  //   );
  // }
}
