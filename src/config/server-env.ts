export type StrategyLibraryConfig = {
  region: string;
  bucket: string;
  userId: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export function getStrategyLibraryConfig(): StrategyLibraryConfig {
  return {
    region: process.env.AWS_REGION?.trim() || "ap-northeast-1",
    bucket: required("STRATEGY_LIBRARY_BUCKET"),
    userId: process.env.STRATEGY_LIBRARY_USER_ID?.trim() || "default",
  };
}
