"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Upload, Camera } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: "bot", text: "Hi there! 👋 I'm your AI assistant. I can help you get an instant quote by analyzing a photo of your rug!" }
  ]);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  const quickReplies = [
    "📸 Get AI Quote (Upload Photo)",
    "📍 Check service areas",
    "💰 Manual quote",
    "📞 Speak to someone"
  ];

  const handleQuickReply = (reply: string) => {
    setMessages([...messages, { type: "user", text: reply }]);
    
    if (reply.includes("Upload Photo")) {
      setShowPhotoUpload(true);
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          type: "bot", 
          text: "Great! Upload a photo of your rug and I'll analyze it using AI to give you an instant quote. I can detect the material, size, and any stains or damage." 
        }]);
      }, 500);
    } else if (reply.includes("service areas")) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          type: "bot", 
          text: "We currently serve Cape Town and Johannesburg! In Cape Town: City Bowl, Atlantic Seaboard, and more. In JHB: Sandton, Rosebank, Fourways, etc. What area are you in?" 
        }]);
      }, 800);
    } else if (reply.includes("Manual quote")) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          type: "bot", 
          text: "I'd love to help! What's the size of your rug? (e.g., 2m x 3m) And what type is it? (Persian, Shaggy, Modern, etc.)" 
        }]);
      }, 800);
    } else {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          type: "bot", 
          text: "I'm connecting you to our team now. You can also call us at CPT: 021 555 0123 or JHB: 011 555 0456" 
        }]);
      }, 800);
    }
  };

  const handlePhotoUpload = () => {
    setShowPhotoUpload(false);
    setMessages(prev => [...prev, { 
      type: "user", 
      text: "📷 [Photo uploaded: persian_rug.jpg]" 
    }]);

    // Simulate AI analysis
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        type: "bot", 
        text: "🤖 Analyzing your rug with AI..." 
      }]);
    }, 500);

    setTimeout(() => {
      setMessages(prev => [...prev, { 
        type: "bot", 
        text: "✨ **AI Analysis Complete!**\n\n📐 Detected Size: ~2.8m x 3.5m (9.8 m²)\n🧵 Material: Persian wool\n🎨 Condition: Good (minor stains detected)\n💧 Recommended: Deep clean + stain treatment\n\n💰 **Estimated Price: R1,150 - R1,350**\n\nWould you like to book this cleaning?" 
      }]);
    }, 2500);

    setTimeout(() => {
      setMessages(prev => [...prev, { 
        type: "bot", 
        text: "I can also see some wear on the fringes. We offer fringe whitening for an additional R150. Interested?" 
      }]);
    }, 4000);
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
                <h3 className="font-bold">Spark & Clean AI</h3>
                <p className="text-xs opacity-90">Powered by AI Vision</p>
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
                  <p className="text-sm whitespace-pre-line">{msg.text}</p>
                </div>
              </div>
            ))}
            
            {/* Photo Upload Section */}
            {showPhotoUpload && (
              <div className="bg-accent/10 border-2 border-dashed border-accent rounded-xl p-6 text-center">
                <Camera className="h-12 w-12 mx-auto mb-3 text-accent" />
                <p className="text-sm font-semibold mb-2">Upload Rug Photo</p>
                <p className="text-xs text-muted-foreground mb-4">AI will analyze material, size & condition</p>
                <Button 
                  className="w-full bg-accent hover:bg-accent/90"
                  onClick={handlePhotoUpload}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Photo
                </Button>
              </div>
            )}
            
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
              🤖 Powered by Spark & Clean AI Vision
            </p>
          </div>
        </Card>
      )}

      {/* FAB Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="h-14 w-14 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground relative"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <>
              <MessageCircle className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                AI
              </span>
            </>
          )}
        </Button>
      </div>
    </>
  );
}
