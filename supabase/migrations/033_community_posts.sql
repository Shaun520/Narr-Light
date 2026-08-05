-- 创作社区：社区帖子表（MVP，审核制）
-- 提供社区动态流的真实数据闭环：用户提交（reviewing）→ Admin 审核上架（published）→ Web 动态流展示。
-- 点赞/拼车/关注等互动计数与关注关系表在后续迭代补充，
-- 本迁移只覆盖帖子本体与最小 RLS 权限。

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  script_id UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
  post_type VARCHAR(20) NOT NULL
    CHECK (post_type IN ('carpool','review','guide','rec','ask','talk')),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  cover_variant VARCHAR(10) NOT NULL DEFAULT 'c1'
    CHECK (cover_variant IN ('c1','c2','c3','c4','c5','c6','c7','c8')),
  cover_title VARCHAR(200) NOT NULL DEFAULT '',
  seat_filled INTEGER NOT NULL DEFAULT 0 CHECK (seat_filled >= 0),
  seat_total INTEGER NOT NULL DEFAULT 0 CHECK (seat_total >= 0),
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','reviewing','published','hidden','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_type ON public.community_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON public.community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- 已发布内容对登录用户可读（动态流）
CREATE POLICY "社区已发布帖子可读" ON public.community_posts
  FOR SELECT USING (status = 'published');

-- 作者可创建自己的帖子
CREATE POLICY "作者可创建自己的帖子" ON public.community_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- 作者可更新自己的帖子
CREATE POLICY "作者可更新自己的帖子" ON public.community_posts
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- 作者可删除自己的帖子
CREATE POLICY "作者可删除自己的帖子" ON public.community_posts
  FOR DELETE USING (auth.uid() = author_id);
