// app/api/gource/start/route.ts
import { NextRequest, NextResponse } from "next/server";

const RUST_SERVER_URL = "http://localhost:8081";

export async function POST(request: NextRequest) {
  try {
    const { repo_url } = await request.json();
    console.log("Sending request to Rust server:", repo_url);

    const response = await fetch(`${RUST_SERVER_URL}/start-gource`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received response from Rust server:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error starting Gource job:", error);
    return NextResponse.json(
      { error: "Failed to start Gource job" },
      { status: 500 }
    );
  }
}
