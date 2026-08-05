-- 创作社区：帖子封面图 URL（可选）
-- Web 端 FeedCard 优先展示 cover_image_url，缺失时回退到主题渐变封面。
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT NULL;
