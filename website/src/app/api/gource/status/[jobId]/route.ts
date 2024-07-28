import { NextRequest, NextResponse } from "next/server";

const RUST_SERVER_URL = "http://localhost:8081";

// Interface for the job status
interface JobStatus {
  status: string;
  progress: number;
  video_url: string | null;
  error: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    console.log("Fetching status for job:", jobId);

    const response = await fetch(`${RUST_SERVER_URL}/job-status/${jobId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: JobStatus = await response.json();
    console.log("Received status from Rust server:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}
