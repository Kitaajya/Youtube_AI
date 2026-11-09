-- =====================================================================
-- 私信屏蔽表 private_message_block
-- 对应功能：私信页「屏蔽此人 / 解除屏蔽」（PrivateMessageController 的 /block/pm、/unblock/pm）
--
-- 为什么单独补这个脚本：
--   PrivateMessageMapper 里三条 SQL 直接写死了表名 private_message_block
--   （block / unblock / checkBlockStatus），但 01~03 号脚本从来没建过它。
--   库里没有这张表时会出现两种 500：
--     1) 点「屏蔽此人」       -> Table 'youtube.private_message_block' doesn't exist
--     2) 任何一次发私信        -> send() 里的 checkBlockStatus 也查这张表，同样 500
--   这里补一份建表语句，表已存在时 IF NOT EXISTS 会直接跳过，可以放心重复执行。
-- =====================================================================

USE youtube;

CREATE TABLE IF NOT EXISTS private_message_block(
    user_id         VARCHAR(13) NOT NULL,              -- 谁的屏蔽名单（屏蔽别人的那一方，= 前端传的 upId）
    blocked_user_id VARCHAR(13) NOT NULL,              -- 被屏蔽的人（= 前端传的 userId）
    create_time     DATETIME    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, blocked_user_id),            -- 同一个人只留一条，重复屏蔽不会报主键冲突
    KEY idx_pmb_blocked (blocked_user_id)              -- 反查"我被谁屏蔽了"用
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 执行完自查：能查出 0 行就说明表建好了
SELECT COUNT(*) AS blocked_rows FROM private_message_block;
