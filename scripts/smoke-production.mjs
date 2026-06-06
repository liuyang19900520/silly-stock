const baseUrl = (process.env.APP_URL || "https://silly-stock.vercel.app").replace(/\/$/, "");
const crud = process.argv.includes("--crud");
const authUser = process.env.APP_BASIC_AUTH_USER;
const authPassword = process.env.APP_BASIC_AUTH_PASSWORD;
const authorization =
  authUser && authPassword
    ? `Basic ${Buffer.from(`${authUser}:${authPassword}`).toString("base64")}`
    : undefined;

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`${init?.method || "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return body;
}

const libraryResponse = await request("/api/strategy-library");
if (!Array.isArray(libraryResponse.library)) {
  throw new Error("Strategy library response does not contain a library array.");
}

const snapshot = await request("/api/stocks/JNJ/snapshot");
if (
  typeof snapshot.price !== "number" ||
  !("movingAverage100" in snapshot) ||
  !("movingAverage200" in snapshot)
) {
  throw new Error("Market snapshot is missing price or moving-average fields.");
}

if (crud) {
  await request("/api/strategy-library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ library: libraryResponse.library }),
  });
}

console.log(
  `Production smoke test passed for ${baseUrl}${crud ? " (including S3 write)" : ""}.`,
);
