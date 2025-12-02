import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, MapPin, Star, Truck, Sparkles, Clock } from "lucide-react";
import { ChatFAB } from "@/components/ChatFAB";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/5 py-20 lg:py-32">
        <div className="container px-4 mx-auto text-center">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl mb-6 text-primary">
            Cape Town's First <br className="hidden sm:inline" />
            Tech-Enabled Rug Logistics
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the future of rug care. Real-time tracking, automated scheduling, 
            and expert cleaning for your treasured Persian, Kilim, and modern rugs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/book/rug">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8 h-12">
                Book a Rug Collection <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/booking/demo">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 h-12">
                View My Booking
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Booking is as easy as 1-2-3</h2>
            <p className="text-muted-foreground text-lg">Simple, transparent, and hassle-free.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Clock className="h-10 w-10 text-primary" />,
                title: "1. Find Your Measurements",
                desc: "Check the label on the back of your rug, or measure the length and width."
              },
              {
                icon: <Sparkles className="h-10 w-10 text-primary" />,
                title: "2. Send Them to Us",
                desc: "Enter your details and choose a convenient collection slot in our wizard."
              },
              {
                icon: <Truck className="h-10 w-10 text-primary" />,
                title: "3. We'll Handle the Rest",
                desc: "We'll collect, clean, dry, and deliver your fresh rug back to you."
              }
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl bg-secondary/20">
                <div className="mb-4 p-4 bg-white rounded-full shadow-sm">{step.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Tech-Enabled? */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container px-4 mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Why Tech-Enabled Cleaning?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Real-Time Tracking", desc: "Know exactly when your rug is collected, cleaned, and out for delivery." },
              { title: "Automated Scheduling", desc: "Book a slot that fits your life instantly. No back-and-forth calls." },
              { title: "Digital Quality Checks", desc: "Every rug is photographed and inspected digitally before and after cleaning." }
            ].map((item, i) => (
              <div key={i} className="bg-white/10 p-6 rounded-xl backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-2 text-accent">{item.title}</h3>
                <p className="opacity-90">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-secondary/10">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Our Specialist Services</h2>
            <p className="text-muted-foreground text-lg">Specialist care for every rug and fabric in your home.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-primary/20 shadow-md hover:shadow-lg transition-shadow cursor-pointer relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Rug Cleaning
                </CardTitle>
                <CardDescription>Persian, Shaggy, Wool & more</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Deep wash, stain removal, and fringe whitening.</p>
                <Link href="/book/rug">
                  <Button className="w-full">Book Now</Button>
                </Link>
              </CardContent>
            </Card>

            {[
              { title: "Upholstery", desc: "Couches, armchairs & dining chairs" },
              { title: "Mattresses", desc: "Deep clean & sanitation" },
              { title: "Tiles & Grout", desc: "High pressure cleaning" }
            ].map((service, i) => (
              <Card key={i} className="opacity-75 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                <CardHeader>
                  <CardTitle>{service.title}</CardTitle>
                  <CardDescription>Coming Soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{service.desc}</p>
                  <Button variant="secondary" disabled className="w-full">Waitlist</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof & Areas */}
      <section className="py-20 bg-white">
        <div className="container px-4 mx-auto grid lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl font-bold mb-8">Trusted by Cape Town</h2>
            <div className="space-y-6">
              {[
                { name: "Sarah J.", loc: "Durbanville", text: "My Persian rug looks brand new! The pickup and delivery was so convenient." },
                { name: "Mike R.", loc: "Sea Point", text: "Incredible service. The online booking made it super easy to schedule." }
              ].map((review, i) => (
                <div key={i} className="bg-secondary/10 p-6 rounded-xl">
                  <div className="flex gap-1 text-accent mb-2">
                    {[1, 2, 3, 4, 5].map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}
                  </div>
                  <p className="text-lg mb-4">"{review.text}"</p>
                  <div className="font-semibold text-sm text-muted-foreground">
                    — {review.name}, {review.loc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-8">Areas We Serve</h2>
            <div className="bg-secondary/20 p-8 rounded-2xl">
              <div className="grid grid-cols-2 gap-4">
                {[
                  "City Bowl", "Atlantic Seaboard", "Southern Suburbs", 
                  "Northern Suburbs", "Durbanville", "Blouberg", 
                  "Milnerton", "Century City"
                ].map((area) => (
                  <div key={area} className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>{area}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-8 border-t border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  <span>More areas coming soon!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Footer */}
      <footer className="bg-secondary/30 py-12 border-t">
        <div className="container px-4 mx-auto grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4 text-primary">Spark & Clean</h3>
            <p className="text-muted-foreground">
              Cape Town's premier tech-enabled rug cleaning service.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4 text-primary">Contact Us</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>📍 55 Somerset Road, Green Point</p>
              <p>📞 021 555 0123</p>
              <p>📧 hello@sparkandclean.co.za</p>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4 text-primary">Hours</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>Mon - Fri: 08:00 - 17:00</p>
              <p>Sat: 09:00 - 13:00</p>
              <p>Sun: Closed</p>
            </div>
          </div>
        </div>
      </footer>

      {/* FAB Chat Widget */}
      <ChatFAB />
    </div>
  );
}
