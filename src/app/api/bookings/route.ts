import { NextResponse } from "next/server";
import bookingsData from "@/data/bookings.json";

// Simulate DB delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  await delay(500);
  // In a real app, this would be: await db.collection('bookings').find({}).toArray();
  return NextResponse.json(bookingsData);
}

export async function POST(request: Request) {
  await delay(800);
  const body = await request.json();
  
  // In a real app: await db.collection('bookings').insertOne(body);
  // For now, we just echo it back with an ID if missing
  const newBooking = {
    ...body,
    id: body.id || `SC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json(newBooking);
}
