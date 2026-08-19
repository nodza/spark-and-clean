import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="https://www.sparkandclean.co.za/wp-content/uploads/2017/10/spark-and-clean-22.png" 
            alt="Spark & Clean" 
            className="h-10 w-auto"
          />
        </Link>
        
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <Link href="/services/automatic-rug-cleaning" className="hover:text-primary transition-colors">Services</Link>
          <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
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
