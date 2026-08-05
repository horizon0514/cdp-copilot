'use client';

/**
 * Links that point at the newest GitHub release.
 *
 * Replaces the old `release.js`, which fetched the tag and then patched
 * `[data-release]` attributes in the DOM. Same behaviour, expressed as
 * components: every element renders immediately against the stable
 * `/releases/latest/...` URLs and upgrades to the exact tag once it is known, so
 * a failed or slow lookup leaves working links rather than dead ones.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { GITHUB_URL, RELEASE_PAGE_URL, RELEASE_ZIP_URL } from './site';

const LATEST_API = 'https://api.github.com/repos/horizon0514/pagehand/releases/latest';

/** One lookup per page load, shared by every link on it. */
let pending: Promise<string | null> | null = null;

function releaseTag(): Promise<string | null> {
  pending ??= fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { tag_name?: string } | null) => data?.tag_name ?? null)
    .catch(() => null);
  return pending;
}

function useReleaseTag(): string | null {
  const [tag, setTag] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void releaseTag().then((value) => {
      if (live) setTag(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return tag;
}

function zipUrl(tag: string | null): string {
  return tag ? `${GITHUB_URL}/releases/download/${tag}/pagehand.zip` : RELEASE_ZIP_URL;
}

function pageUrl(tag: string | null): string {
  return tag ? `${GITHUB_URL}/releases/tag/${tag}` : RELEASE_PAGE_URL;
}

/**
 * The hero's primary button. Its label gains the version once known.
 *
 * Both labels are plain strings rather than a formatter callback: these pages
 * are server components, and a function prop cannot cross into a client one.
 */
export function DownloadCta({ idle, tagPrefix }: { idle: string; tagPrefix: string }) {
  const tag = useReleaseTag();
  return (
    <a className="btn btn-primary" id="install-cta" href={zipUrl(tag)}>
      {tag ? `${tagPrefix}${tag}` : idle}
    </a>
  );
}

/** Inline link to the zip itself. */
export function ZipLink({ children }: { children: ReactNode }) {
  const tag = useReleaseTag();
  return <a href={zipUrl(tag)}>{children}</a>;
}

/** Link to the release page whose text *is* the tag once resolved. */
export function TagLink({ idle }: { idle: string }) {
  const tag = useReleaseTag();
  return <a href={pageUrl(tag)}>{tag ?? idle}</a>;
}
