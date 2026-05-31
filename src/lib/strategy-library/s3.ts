import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { formatJson } from "./templates";
import { JsonFile, StockFolder } from "./types";

const bucket = process.env.STRATEGY_LIBRARY_BUCKET ?? "silly-stock-json-324971275476-ap-northeast-1";
const userPrefix = process.env.STRATEGY_LIBRARY_USER_ID ?? "default";
const region = process.env.AWS_REGION ?? "ap-northeast-1";
const basePrefix = `users/${userPrefix}/stocks/`;

const client = new S3Client({ region });

type MetaFile = {
  symbol: string;
  market: StockFolder["market"];
  name: string;
};

function metaKey(symbol: string) {
  return `${basePrefix}${symbol}/meta.json`;
}

function jsonKey(symbol: string, fileName: string) {
  return `${basePrefix}${symbol}/${fileName}`;
}

function symbolFromKey(key: string) {
  return key.slice(basePrefix.length).split("/")[0];
}

async function bodyToString(body: unknown) {
  if (!body || typeof body !== "object" || !("transformToString" in body)) {
    return "";
  }

  return (body as { transformToString: () => Promise<string> }).transformToString();
}

async function getTextObject(key: string) {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return bodyToString(response.Body);
}

export async function getStrategyLibraryFromS3(): Promise<StockFolder[]> {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: basePrefix,
    }),
  );
  const objects = response.Contents ?? [];

  if (objects.length === 0) {
    return [];
  }

  const keys = objects
    .map((object) => object.Key)
    .filter((key): key is string => Boolean(key));
  const symbols = [...new Set(keys.map(symbolFromKey))];

  return Promise.all(
    symbols.map(async (symbol) => {
      let meta: MetaFile = {
        symbol,
        market: "UNKNOWN",
        name: symbol,
      };

      try {
        meta = JSON.parse(await getTextObject(metaKey(symbol))) as MetaFile;
      } catch {
        // Keep the folder visible even if meta.json is missing or malformed.
      }

      const files = await Promise.all(
        keys
          .filter((key) => key.startsWith(`${basePrefix}${symbol}/`))
          .filter((key) => !key.endsWith("/"))
          .filter((key) => !key.endsWith("/meta.json"))
          .map(async (key) => {
            const name = key.slice(`${basePrefix}${symbol}/`.length);
            const kind: JsonFile["kind"] = name === "strategy.json" ? "strategy" : "indicator";

            return {
              id: `${symbol}:${name}`,
              name,
              kind,
              content: await getTextObject(key),
              updatedAt:
                objects.find((object) => object.Key === key)?.LastModified?.toISOString() ??
                new Date().toISOString(),
            };
          }),
      );

      return {
        symbol: meta.symbol,
        market: meta.market,
        name: meta.name,
        files: files.sort((a, b) => a.name.localeCompare(b.name)),
      };
    }),
  );
}

export async function replaceStrategyLibraryInS3(library: StockFolder[]) {
  const existing = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: basePrefix,
    }),
  );
  const objects = existing.Contents?.map((object) => object.Key).filter(Boolean) ?? [];

  if (objects.length > 0) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: objects.map((Key) => ({ Key })),
        },
      }),
    );
  }

  await Promise.all(
    library.flatMap((stock) => [
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: metaKey(stock.symbol),
          Body: formatJson({
            symbol: stock.symbol,
            market: stock.market,
            name: stock.name,
          }),
          ContentType: "application/json",
        }),
      ),
      ...stock.files.map((file) =>
        client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: jsonKey(stock.symbol, file.name),
            Body: file.content,
            ContentType: "application/json",
          }),
        ),
      ),
    ]),
  );
}
