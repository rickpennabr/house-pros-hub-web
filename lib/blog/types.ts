import type { Database } from '@/lib/types/supabase';

export type BlogPost = Database['public']['Tables']['blog_posts']['Row'];

export type BlogPostCard = Omit<BlogPost, 'body'>;
