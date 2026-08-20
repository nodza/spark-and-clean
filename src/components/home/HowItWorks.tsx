import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    step: 1,
    title: "Find Your Rug's Measurements",
    description:
      "Simply check the label on the back of your rug for its size, or measure the length and width (the long and shorter sides).",
    image:
      "https://www.sparkandclean.co.za/wp-content/uploads/2025/08/spark-and-clean-booking1-2.png",
    alt: "Find your rug's measurements",
  },
  {
    step: 2,
    title: "Send Them to Us",
    description:
      "Contact us with the measurements by sending a quick message on WhatsApp or by filling out our online booking form.",
    image:
      "https://www.sparkandclean.co.za/wp-content/uploads/2025/08/Untitled-3-copy.png",
    alt: "Send rug measurements to Spark and Clean",
  },
  {
    step: 3,
    title: "We'll Handle the Rest",
    description:
      "A member of our team will promptly get back to you with your personalised quote and arrange a convenient day for collection, or provide you with directions to our nearest branch for an easy drop-off.",
    image:
      "https://www.sparkandclean.co.za/wp-content/uploads/2025/08/spark-and-clean-booking3-1.png",
    alt: "Collection or drop-off arranged for your rug",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      className="bg-background py-16 sm:py-20 lg:py-24"
      aria-labelledby="how-it-works-heading"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <h2
            id="how-it-works-heading"
            className="mb-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl"
          >
            Booking is as easy as 1-2-3
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Measurements → Submission → Collection / Drop-off
          </p>
        </div>

        <ol className="grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-8">
          {STEPS.map((item) => (
            <li key={item.step} className="flex h-full flex-col text-center">
              <div className="relative mb-6 aspect-[4/3] w-full overflow-hidden rounded-xl bg-secondary/15">
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  className="object-contain p-3 sm:p-4"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  priority={item.step === 1}
                />
              </div>

              <div
                className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                aria-hidden="true"
              >
                {item.step}
              </div>

              <h3 className="mb-3 text-lg font-semibold text-primary sm:text-xl text-balance">
                {item.title}
              </h3>

              <p className="flex-1 text-sm leading-relaxed text-muted-foreground sm:text-base text-pretty">
                {item.description}
              </p>

              {item.step === 3 && (
                <div className="mt-6 md:mt-8">
                  <Button
                    asChild
                    size="lg"
                    className="min-h-12 w-full px-8 text-base font-semibold sm:w-auto"
                  >
                    <Link href="/book/rug">
                      Book Online Now
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
