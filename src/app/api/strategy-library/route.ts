import { NextResponse } from "next/server";
import {
  getStrategyLibrary,
  replaceStrategyLibrary,
} from "@/infrastructure/aws/s3-strategy-library-repository";
import { parseStrategyLibrary } from "@/features/strategy-library/validation";

export async function GET() {
  try {
    return NextResponse.json({ library: await getStrategyLibrary() });
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
  const body = (await request.json().catch(() => null)) as { library?: unknown } | null;
  let library;

  try {
    library = parseStrategyLibrary(body?.library);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid strategy library." },
      { status: 400 },
    );
  }

  try {
    await replaceStrategyLibrary(library);
    return NextResponse.json({ library });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save strategy library." },
      { status: 500 },
    );
  }
}
