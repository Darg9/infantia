import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  // Analisis del ultimo dia (24 hours window)
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const events = await prisma.event.groupBy({
      by: ["type"],
      _count: true,
      where: {
        createdAt: {
          gte: last24h
        }
      }
    });

    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
