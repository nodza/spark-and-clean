"use client";

import { useBookingStore } from "@/store/useBookingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

export default function AdminAnalytics() {
  const router = useRouter();
  const { bookings, fetchBookings } = useBookingStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (bookings.length === 0) fetchBookings();
  }, [bookings.length, fetchBookings]);

  if (!mounted) return null;

  // Prepare Data
  const bookingsByArea = bookings.reduce((acc, b) => {
    acc[b.suburb] = (acc[b.suburb] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const areaData = Object.entries(bookingsByArea).map(([name, value]) => ({ name, value }));

  const bookingsByType = bookings.reduce((acc, b) => {
    acc[b.rug.type] = (acc[b.rug.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeData = Object.entries(bookingsByType).map(([name, value]) => ({ name, value }));

  // Revenue Trends (Last 30 Days)
  const getLast30Days = () => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const last30Days = getLast30Days();
  const revenueByDay = last30Days.map(day => {
    const dayBookings = bookings.filter(b => b.collectionDate === day);
    const revenue = dayBookings.reduce((sum, b) => sum + ((b.estimatedPriceMin + b.estimatedPriceMax) / 2), 0);
    return {
      date: new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.round(revenue)
    };
  });

  // Driver Performance
  const driverPerformance = bookings.reduce((acc, b) => {
    if (b.assignedDriverId) {
      if (!acc[b.assignedDriverId]) {
        acc[b.assignedDriverId] = { completed: 0, active: 0 };
      }
      if (b.status === "DELIVERED") {
        acc[b.assignedDriverId].completed++;
      } else {
        acc[b.assignedDriverId].active++;
      }
    }
    return acc;
  }, {} as Record<string, { completed: number; active: number }>);

  const driverData = Object.entries(driverPerformance).map(([id, stats]) => ({
    name: id === "driver_1" ? "Thabo" : "Sipho",
    completed: stats.completed,
    active: stats.active,
    total: stats.completed + stats.active
  }));

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  return (
    <div className="container mx-auto py-10 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>

      <h1 className="text-3xl font-bold mb-8">Analytics & Reports</h1>

      {/* Revenue Trends */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Revenue Trends (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `R${value}`} />
              <Line type="monotone" dataKey="revenue" stroke="#0088FE" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Bookings by Area</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={areaData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => {
                    const pct = typeof percent === "number" ? percent : 0;
                    return `${name} ${(pct * 100).toFixed(0)}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {areaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Popular Rug Types</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0088FE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Driver Performance */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Driver Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#00C49F" name="Completed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" fill="#FFBB28" name="Active" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-secondary/20 rounded-lg">
                <span className="font-medium">Total Revenue</span>
                <span className="text-2xl font-bold text-primary">
                  R{bookings.reduce((sum, b) => sum + ((b.estimatedPriceMin + b.estimatedPriceMax) / 2), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-secondary/20 rounded-lg">
                <span className="font-medium">Avg. Job Value</span>
                <span className="text-2xl font-bold text-primary">
                  R{Math.round(bookings.reduce((sum, b) => sum + ((b.estimatedPriceMin + b.estimatedPriceMax) / 2), 0) / bookings.length).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-secondary/20 rounded-lg">
                <span className="font-medium">Completion Rate</span>
                <span className="text-2xl font-bold text-primary">
                  {Math.round((bookings.filter(b => b.status === "DELIVERED").length / bookings.length) * 100)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
