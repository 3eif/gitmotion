const VideoItem = ({ src, poster }: { src: string; poster: string }) => (
  <div className="rounded-2xl border-[1.5px] border-white/10 bg-black overflow-hidden">
    <video
      className="w-full h-auto"
      controls
      muted
      playsInline
      preload="metadata"
      poster={poster}
    >
      <source src={src} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  </div>
);

const videos = [
  { src: "/gource.mp4", poster: "/video-placeholder.jpg" },
  { src: "/gource.mp4", poster: "/video-placeholder.jpg" },
  { src: "/gource.mp4", poster: "/video-placeholder.jpg" },
  { src: "/gource.mp4", poster: "/video-placeholder.jpg" },
];

export default function ExampleGenerations() {
  return (
    <div className="flex flex-col mx-auto w-full pt-10 space-y-5">
      <h2 className="text-2xl font-semibold text-left mt-10">
        Example Generations
      </h2>
      <div className="grid grid-cols-2 gap-5 w-full">
        {videos.map((video, index) => (
          <VideoItem key={index} {...video} />
        ))}
      </div>
    </div>
  );
}
