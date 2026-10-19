import Link from "next/link";

import type { SearchResult } from "@/lib/items/search";
import { itemPath } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { formatToronto } from "@/lib/time";

export function ItemCard({ item }: { item: SearchResult }) {
  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex gap-3">
        {item.photoUrl ? (
          // Signed URLs expire quickly, so the browser must not reuse a cached copy.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="bg-muted h-20 w-20 shrink-0 rounded-md" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <h3 className="font-semibold">
            <Link href={itemPath(item.refCode)} className={textLinkClass}>
              {item.refCode}
            </Link>
          </h3>
          <p className="break-words">{item.description}</p>
          <p className="text-sm text-muted-foreground">
            {item.category} · {item.building} · {formatToronto(item.foundAt)}
          </p>
          <p className="text-sm">At {item.desk}</p>
        </div>
      </div>
    </article>
  );
}
