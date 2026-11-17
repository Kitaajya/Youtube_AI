-- =====================================================================
-- 06. 跨用户「单方面软删除」记录表
-- 背景：原来的 from_deleted 只是消息表上的一个列，只能表达"发送方删了自己发的"，
--       群聊里任何人、私信里的接收方想删掉别人发的消息（只对自己隐藏）都表达不了。
-- 方案：一行 = 某个用户把某条消息从自己的视图里删掉了。
--       scope: 'pm' = private_message，'group' = group_message
--       消息本体、其他人视图、AI 总结都不受影响（查询时按 user_id 过滤）。
-- =====================================================================
CREATE TABLE IF NOT EXISTS message_soft_delete (
    user_id     VARCHAR(13) NOT NULL,                 -- 谁删的（只影响他自己的视图）
    scope       VARCHAR(10) NOT NULL,                -- 'pm' / 'group'
    msg_id      VARCHAR(13) NOT NULL,                -- 哪条消息
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, scope, msg_id),            -- 天然幂等，重复删除不报错
    KEY idx_msd_msg (msg_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 旧的 from_deleted 列及其数据保留不动，查询里两个条件并存，兼容历史行为。
