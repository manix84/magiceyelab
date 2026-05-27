import { copyFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const distDirectory = resolve("dist");
const indexPath = resolve(distDirectory, "index.html");
const fallbackPath = resolve(distDirectory, "404.html");

await access(indexPath, constants.R_OK);
await copyFile(indexPath, fallbackPath);
