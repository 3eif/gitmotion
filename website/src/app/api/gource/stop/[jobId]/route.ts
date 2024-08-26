import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const jobId = params.jobId;

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${process.env.API_URL}/stop/${jobId}`,
      {
        method: "GET",
      }
    );
    console.log("STOPPING JOB", response);

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to stop job" },
        { status: response.status }
      );
    }
    console.log("Response:", response);
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error stopping job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
