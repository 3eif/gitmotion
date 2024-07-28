export default function ExampleGenerations() {
  return (
    <div className="flex flex-col mx-auto w-full pt-10 space-y-5">
      <h2 className="text-2xl font-semibold text-left mt-10">
        Example Generations
      </h2>
      {/* 2x2 grid of videos */}
      <div className="grid grid-cols-2 gap-5 w-full">
        <div className="relative w-full h-full">
          <video
            className="w-full h-full object-cover aspect-video rounded-xl p-2 border-[1.5px] border-white/10 bg-transparent"
            controls
            muted
            playsInline
            preload="metadata"
            poster="/video-placeholder.jpg"
          >
            <source src="/gource.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="relative w-full h-full">
          <video
            className="w-full h-full object-cover aspect-video rounded-xl p-2 border-[1.5px] border-white/10 bg-transparent"
            controls
            muted
            playsInline
            preload="metadata"
            poster="/video-placeholder.jpg"
          >
            <source src="/gource.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="relative w-full h-full">
          <video
            className="w-full h-full object-cover aspect-video rounded-xl p-2 border-[1.5px] border-white/10 bg-transparent"
            controls
            muted
            playsInline
            preload="metadata"
            poster="/video-placeholder.jpg"
          >
            <source src="/gource.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="relative w-full h-full">
          <video
            className="w-full h-full object-cover aspect-video rounded-xl p-2 border-[1.5px] border-white/10 bg-transparent"
            controls
            muted
            playsInline
            preload="metadata"
            poster="/video-placeholder.jpg"
          >
            <source src="/gource.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </div>
  );
}
