import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, signalsTable } from "@gr2/shared";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Fetch latest signals, sorted by detection time descending
    const signals = await signalsTable
      .find()
      .sort({ detectedAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json(signals);
  } catch (error) {
    console.error("Error fetching signals:", error);
    return NextResponse.json(
      { error: "Failed to fetch signals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      tokenAddress,
      sources,
      sentimentType,
      suggestionType,
      confidence,
      rationaleSummary,
      expiresAt,
    } = body;

    if (
      !tokenAddress ||
      !sources ||
      !sentimentType ||
      !suggestionType ||
      confidence === undefined ||
      !rationaleSummary ||
      !expiresAt
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: tokenAddress, sources, sentimentType, suggestionType, confidence, rationaleSummary, expiresAt",
        },
        { status: 400 }
      );
    }

    const signal = new signalsTable({
      tokenAddress,
      sources,
      sentimentType,
      suggestionType,
      confidence,
      rationaleSummary,
      expiresAt,
    });

    await signal.save();

    return NextResponse.json(signal, { status: 201 });
  } catch (error) {
    console.error("Error creating signal:", error);
    return NextResponse.json(
      { error: "Failed to create signal" },
      { status: 500 }
    );
  }
}
