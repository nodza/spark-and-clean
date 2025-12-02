"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: "bot", text: "Hi there! 👋 I'm here to help. How can I assist you today?" }
  ]);

  const quickReplies = [
    "📅 Book a collection",
    "📍 Check service areas",
    "💰 Get a quote",
    "📞 Speak to someone"
  ];

  const handleQuickReply = (reply: string) => {
    setMessages([...messages, { type: "user", text: reply }]);
    
    // Mock bot responses
    setTimeout(() => {
      let botResponse = "";
      if (reply.includes("Book")) {
        botResponse = "Great! I can help you book a collection. Click the button below to get started, or tell me your rug size and I'll give you an instant quote!";
      } else if (reply.includes("service areas")) {
        botResponse = "We currently serve Cape Town and Johannesburg! In Cape Town: City Bowl, Atlantic Seaboard, and more. In JHB: Sandton, Rosebank, Fourways, etc. What area are you in?";
      } else if (reply.includes("quote")) {
        botResponse = "I'd love to help! A typical Persian rug (2m x 3m) costs around R950-R1200. What's your rug size?";
      } else {
        botResponse = "I'm connecting you to our team now. You can also call us at CPT: 021 555 0123 or JHB: 011 555 0456";
      }
      setMessages(prev => [...prev, { type: "bot", text: botResponse }]);
    }, 800);
  };

  return (
    <>
      {/* Chat Modal */}
      {isOpen && (
        <Card className="fixed bottom-24 py-0 right-6 w-96 h-[500px] shadow-2xl z-50 flex flex-col">
          <CardHeader className="bg-primary text-primary-foreground p-4 rounded-t-lg flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-bold">Spark & Clean</h3>
                <p className="text-xs opacity-90">Typically replies instantly</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.type === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-white border shadow-sm"
                }`}>
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
            
            {/* Quick Replies */}
            {messages.length === 1 && (
              <div className="space-y-2 pt-2">
                {quickReplies.map((reply, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => handleQuickReply(reply)}
                  >
                    {reply}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>

          <div className="p-4 border-t bg-white rounded-b-lg">
            <div className="flex gap-2">
              <Input placeholder="Type your message..." className="flex-1" />
              <Button size="icon" className="bg-accent hover:bg-accent/90">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Powered by Spark & Clean AI
            </p>
          </div>
        </Card>
      )}

      {/* FAB Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="h-14 w-14 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </Button>
      </div>
    </>
  );
}
