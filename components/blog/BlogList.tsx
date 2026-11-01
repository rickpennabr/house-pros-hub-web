'use client';

import { useTranslations } from 'next-intl';
import { BlogCard } from '@/components/blog/BlogCard';
import { useCategory } from '@/contexts/CategoryContext';
import type { BlogPostCard } from '@/lib/blog/types';

interface BlogListProps {
  posts: BlogPostCard[];
  locale: string;
  unavailable: boolean;
}

export function BlogList({ posts, locale, unavailable }: BlogListProps) {
  const t = useTranslations('blog');
  const { activeCategory, searchQuery } = useCategory();
  const query = searchQuery.trim().toLowerCase();
  const visible = posts.filter((post) => {
    if (activeCategory !== 'All' && post.category !== activeCategory) return false;
    if (!query) return true;
    return [post.title, post.excerpt, post.region, post.category].join(' ').toLowerCase().includes(query);
  });

  if (unavailable) {
    return <p className="text-sm text-gray-700">{t('unavailable')}</p>;
  }

  if (posts.length === 0) {
    return <p className="text-sm text-gray-700">{t('empty')}</p>;
  }

  if (visible.length === 0) {
    return <p className="text-sm text-gray-700">{t('noMatches')}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {visible.map((post) => (
        <BlogCard
          key={post.id}
          post={post}
          locale={locale}
          categoryLabel={t(post.category)}
          readLabel={t('readArticle')}
        />
      ))}
    </div>
  );
}
