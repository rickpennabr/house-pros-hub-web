'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mountain, Trees } from 'lucide-react';
import type { BlogPostCard } from '@/lib/blog/types';
import { formatBlogDate } from '@/lib/blog/format';

interface BlogCardProps {
  post: BlogPostCard;
  locale: string;
  categoryLabel: string;
  readLabel: string;
}

export function BlogCard({ post, locale, categoryLabel, readLabel }: BlogCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(post.cover_image_url) && !imageFailed;
  const isLandscape = post.category === 'landscape';
  const dateLabel = formatBlogDate(post.published_at, locale);

  return (
    <Link
      href={`/${locale}/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border-2 border-black bg-white transition-shadow hover:shadow-lg"
    >
      <div
        className={`relative h-36 overflow-hidden ${
          isLandscape
            ? 'bg-gradient-to-br from-emerald-800 via-lime-900 to-stone-800'
            : 'bg-gradient-to-br from-stone-600 via-amber-900 to-stone-950'
        }`}
      >
        {showImage && (
          <img
            src={post.cover_image_url ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        )}
        {!showImage && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            {isLandscape ? <Trees className="h-12 w-12" aria-hidden /> : <Mountain className="h-12 w-12" aria-hidden />}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full border-2 border-black bg-white px-2.5 py-0.5 text-xs font-semibold text-black">
          {categoryLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
          {post.region}
          {dateLabel ? ` · ${dateLabel}` : ''}
        </p>
        <h2 className="text-lg font-bold leading-tight text-black group-hover:underline">{post.title}</h2>
        <p className="line-clamp-3 text-sm leading-relaxed text-gray-700">{post.excerpt}</p>
        <span className="mt-auto pt-2 text-sm font-semibold text-black">{readLabel}</span>
      </div>
    </Link>
  );
}
