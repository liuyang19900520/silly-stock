import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { _Object } from "@aws-sdk/client-s3";
import { getStrategyLibraryConfig } from "@/config/server-env";
import { formatJson } from "@/features/strategy-library/templates";
import { JsonFile, StockFolder } from "@/features/strategy-library/types";

type MetaFile = {
  symbol: string;
  market: StockFolder["market"];
  name: string;
};

function createContext() {
  const config = getStrategyLibraryConfig();
  return {
    ...config,
    basePrefix: `users/${config.userId}/stocks/`,
    client: new S3Client({ region: config.region }),
  };
}

async function listAllObjects(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<_Object[]> {
  const objects: _Object[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    objects.push(...(response.Contents ?? []));
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

async function bodyToString(body: unknown) {
  if (!body || typeof body !== "object" || !("transformToString" in body)) {
    return "";
  }
  return (body as { transformToString: () => Promise<string> }).transformToString();
}

export async function getStrategyLibrary(): Promise<StockFolder[]> {
  const { client, bucket, basePrefix } = createContext();
  const objects = await listAllObjects(client, bucket, basePrefix);
  const keys = objects
    .map((object) => object.Key)
    .filter((key): key is string => Boolean(key));
  const symbols = [...new Set(keys.map((key) => key.slice(basePrefix.length).split("/")[0]))];

  async function getTextObject(key: string) {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return bodyToString(response.Body);
  }

  const stocks = await Promise.all(
    symbols.map(async (symbol) => {
      const stockPrefix = `${basePrefix}${symbol}/`;
      let meta: MetaFile = { symbol, market: "UNKNOWN", name: symbol };

      try {
        meta = JSON.parse(await getTextObject(`${stockPrefix}meta.json`)) as MetaFile;
      } catch {
        // Keep recoverable strategy files visible when metadata is unavailable.
      }

      const files = await Promise.all(
        keys
          .filter((key) => key.startsWith(stockPrefix))
          .filter((key) => !key.endsWith("/") && !key.endsWith("/meta.json"))
          .map(async (key) => {
            const name = key.slice(stockPrefix.length);
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

  return stocks.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function replaceStrategyLibrary(library: StockFolder[]) {
  const { client, bucket, basePrefix } = createContext();
  const desiredObjects = new Map<string, string>();

  for (const stock of library) {
    const stockPrefix = `${basePrefix}${stock.symbol}/`;
    desiredObjects.set(
      `${stockPrefix}meta.json`,
      formatJson({ symbol: stock.symbol, market: stock.market, name: stock.name }),
    );
    for (const file of stock.files) {
      desiredObjects.set(`${stockPrefix}${file.name}`, file.content);
    }
  }

  await Promise.all(
    [...desiredObjects].map(([Key, Body]) =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key,
          Body,
          ContentType: "application/json",
          ServerSideEncryption: "AES256",
        }),
      ),
    ),
  );

  const existingObjects = await listAllObjects(client, bucket, basePrefix);
  const staleKeys = existingObjects
    .map((object) => object.Key)
    .filter((key): key is string => typeof key === "string" && !desiredObjects.has(key));

  for (let index = 0; index < staleKeys.length; index += 1000) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: staleKeys.slice(index, index + 1000).map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
  }
}
