import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary" />
          <span className="text-xl font-bold text-primary">Spark & Clean</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <Link href="/book/rug" className="hover:text-primary transition-colors">Book Now</Link>
          <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
          <Link href="/tech" className="hover:text-primary transition-colors">Technician</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/book/rug">
            <Button>Book a Collection</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
