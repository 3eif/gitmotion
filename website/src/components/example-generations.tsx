const VideoItem = ({
  src,
  poster,
  title,
  repoUrl,
}: {
  src: string;
  poster: string;
  title: string;
  repoUrl: string;
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
      <h3 className="font-medium">{title}</h3>
      <a
        href={repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 transition-colors"
      >
        View Repo
      </a>
    </div>
  </div>
);

const videos = [
  {
    src: "/gource.mp4",
    poster: "/video-placeholder.jpg",
    title: "React Repository",
    repoUrl: "https://github.com/facebook/react",
  },
  {
    src: "/gource.mp4",
    poster: "/video-placeholder.jpg",
    title: "Vue.js Project",
    repoUrl: "https://github.com/vuejs/vue",
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
