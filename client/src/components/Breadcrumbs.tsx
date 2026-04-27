/**
 * Breadcrumbs — visual breadcrumb trail + matching BreadcrumbList JSON-LD.
 *
 * Two outputs from one call:
 *   1. A semantic <nav aria-label="Breadcrumb"> with a styled list
 *      (visible to users)
 *   2. A schema.org BreadcrumbList JSON-LD block (consumed by Google,
 *      Bing, AI crawlers — surfaces in search-result UI)
 *
 * Pass items from root → current page. The last item is rendered as
 * non-clickable (the page you're on).
 */

import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import {
  StructuredData,
  breadcrumbSchema,
} from "@/components/StructuredData";

export interface BreadcrumbItem {
  /** Human-readable label */
  name: string;
  /**
   * Path or full URL. If relative (starts with `/`), wouter Link is used.
   * If absolute, the absolute URL is used in the JSON-LD.
   */
  path: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /**
   * Unique ID for the JSON-LD block. Defaults to "breadcrumb".
   * Only set this if you have multiple Breadcrumbs on a page (rare).
   */
  schemaId?: string;
  /** Hide the visual breadcrumb but still emit the JSON-LD */
  hideVisual?: boolean;
  className?: string;
}

const BASE_URL = "https://stsdashboard.com";

function toAbsolute(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${BASE_URL}${path}`;
}

export function Breadcrumbs({
  items,
  schemaId = "breadcrumb",
  hideVisual = false,
  className = "",
}: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const schema = breadcrumbSchema(
    items.map(it => ({ name: it.name, url: toAbsolute(it.path) }))
  );

  return (
    <>
      <StructuredData id={schemaId} data={schema} />
      {!hideVisual && (
        <nav
          aria-label="Breadcrumb"
          className={`text-sm text-muted-foreground ${className}`}
        >
          <ol className="flex items-center gap-1.5 flex-wrap">
            {items.map((item, i) => {
              const isLast = i === items.length - 1;
              const isFirst = i === 0;
              return (
                <li key={item.path} className="flex items-center gap-1.5">
                  {!isFirst && (
                    <ChevronRight
                      className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  {isLast ? (
                    <span
                      className="text-foreground font-medium"
                      aria-current="page"
                    >
                      {isFirst && (
                        <Home
                          className="inline h-3.5 w-3.5 mr-1 align-text-bottom"
                          aria-hidden="true"
                        />
                      )}
                      {item.name}
                    </span>
                  ) : (
                    <Link href={item.path}>
                      <a className="hover:text-foreground transition-colors inline-flex items-center">
                        {isFirst && (
                          <Home
                            className="inline h-3.5 w-3.5 mr-1 align-text-bottom"
                            aria-hidden="true"
                          />
                        )}
                        {item.name}
                      </a>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </>
  );
}

export default Breadcrumbs;
