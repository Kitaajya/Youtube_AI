-- =====================================================================
-- 05. 群聊消息软删除
-- 思路与 private_message.from_deleted 完全一致：
--   0 = 正常
--   1 = 发送者本人已在自己这一侧删除（只影响他自己的视图，其他群友照常可见）
-- 注意：这不是撤回，群消息本体不做任何改动
-- =====================================================================

-- 已建过 group_message 表的话执行下面这条 ALTER（已有该列会报 Duplicate column name，忽略即可）：
ALTER TABLE group_message
    ADD COLUMN from_deleted TINYINT NOT NULL DEFAULT 0
        COMMENT '0=正常 1=发送方本人已单方面删除（仅发送方查询时过滤）';
