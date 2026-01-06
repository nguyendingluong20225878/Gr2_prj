import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, logsTable } from "@gr2/shared";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Fetch last 50 logs, sorted by creation time descending
    const logs = await logsTable
      .find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json(logs.reverse()); // Reverse to show oldest first (like terminal)
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { step, message, status, metadata } = body;

    if (!step || !message || !status) {
      return NextResponse.json(
        { error: "Missing required fields: step, message, status" },
        { status: 400 }
      );
    }

    const log = new logsTable({
      step,
      message,
      status,
      metadata,
    });

    await log.save();

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating log:", error);
    return NextResponse.json(
      { error: "Failed to create log" },
      { status: 500 }
    );
  }
}
