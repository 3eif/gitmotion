import redis from "@/lib/redis.ts";

export const revalidate = 43200; // 12 hours in seconds

export default async function VisualizationsCount() {
  const count = await redis.get("generations");

  return (
    <div className="font-normal text-sm text-neutral-300 px-4 py-2 rounded-full border border-blue-500/30 bg-gradient-to-b from-blue-400/10 to-blue-900/10 inline-block">
      <strong>{count}</strong> visualizations generated and counting
    </div>
  );
}
