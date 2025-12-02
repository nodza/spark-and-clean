"use client";

import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export function ChatFAB() {
  const handleClick = () => {
    alert("Chat Modal Mockup: 'Hi! How can we help you today?'");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button 
        size="lg" 
        className="h-14 w-14 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground"
        onClick={handleClick}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
