-- =====================================================================
-- Youtube 项目建表脚本（按外键依赖顺序排列，必须从前往后执行）
-- 字符集统一 utf8mb4 / utf8mb4_0900_ai_ci，避免外键报 3780 类型不兼容
-- 业务主键：user_id / myid / comment_id 均为 RandomlyCreateID 生成的 13 位字符串
-- =====================================================================

-- ---------- 0. 数据库本身（已存在则跳过） ----------
CREATE DATABASE IF NOT EXISTS youtube
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE youtube;

-- ---------- 1. 用户主表（所有外键的最终指向） ----------
CREATE TABLE IF NOT EXISTS user_information(
    user_id     VARCHAR(13)  NOT NULL,               -- 13位随机字符串，主键
    username    VARCHAR(50)  NOT NULL,
    password    VARCHAR(100) NOT NULL,
    nickname    VARCHAR(50)  NULL,                   -- 视频列表要 JOIN 出来当 UP 主昵称
    avatar      VARCHAR(500) NULL,                   -- 头像路径，VideoMapper 的 SQL 用到
    email       VARCHAR(100) NULL,
    phone       VARCHAR(20)  NULL,
    create_time DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 【已建过表的话看这里】老表缺 avatar 列时，单独补一次，不用重建表：
-- ALTER TABLE user_information ADD COLUMN avatar VARCHAR(500) NULL;
-- 想确认到底缺不缺，跑这句：
-- SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA='youtube' AND TABLE_NAME='user_information';

-- ---------- 2. 动态表（被 content_comments 引用，必须先于它建） ----------
CREATE TABLE IF NOT EXISTS dynamic(
    myid        VARCHAR(13)  NOT NULL,               -- 动态ID，13位随机字符串
    user_id     VARCHAR(13)  NOT NULL,               -- ★新增：动态归属人，否则查不到是谁发的
    content     TEXT         NOT NULL,
    create_time DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (myid),
    KEY idx_dynamic_user (user_id),                  -- 按作者查动态用，走索引
    CONSTRAINT fk_dynamic_user FOREIGN KEY (user_id)
        REFERENCES user_information(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 【已建过表的话看这里】dynamic 已存在时 CREATE IF NOT EXISTS 不会加新列，需补执行：
-- ALTER TABLE dynamic ADD COLUMN user_id VARCHAR(13) NOT NULL AFTER myid;
-- 注意：老动态没有作者，这条 ALTER 会因已有数据而失败，需先给旧数据填一个 user_id
--   或先 TRUNCATE TABLE dynamic;（学习阶段清空数据通常最省事）

-- ---------- 3. 动态评论表 ----------
CREATE TABLE IF NOT EXISTS content_comments(
    comment_id  VARCHAR(13) NOT NULL,                -- 评论ID
    dynamic_id  VARCHAR(13) NOT NULL,                -- 属于哪条动态
    user_id     VARCHAR(13) NOT NULL,                -- 谁评的
    parent_id   VARCHAR(13) NULL,                    -- NULL=一级评论，有值=回复某条评论
    contents    TEXT        NOT NULL,
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id),
    KEY idx_comment_dynamic (dynamic_id),
    KEY idx_comment_parent (parent_id),              -- 按 parent_id 捞楼中楼，必须加索引
    CONSTRAINT fk_comment_dynamic FOREIGN KEY (dynamic_id)
        REFERENCES dynamic(myid) ON DELETE CASCADE,  -- 删动态，评论跟着没
    CONSTRAINT fk_comment_user FOREIGN KEY (user_id)
        REFERENCES user_information(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_parent FOREIGN KEY (parent_id)
        REFERENCES content_comments(comment_id) ON DELETE CASCADE   -- 自引用：回复指向的父评论
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------- 4. 视频表 ----------
-- 说明：id 用 BIGINT 自增（纯技术主键，不进 Java 业务逻辑），
--       user_id 用 VARCHAR(13) 关联用户，必须与第 1 张表定义逐字一致，否则报 3780
CREATE TABLE IF NOT EXISTS video(
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     VARCHAR(13)  NOT NULL,
    title       VARCHAR(200) NOT NULL,
    video_path  VARCHAR(500) NULL,
    view_count  INT          NOT NULL DEFAULT 0,
    create_time DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_video_user (user_id),                    -- selectVideo(userId) 走索引
    KEY idx_video_title (title),                     -- selectVideoByTitle / LIKE 前缀匹配用
    CONSTRAINT fk_video_user FOREIGN KEY (user_id)
        REFERENCES user_information(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------- 5. 视频点赞表（补建） ----------
-- VideoMapper 的 SQL 里子查询引用了 video_like，但脚本原本没有这张表，
-- 不建它 selectVideoByUPName / searchVideo 会直接报 Table doesn't exist
CREATE TABLE IF NOT EXISTS video_like(
    video_id    BIGINT      NOT NULL,
    user_id     VARCHAR(13) NOT NULL,
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (video_id, user_id),                 -- 联合主键 = 一人一视频只能赞一次
    KEY idx_like_user (user_id),
    CONSTRAINT fk_like_video FOREIGN KEY (video_id)
        REFERENCES video(id) ON DELETE CASCADE,      -- 删视频，点赞记录自动清
    CONSTRAINT fk_like_user FOREIGN KEY (user_id)
        REFERENCES user_information(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------- 6. 视频评论表 ----------
-- ★原脚本这里是 user_id BIGINT，与 video.user_id VARCHAR(13) 不一致，已改为 VARCHAR(13)
CREATE TABLE IF NOT EXISTS video_comment(
    comment_id  VARCHAR(13) NOT NULL,
    video_id    BIGINT      NOT NULL,                -- 与 video.id 同为 BIGINT ✓
    user_id     VARCHAR(13) NOT NULL,                -- ← 修正点：原为 BIGINT
    parent_id   VARCHAR(13) NULL,
    contents    TEXT        NOT NULL,
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id),
    KEY idx_vcomment_video (video_id),
    KEY idx_vcomment_parent (parent_id),
    CONSTRAINT fk_vcomment_video FOREIGN KEY (video_id)
        REFERENCES video(id) ON DELETE CASCADE,
    CONSTRAINT fk_vcomment_user FOREIGN KEY (user_id)
        REFERENCES user_information(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_vcomment_parent FOREIGN KEY (parent_id)
        REFERENCES video_comment(comment_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------- 7. 【可选，默认不需要】缓存表 ----------
-- 本项目的缓存依赖是 spring-boot-starter-cache + caffeine，属于进程内缓存，
-- 不写数据库，所以正常开发不需要 video_cache 这张表。
-- 将来若要做"重启后仍保留"的持久化缓存，再自行启用下面这段。
CREATE TABLE IF NOT EXISTS video_cache(
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    cache_key   VARCHAR(128) NOT NULL,
    cache_value TEXT         NULL,
    expire_time DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_cache_key (cache_key)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------- 8. 私信表（PrivateMessageMapper / /api/private_message 使用） ----------
-- 业务主键 msg_id 为 RandomlyCreateID 生成的 13 位字符串
CREATE TABLE IF NOT EXISTS private_message(
    msg_id      VARCHAR(13) NOT NULL,                -- 消息ID，13位随机字符串
    from_user   VARCHAR(13) NOT NULL,                -- 发件人 user_id
    to_user     VARCHAR(13) NOT NULL,                -- 收件人 user_id
    contents    TEXT        NOT NULL,                -- 消息内容
    is_read     TINYINT     NOT NULL DEFAULT 0,      -- 0=未读 1=已读（收件人视角）
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (msg_id),
    KEY idx_pm_inbox (to_user, is_read, create_time),   -- 收件箱/未读数查询走索引
    KEY idx_pm_outbox (from_user, create_time)          -- "我发出的"会话查询走索引
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 【已建过表的话看这里】private_message 之前是手动建的，CREATE IF NOT EXISTS 不会补索引，
-- 老表缺索引时单独补一次（已有同名索引会报 Duplicate key name，忽略即可）：
-- ALTER TABLE private_message ADD COLUMN create_time DATETIME DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE private_message ADD INDEX idx_pm_inbox (to_user, is_read, create_time);
-- ALTER TABLE private_message ADD INDEX idx_pm_outbox (from_user, create_time);
-- 想确认实际结构，跑这句：
-- SHOW CREATE TABLE private_message;

-- =====================================================================
-- 执行完后自查：所有外键两端的类型是否逐字一致
-- COLUMN_TYPE 必须同为 varchar(13)、字符集与排序规则完全相同
-- =====================================================================
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'youtube'
  AND COLUMN_NAME IN ('user_id', 'myid', 'id', 'video_id', 'dynamic_id', 'parent_id')
ORDER BY TABLE_NAME, COLUMN_NAME;

-- 外键是否真的建上了：
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME,
       REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'youtube' AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME;
