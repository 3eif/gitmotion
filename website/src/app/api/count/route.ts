import redis from "@/lib/redis.ts";

export async function GET() {
  const count = await redis.get("generations");
  return new Response(count !== null ? count : "0");
}
