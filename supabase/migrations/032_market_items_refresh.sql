-- 素材市场改版：素材补充「来源」字段，并替换为真实剧本杀参考素材
alter table public.illustration_market_items
  add column if not exists source text not null default '';

-- 移除旧的不符合剧本杀场景的占位素材
delete from public.illustration_market_items;

insert into public.illustration_market_items (title, task_type, subtitle, prompt_hint, visual_tone, thumb_url, source, sort_order)
values
  (
    '杜绵 人物立绘',
    'char',
    '现代情感本 / 女性角色',
    '竖版单人人物立绘，长发白裙女性，月夜花影氛围，五官与服饰清晰，适合角色一致性延展',
    '现代唯美 / 蓝紫夜色 / 月光氛围 / 人物立绘',
    '/market/moon3-char-dumian.png',
    '《那一束月光3》',
    1
  ),
  (
    '那一束月光3 剧本封面',
    'cover',
    '书封 / 标题排版',
    '竖版剧本封面成品，深蓝星空与新月，标题大字居中排版，底部汽车坠入水面的核心意象',
    '现代唯美 / 深蓝星空 / 留白构图 / 封面氛围',
    '/market/moon3-cover.png',
    '《那一束月光3》',
    2
  ),
  (
    '白穆 记忆碎片 线索卡',
    'clue',
    '记忆碎片 / 文字线索',
    '黑白颗粒质感线索卡，笔记本特写与撕页痕迹，顶部角色名与记忆碎片编号，底部段落文字排版',
    '黑白纪实 / 颗粒做旧 / 卡片构图 / 悬疑氛围',
    '/market/school22-clue-baimu.png',
    '《第二十二条校规》',
    3
  ),
  (
    '建筑系学生 线索卡',
    'clue',
    '角色口述 / 关系线索',
    '深色底纹线索卡，顶部角色身份标签，正文为角色口述回忆段落，角落压印剧本logo',
    '暗黑悬疑 / 金箔点缀 / 卡片构图 / 证物氛围',
    '/market/cube-clue-student.png',
    '《立方馆谋杀始末》',
    4
  ),
  (
    '立方馆建筑布局 公共线插画',
    'public',
    '建筑布局 / 公共线索',
    '竖版公共线索图，星空底纹，建筑平面布局示意图配文字说明，方位与尺寸标注清晰',
    '星空幻境 / 冷色渐变 / 图文混排 / 推理氛围',
    '/market/cube-public-layout.png',
    '《立方馆谋杀始末》',
    5
  ),
  (
    '密室逃脱 场景插画',
    'scene',
    '密室 / 机制场景',
    '黑白手绘质感场景插画，石墙密室正视角，两侧人物剪影与电子锁，中央炸弹倒计时，底部规则文字',
    '黑白手绘 / 高对比 / 对称构图 / 压迫氛围',
    '/market/yandere3-scene.png',
    '《病娇3》',
    6
  );
