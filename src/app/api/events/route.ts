import { prisma } from "../../../lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, activityId, path, metadata } = body;

    if (!type) {
      return new Response("Missing type", { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    // Nota: Next.js edge route no expone client IP facilmente por default sin next/headers, pero guardamos path/agent.
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;

    await prisma.event.create({
      data: {
        type,
        activityId: activityId || null,
        path: path || null,
        metadata: metadata || null,
        userAgent,
        ip,
      }
    });

    return new Response(null, { status: 204 });

  } catch (error) {
    console.error("Tracking Error:", error);
    return new Response(null, { status: 500 });
  }
}
