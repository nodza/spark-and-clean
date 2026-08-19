const VIDEOS = [
  {
    id: "qUVPTkcM_3Q",
    title: "Cleaning some dirty handmade Persian Chobi rugs ASMR video",
    src: "https://www.youtube.com/embed/qUVPTkcM_3Q",
  },
  {
    id: "YbVHc_YVz2o",
    title: "Spark & Clean - Cleaning Services",
    src: "https://www.youtube.com/embed/YbVHc_YVz2o",
  },
] as const;

export function PromoVideos() {
  return (
    <section
      className="border-t border-border/60 bg-secondary/10 py-16 sm:py-20 lg:py-24"
      aria-labelledby="promo-videos-heading"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <h2
            id="promo-videos-heading"
            className="mb-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl"
          >
            See Our Process in Action
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Watch our ASMR rug cleaning process and services
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          {VIDEOS.map((video) => (
            <figure key={video.id} className="flex flex-col gap-3">
              <div className="relative aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted shadow-sm">
                <iframe
                  src={video.src}
                  title={video.title}
                  className="absolute inset-0 h-full w-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              <figcaption className="px-1 text-center text-sm leading-snug text-muted-foreground sm:text-base">
                {video.title}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
