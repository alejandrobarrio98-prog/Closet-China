// Fetches the current set of published Instagram media for one account
// and writes it to catalog.json. Run with Node 20+ (has global fetch).
//
// Requires two environment variables:
//   IG_USER_ID      — your Instagram professional account's user id
//   IG_ACCESS_TOKEN — a long-lived Instagram User access token
//
// Because the Instagram media endpoint only ever returns currently
// published posts, archiving a post on Instagram makes it vanish from
// this list automatically — no extra "delete" logic needed here.

import { writeFile } from "node:fs/promises";

const IG_USER_ID = process.env.IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;

if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
  console.error("Missing IG_USER_ID or IG_ACCESS_TOKEN environment variables.");
  process.exit(1);
}

const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
const BASE_URL = `https://graph.instagram.com/${IG_USER_ID}/media`;

async function fetchAllMedia() {
  let url = `${BASE_URL}?fields=${FIELDS}&access_token=${IG_ACCESS_TOKEN}&limit=50`;
  const items = [];

  while (url) {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message} (code ${data.error.code})`);
    }

    items.push(...(data.data || []));
    url = data.paging?.next || null;
  }

  return items;
}

function extractHashtags(caption = "") {
  const matches = caption.match(/#[\p{L}0-9_]+/gu) || [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

function stripHashtags(caption = "") {
  return caption.replace(/#[\p{L}0-9_]+/gu, "").replace(/\s{2,}/g, " ").trim();
}

async function main() {
  console.log("Fetching media from Instagram...");
  const rawItems = await fetchAllMedia();

  const items = rawItems
    // Drop VIDEO posts — comment this line out if you want reels in the catalog too.
    // (Carousel covers and plain images still come through either way.)
    .filter((item) => item.media_type !== "VIDEO")
    .map((item) => ({
      id: item.id,
      image: item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url,
      permalink: item.permalink,
      caption: stripHashtags(item.caption),
      hashtags: extractHashtags(item.caption),
      timestamp: item.timestamp,
    }));

  await writeFile(
    "catalog.json",
    JSON.stringify({ updated: new Date().toISOString(), items }, null, 2)
  );

  console.log(`Wrote ${items.length} item(s) to catalog.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
