import { Redis } from "ioredis";

console.log("Connecting to Redis at:", process.env.REDIS_URL);
console.log("Redis password:", process.env.REDIS_PASSWORD);

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || "",
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

redis.on("connect", () => {
  console.log("Successfully connected to Redis");
});

export default redis;
