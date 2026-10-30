-- ============================================================
-- youtube 库排序规则/结构修复脚本（2026-10-09）
-- 前提：dynamic / content_comments 均为 0 行，转换无数据风险
-- ============================================================

USE youtube;

-- 1. 库默认排序规则改为 utf8mb4_0900_ai_ci（与建表脚本一致）
ALTER DATABASE youtube CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- 2. 先摘掉 content_comments -> dynamic 的旧外键，否则父表无法转换字符集
ALTER TABLE content_comments DROP FOREIGN KEY content_comments_ibfk_1;

-- 3. 老表统一排序规则（原为 utf8mb4_unicode_ci，这是 3780 的根因）
ALTER TABLE dynamic          CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE content_comments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- 4. 把刚摘掉的外键重新装上
ALTER TABLE content_comments ADD CONSTRAINT fk_comment_dynamic FOREIGN KEY (dynamic_id)
    REFERENCES dynamic(myid) ON DELETE CASCADE;

-- 5. dynamic 补作者列（老表建表时还没有这一列）
ALTER TABLE dynamic ADD COLUMN user_id VARCHAR(13) NOT NULL AFTER myid;

-- 6. 按建表脚本完整版创建 video / video_like / video_comment
--    （均显式 COLLATE = utf8mb4_0900_ai_ci，不再继承库默认值）
CREATE TABLE IF NOT EXISTS video(
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     VARCHAR(13)  NOT NULL,
    title       VARCHAR(200) NOT NULL,
    video_path  VARCHAR(500) NULL,
    view_count  INT          NOT NULL DEFAULT 0,
    create_time DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_video_user (user_id),
    KEY idx_video_title (title),
    CONSTRAINT fk_video_user FOREIGN KEY (user_id)
        REFERENCES user_information(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS video_like(
    video_id    BIGINT      NOT NULL,
    user_id     VARCHAR(13) NOT NULL,
    create_time DATETIME    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (video_id, user_id),
    KEY idx_like_user (user_id),
    CONSTRAINT fk_like_video FOREIGN KEY (video_id)
        REFERENCES video(id) ON DELETE CASCADE,
    CONSTRAINT fk_like_user FOREIGN KEY (user_id)
        REFERENCES user_information(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS video_comment(
    comment_id  VARCHAR(13) NOT NULL,
    video_id    BIGINT      NOT NULL,
    user_id     VARCHAR(13) NOT NULL,
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

-- 7. 补齐脚本要求、老表上实际缺失的外键
ALTER TABLE dynamic          ADD CONSTRAINT fk_dynamic_user FOREIGN KEY (user_id)
    REFERENCES user_information(user_id) ON DELETE CASCADE;
ALTER TABLE content_comments ADD CONSTRAINT fk_comment_user FOREIGN KEY (user_id)
    REFERENCES user_information(user_id) ON DELETE CASCADE;

-- 8. content_comments 自引用外键（楼中楼 parent_id -> comment_id，老表上缺失）
ALTER TABLE content_comments ADD CONSTRAINT fk_comment_parent FOREIGN KEY (parent_id)
    REFERENCES content_comments(comment_id) ON DELETE CASCADE;
