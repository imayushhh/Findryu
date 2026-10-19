import { createClient } from "@/lib/supabase/server";

/** Short-lived URLs for private item photos. */
export async function signedItemPhotoUrls(paths: string[]) {
  const urls = new Map<string, string>();
  if (paths.length === 0) {
    return urls;
  }

  const supabase = await createClient();
  const { data } = await supabase.storage.from("item-photos").createSignedUrls(paths, 120);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) {
      urls.set(row.path, row.signedUrl);
    }
  }
  return urls;
}
