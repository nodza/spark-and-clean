import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PromoVideos } from "@/components/home/PromoVideos";
import { ChatFAB } from "@/components/ChatFAB";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <HowItWorks />
      <PromoVideos />
      <ChatFAB />
    </div>
  );
}
