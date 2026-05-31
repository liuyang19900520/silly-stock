import { NextResponse } from "next/server";
import {
  getStrategyLibraryFromS3,
  replaceStrategyLibraryInS3,
} from "@/lib/strategy-library/s3";
import { StockFolder } from "@/lib/strategy-library/types";

export async function GET() {
  try {
    return NextResponse.json({ library: await getStrategyLibraryFromS3() });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load strategy library.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    library?: StockFolder[];
  } | null;

  if (!Array.isArray(body?.library)) {
    return NextResponse.json({ error: "library must be an array." }, { status: 400 });
  }

  try {
    await replaceStrategyLibraryInS3(body.library);
    return NextResponse.json({ library: body.library });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save strategy library.",
      },
      { status: 500 },
    );
  }
}
