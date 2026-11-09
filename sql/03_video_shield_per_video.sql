-- ============================================================================
-- 03_video_shield_per_video.sql
-- 把「UP 主全站屏蔽某人」升级成「UP 主只在某个视频下屏蔽某人」
--
-- 背景：
--   旧表 video_shield(up_id, user_id) 只记了"谁屏蔽了谁"，没有视频维度，
--   所以 selectVideoAndUpInformation 一过滤就把这个 UP 主的全部视频都藏了。
--   新表 video_shield(up_id, video_id, user_id)：一行 = 某个视频屏蔽了某个人。
--
-- 执行方式（任选其一）：
--   1) IDEA 的 Database 控制台里打开本文件，选中 youtube 库后整段执行；
--   2) 命令行：mysql -u youtube_app -p123456 -D youtube < 03_video_shield_per_video.sql
--
-- 幂等性：本脚本只跑一次。重复执行会在 ADD COLUMN 处报 1060（duplicate column），
--         说明已经迁移过，不要再跑。
-- ============================================================================

USE youtube;

-- 1) 增加视频维度。先允许 NULL，方便把旧数据补齐后再收紧成 NOT NULL。
ALTER TABLE video_shield
    ADD COLUMN video_id BIGINT NULL AFTER up_id;

-- 2) 旧数据迁移：旧的一行 (up_id, user_id) 表示"该 UP 主全站屏蔽此人"。
--    展开成"该 UP 主当前每个视频都屏蔽此人"，这样升级前已经生效的屏蔽不会突然失效。
--    create_time 沿用旧记录的，方便前端显示"屏蔽于 xxx"。
INSERT IGNORE INTO video_shield (up_id, video_id, user_id, create_time)
SELECT vs.up_id, v.id, vs.user_id, vs.create_time
FROM video_shield vs
         JOIN video v ON v.user_id = vs.up_id
WHERE vs.video_id IS NULL;

-- 旧的全站语义行已经展开完，删掉（video_id 为 NULL 的行不再有意义）
DELETE FROM video_shield WHERE video_id IS NULL;

-- 3) 主键从 (up_id, user_id) 换成 (video_id, user_id)：
--    一条记录 = 一个视频屏蔽一个人；同一个人可以在不同视频下被分别屏蔽。
--    fk_vs_up 外键需要 up_id 上的索引，先补 idx_vs_up 再删主键，否则报 1553。
ALTER TABLE video_shield
    ADD KEY idx_vs_up (up_id),
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (video_id, user_id);

-- 4) 收紧为 NOT NULL：之后每一条屏蔽都必须依附某个视频
ALTER TABLE video_shield
    MODIFY video_id BIGINT NOT NULL;

-- 5) 删视频时，该视频的屏蔽记录跟着清掉
ALTER TABLE video_shield
    ADD CONSTRAINT fk_vs_video FOREIGN KEY (video_id) REFERENCES video (id) ON DELETE CASCADE;

-- 迁移后的最终结构（用于核对）：
-- CREATE TABLE `video_shield` (
--   `up_id`       varchar(13) NOT NULL,
--   `video_id`    bigint      NOT NULL,
--   `user_id`     varchar(13) NOT NULL,
--   `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
--   PRIMARY KEY (`video_id`, `user_id`),
--   KEY `idx_vs_up` (`up_id`),
--   KEY `idx_vs_user` (`user_id`, `up_id`),
--   CONSTRAINT `fk_vs_video` FOREIGN KEY (`video_id`) REFERENCES `video` (`id`) ON DELETE CASCADE,
--   CONSTRAINT `fk_vs_up`    FOREIGN KEY (`up_id`)    REFERENCES `user_information` (`user_id`) ON DELETE CASCADE,
--   CONSTRAINT `fk_vs_user`  FOREIGN KEY (`user_id`)  REFERENCES `user_information` (`user_id`) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
