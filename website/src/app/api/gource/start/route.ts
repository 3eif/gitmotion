import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import redis from "@/lib/redis.ts";
import crypto from "crypto";

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW = 60 * 60;

function encryptToken(token: string): string {
  const algorithm = "aes-256-ctr";
  const iv = crypto.randomBytes(16);

  if (!process.env.SECRET_KEY) {
    throw new Error("SECRET_KEY environment variable is not set");
  }

  // Use the full SECRET_KEY to derive a 32-byte key
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
  access_token?: string
) {
  const body = access_token ? { repo_url, access_token } : { repo_url };

  console.log("Sending request to Rust server:", access_token);

  const response = await fetch(`${process.env.API_URL}/start-gource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
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

  const { repo_url, access_token } = await request.json();

  let encryptedToken;
  if (access_token) {
    encryptedToken = encryptToken(access_token);
    console.log("Encrypted Token:", encryptedToken);
  }

  console.log("Sending request to Rust server:", repo_url);

  const data = await sendRequestToRustServer(repo_url, encryptedToken);
  console.log("Received response from Rust server:", data);

  return NextResponse.json(data);
  // } catch (error) {
  //   console.error("Error starting Gource job:", error);
  //   return NextResponse.json(
  //     { error: "Failed to start Gource job" },
  //     { status: 500 }
  //   );
  // }
}
