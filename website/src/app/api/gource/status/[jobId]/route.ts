import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    console.log("Fetching status for job:", jobId);

    const response = await fetch(`${process.env.API_URL}/job-status/${jobId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received status from Rust server:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching job status:", error);
    if (error instanceof Error && error.message.includes("404")) {
      return NextResponse.json(
        {
          message:
            "Job not found. The video you're looking for most likely expired.",
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}
