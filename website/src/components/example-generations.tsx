const VideoItem = ({
  src,
  poster,
  title,
  repoUrl,
  commits,
}: {
  src: string;
  poster: string;
  title: string;
  repoUrl: string;
  commits: string;
}) => (
  <div className="flex flex-col">
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
    <div className="mt-3 flex justify-between items-center">
      <a
        href={repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-transparent bg-clip-text bg-gradient-to-t from-blue-400 to-blue-600 hover:from-blue-300 hover:to-blue-500 transition-all duration-300"
      >
        {title}
      </a>
      <span className="text-sm text-gray-400">{commits} commits</span>
    </div>
  </div>
);

const videos = [
  {
    src: "/gource.mp4",
    poster: "/video-placeholder.jpg",
    title: "facebook/react",
    repoUrl: "https://github.com/facebook/react",
    commits: "19,000+",
  },
  {
    src: "/gource.mp4",
    poster: "/video-placeholder.jpg",
    title: "apple/swift",
    repoUrl: "https://github.com/apple/swift",
    commits: "170,000+",
  },
];

export default function ExampleGenerations() {
  return (
    <div className="flex flex-col mx-auto w-full pt-10 space-y-8">
      <h2 className="text-2xl font-semibold text-left mt-10">
        Example Generations
      </h2>
      <div className="grid grid-cols-2 gap-8 w-full">
        {videos.map((video, index) => (
          <VideoItem key={index} {...video} />
        ))}
      </div>
    </div>
  );
}
