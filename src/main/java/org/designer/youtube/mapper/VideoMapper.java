package org.designer.youtube.mapper;

import org.apache.ibatis.annotations.*;

import java.util.List;
import java.util.Map;
//***********************************************************视频模块***********************************************************
/**
 * -- 视频（供 VideoMapper 使用）
 * CREATE TABLE IF NOT EXISTS video(
 *     id          BIGINT AUTO_INCREMENT PRIMARY KEY,
 *     user_id     VARCHAR(13) NOT NULL,
 *     title       varchar(200) NOT NULL,
 *     video_path  varchar(500),
 *     view_count  INT NOT NULL DEFAULT 0,
 *     create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
 *     FOREIGN KEY (user_id) REFERENCES user_information(user_id) ON DELETE CASCADE
 * );
 *
 *
 * easy to think it that id is a user number
 *          but actually its mean is a video number!
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * **/
public interface VideoMapper {
    //增加我的视频，返回受影响行数（1 表示成功，0 表示失败）
    @Insert("""
INSERT INTO video(user_id,title,video_path,is_short,duration_sec,is_vertical)
VALUES(#{userId},#{title},#{videoPath},#{isShort},#{durationSec},#{isVertical})
""")
    int uploadVideo(@Param("userId") String userId,
                    @Param("title") String title,
                    @Param("videoPath") String videoPath,
                    @Param("isShort") int isShort,
                    @Param("durationSec") int durationSec,
                    @Param("isVertical") int isVertical);

    //取刚上传视频的自增ID：必须与 uploadVideo 在同一事务中调用（Service 方法上加 @Transactional）
    @Select("SELECT LAST_INSERT_ID()")
    long selectLastVideoId();
    //显示视频标题，不限任何条件
    @Select("""
    SELECT title FROM video
    """)
    List<Map<String,Object>> selectVideoTitle();
    //查看某人的视频，根据用户id（附带点赞数，供个人主页展示）
    @Select("""
    SELECT v.*,
           (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) AS like_count
    FROM video v
    WHERE v.user_id=#{userId}
    ORDER BY v.create_time DESC
    """)
    List<Map<String,Object>> selectVideo(@Param("userId") String userId);
    //按照视频标题查询视频
    @Select("""
    SELECT * FROM video WHERE title=#{title}
    """)
    List<Map<String,Object>> selectVideoByTitle(@Param("title") String title);
    //查全部视频+UP主信息
    String SELECT_WITH_UPLOADER = """
            SELECT v.id, v.user_id, v.title, v.video_path, v.create_time, v.view_count,
                   (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) AS like_count,
                   u.nickname AS uploader, u.avatar AS uploader_avatar
            FROM video v
            LEFT JOIN user_information u ON v.user_id = u.user_id
            """;
    @Select(SELECT_WITH_UPLOADER)
    List<Map<String,Object>> selectVideoAndUpInformation();
    //显示全部视频
    @Select("""
    SELECT * FROM video
    """)
    List<Map<String,Object>> selectAllVideo();
    //根据up主的昵称查询他的所有视频
    @Select("""
    SELECT * FROM video WHERE user_id=#{userId}
    """)
    List<Map<String,Object>> selectVideosByUpName(@Param("userId") String userId);
    /**接下来实现一下功能：
     * selectVideoById	        按视频 ID 查询单个视频详情
     * searchVideo	            按标题模糊搜索视频（LIKE ?）
     * selectVideoPathById	    查询视频存储路径（用于播放/删除）
     * editVideoTitle	        修改自己的视频标题
     * deleteMyVideo	        删除自己的视频
     * **/
    //按视频 ID 查询单个视频详情（带点赞数与UP主昵称，播放页一次请求拿全）
   // @Select("""
   // SELECT v.id, v.user_id, v.title, v.video_path, v.create_time, v.view_count,
   //        (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) AS like_count,
   //        u.nickname AS uploader, u.avatar AS uploader_avatar
   // FROM video v
   // LEFT JOIN user_information u ON v.user_id = u.user_id
   // WHERE v.id=#{id}
   // """)
   // List<Map<String,Object>> selectVideoById(@Param("id")long id);
    @Select("""
    SELECT v.id, v.user_id, v.title, v.video_path, v.cover_path, v.create_time, v.view_count,
           (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) AS like_count,
           u.nickname AS uploader, u.avatar AS uploader_avatar
    FROM video v
    LEFT JOIN user_information u ON v.user_id = u.user_id
    WHERE v.id=#{id}
    """)
    List<Map<String,Object>> selectVideoById(@Param("id") long id);
    //模糊搜索
    @Select("""
    SELECT v.id, v.user_id, v.title, v.video_path, v.create_time, v.view_count,
           (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) AS like_count,
           u.nickname AS uploader, u.avatar AS uploader_avatar
    FROM video v
    LEFT JOIN user_information u ON v.user_id = u.user_id
    WHERE v.title LIKE CONCAT('%', #{keyword}, '%')
    ORDER BY v.create_time DESC
    """)
    List<Map<String, Object>> searchVideo(@Param("keyword") String keyword);

    //查询视频存储路径（用于播放/删除）
    @Select("""
    SELECT video_path FROM video WHERE id=#{id}
    """)
    List<Map<String,Object>> selectVideoPathById(@Param("id") long id);

    //修改自己的视频标题
    @Update("""
    UPDATE video SET title=#{newTitle} WHERE id=#{id} AND user_id=#{userId}
    """)
    int editTitle(@Param("newTitle") String newTitle,@Param("id") long id,@Param("userId") String userId);
    //删除自己的视频
    @Delete("""
    DELETE FROM video WHERE id=#{id} AND user_id=#{userId}
    """)
    int deleteMyVideo(@Param("id") long id,@Param("userId") String userId);

    //***********************************************************评论区模块***********************************************************
    /**
     * -- 视频评论表
     * CREATE TABLE IF NOT EXISTS video_comment(
     *     comment_id  VARCHAR(13) PRIMARY KEY,
     *     video_id    BIGINT NOT NULL,
     *     user_id     varchar(13) NOT NULL,
     *     parent_id   VARCHAR(13) NULL,
     *     contents    TEXT NOT NULL,
     *     create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
     *     FOREIGN KEY (video_id) REFERENCES video(id) ON DELETE CASCADE
     * );
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     */

    //查看此视频的所有评论，根据id（视频id）；关联用户表带出昵称与头像
    @Select("""
    SELECT vc.comment_id, vc.video_id, vc.user_id, vc.contents, vc.parent_id, vc.create_time,
           u.nickname AS commenter, u.avatar AS commenter_avatar,
           (SELECT COUNT(*) FROM comment_like cl WHERE cl.comment_id = vc.comment_id) AS like_count,
           -- 加上这一行，判断当前用户有没有赞过
           (SELECT COUNT(*) FROM comment_like cl WHERE cl.comment_id = vc.comment_id AND cl.user_id = #{userId}) AS my_liked
    FROM video_comment vc
    LEFT JOIN user_information u ON vc.user_id = u.user_id
    WHERE vc.video_id=#{videoId}
    """)
    List<Map<String,Object>> selectCommentsById(@Param("videoId") long videoId, @Param("userId") String userId);
    //删除我的评论
    @Delete("""
    DELETE FROM video_comment WHERE user_id=#{myUserId} AND video_id=#{videoId} AND comment_id=#{commentId}
    """)
    int deleteSelfComment(@Param("myUserId") String myUserId,
                          @Param("videoId")  long videoId,
                          @Param("commentId") String commentId);
    //修改我的评论
    @Update("""
    UPDATE video_comment SET contents=#{newContent} WHERE comment_id=#{commentId} AND user_id=#{myUserId}
    """)
    int editSelfComment(@Param("newContent") String newContent,
                        @Param("commentId")  String commentId,
                        @Param("myUserId")   String myUserId);
    //对video_id为videoId的视频增添我的评论（parentId 传 null 表示一级评论）
    @Insert("""
    INSERT INTO video_comment(comment_id, video_id, user_id, contents, parent_id)
    VALUES(#{commentId}, #{videoId}, #{userId}, #{content}, #{parentId})
    """)
    int addComment(@Param("commentId")  String commentId,
                   @Param("videoId")    long videoId,
                   @Param("userId")     String userId,
                   @Param("content")    String content,
                   @Param("parentId")   String parentId);
    //查某条评论下的全部回复（楼中楼）
    @Select("""
    SELECT vc.comment_id, vc.user_id, vc.contents, vc.create_time,
           u.nickname AS commenter, u.avatar AS commenter_avatar
    FROM video_comment vc
    LEFT JOIN user_information u ON vc.user_id = u.user_id
    WHERE vc.parent_id = #{parentId}
    ORDER BY vc.create_time ASC
    """)
    List<Map<String,Object>> selectRepliesByParent(@Param("parentId") String parentId);
    //***********************************************************点赞模块***********************************************************
    /**
     * 点赞一律以 video_like 表为唯一口径（一条记录 = 一次点赞）：
     * 联合主键 (video_id, user_id) 保证一人一视频只能赞一次。
     * 播放计数正在打算实现！
     * 所以重复点赞不会产生脏数据，也不需要 video.like_quantity 这个冗余计数列。
     * 删视频时该表的记录由外键 ON DELETE CASCADE 自动清理。
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     */

    //视频是否存在（点赞前先校验，避免外键异常返回 500）
    @Select("""
    SELECT COUNT(*) FROM video WHERE id=#{id}
    """)
    int countVideo(@Param("id") long id);

    //点赞：INSERT IGNORE 让重复点赞静默忽略，返回 1=新点赞，0=之前已经赞过
    @Insert("""
    INSERT IGNORE INTO video_like(video_id, user_id) VALUES(#{id}, #{userId})
    """)
    int addLike(@Param("id") long id, @Param("userId") String userId);

    //取消点赞：返回 1=取消成功，0=本来就没赞过
    @Delete("""
    DELETE FROM video_like WHERE video_id=#{id} AND user_id=#{userId}
    """)
    int cancelLike(@Param("id") long id, @Param("userId") String userId);

    //显示点赞数（聚合 video_like，与列表口径完全一致）
    @Select("""
    SELECT COUNT(*) FROM video_like WHERE video_id=#{id}
    """)
    long selectLikeQuantity(@Param("id") long id);

    //当前用户是否赞过这个视频（>0 表示已赞）
    @Select("""
    SELECT COUNT(*) FROM video_like WHERE video_id=#{id} AND user_id=#{userId}
    """)
    int selectMyLike(@Param("id") long id, @Param("userId") String userId);
    //播放计数加一（只做一次 UPDATE，新值请调 selectViewCount 回读）
    @Update("""
    UPDATE video SET view_count=view_count+1 WHERE id=#{id}
    """)
    int addVideoView(@Param("id") long id);

    //回读当前播放量（配合 addVideoView 使用，返回真实数值而非受影响行数）
    @Select("SELECT view_count FROM video WHERE id=#{id}")
    Long selectViewCount(@Param("id") long id);
    /**
     * 添加收藏功能
     * 2026/10/13/09:45
     *
     *
     -- 为避免出现未知bug，本收藏夹数据库由AI生成
     -- 1. 收藏夹本体：一人可建多个
     CREATE TABLE IF NOT EXISTS playlist(
     playlist_id        VARCHAR(13)  NOT NULL,               -- 收藏夹ID，RandomlyCreateID 13位字符串，前端 randId() 生成
     user_id            VARCHAR(13)  NOT NULL,               -- 归属人（谁能改名/删除/加视频）
     name               VARCHAR(100) NOT NULL,               -- 收藏夹名称
     description        VARCHAR(500) NULL,                   -- 简介，可空
     is_public          TINYINT(1)   NOT NULL DEFAULT 1,     -- 1=公开（他人可见） 0=仅自己可见
     create_time        DATETIME     DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY        (playlist_id),
     UNIQUE KEY uk_playlist_name (user_id, name),     -- 同一人不允许两个同名收藏夹，查询也更友好
     KEY idx_playlist_user (user_id, create_time),    -- "我的收藏夹列表"按创建时间走索引
     CONSTRAINT fk_playlist_user FOREIGN KEY (user_id)
     REFERENCES user_information(user_id) ON DELETE CASCADE
     ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

     -- 2. 收藏夹内容：一条记录 = 一次收藏（多对多中间表，与 video_like/subscription 同构）
     CREATE TABLE IF NOT EXISTS playlist_video(
     playlist_id        VARCHAR(13) NOT NULL,                -- 属于哪个收藏夹
     video_id           BIGINT      NOT NULL,                -- 收藏了哪条视频（video.id 是 BIGINT，这里必须同为 BIGINT）
     create_time        DATETIME    DEFAULT CURRENT_TIMESTAMP, -- 收藏时间，支持"最近收藏优先"排序
     PRIMARY KEY        (playlist_id, video_id),             -- 联合主键 = 同一收藏夹里一个视频只能出现一次
     KEY idx_pv_video (video_id, playlist_id),        -- 反查"这视频被哪些收藏夹收了"
     CONSTRAINT fk_pv_playlist FOREIGN KEY (playlist_id)
     REFERENCES playlist(playlist_id) ON DELETE CASCADE,   -- 删收藏夹，内容跟着没
     CONSTRAINT fk_pv_video FOREIGN KEY (video_id)
     REFERENCES video(id) ON DELETE CASCADE                -- 删视频，所有收藏夹里的引用自动清
     ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
     *
     *
     *
     *
     * **/
    ////建立收藏夹，不是把视频放进收藏夹里，因为收藏夹还没创建呢！
    @Insert("""
    INSERT INTO playlist(playlist_id,user_id,name,description,is_public) values
                (#{pList},#{userId},#{name},#{description},#{isPublic})
    """)
    int createLikeFormat(@Param("pList")       String pList,
                         @Param("userId")      String userId,
                         @Param("name")        String name,
                         @Param("description") String description,
                         @Param("isPublic")    int isPublic
    );
    //把视频放进收藏夹里
    @Insert("""
    INSERT IGNORE INTO playlist_video(playlist_id,video_id) values(#{pList},#{videoId})
    """)
    int addToLikeList(@Param("pList")  String pList,

                      @Param("videoId")long videoId);
    //取消收藏
    @Delete("""
    DELETE FROM playlist where playlist_id=#{pList} and user_id=#{userId}
    """)
    int deleteLike(@Param("pList") String pList,
                   @Param("userId") String userId);
    //从收藏夹里移出一个视频（deleteLike 是整个收藏夹没了，这个是单条移出）
    @Delete("""
    DELETE FROM playlist_video where playlist_id=#{pList} and video_id=#{videoId}
    """)
    int removeFromLikeList(@Param("pList") String pList, @Param("videoId") long videoId);

    //切换收藏夹可见性：WHERE 带 user_id，只能改自己的；返回 0=夹子不存在或无权限
    @Update("""
    UPDATE playlist SET is_public=#{isPublic} where playlist_id=#{pList} and user_id=#{userId}
    """)
    int updateLikeFormatPublic(@Param("pList") String pList,
                               @Param("userId") String userId,
                               @Param("isPublic") int isPublic);

    /**
     * 某人的收藏夹列表（前端收藏弹窗 + 频道页收藏夹标签用）：
     * 自己的全部可见；别人的只看公开（is_public=1）。
     * video_count=夹内视频数；in_list=当前这条视频是否已在该夹（收藏按钮回显，EXISTS 子查询）。
     * DATE_FORMAT 防 Map 序列化时间戳，与私信收件箱同款处理。
     */
    @Select("""
    SELECT p.playlist_id, p.name, p.description, p.is_public,
           DATE_FORMAT(p.create_time, '%Y-%m-%d %H:%i:%S') AS create_time,
           COUNT(pv.video_id) AS video_count,
           EXISTS(SELECT 1 FROM playlist_video x
                   WHERE x.playlist_id = p.playlist_id AND x.video_id = #{videoId}) AS in_list
    FROM playlist p
    LEFT JOIN playlist_video pv ON pv.playlist_id = p.playlist_id
    WHERE p.user_id = #{owner} AND (p.is_public = 1 OR p.user_id = #{viewer})
    GROUP BY p.playlist_id, p.name, p.description, p.is_public, p.create_time
    ORDER BY p.create_time DESC
    """)
    List<Map<String,Object>> selectLikeFormats(@Param("owner") String owner,
                                               @Param("viewer") String viewer,
                                               @Param("videoId") long videoId);

    //某个收藏夹里的视频（收藏夹详情页用）
    @Select("""
    SELECT v.id, v.user_id, v.title, v.video_path, v.view_count,
           DATE_FORMAT(pv.create_time, '%Y-%m-%d %H:%i:%S') AS fav_time
    FROM playlist_video pv
    JOIN video v ON v.id = pv.video_id
    WHERE pv.playlist_id = #{pList}
    ORDER BY pv.create_time DESC
    """)
    List<Map<String,Object>> selectLikeFormatVideos(@Param("pList") String pList);
    //清空某个文件夹
    @Delete("""
    DELETE FROM playlist WHERE playlist_id=#{pList}
    """)
    int clearLikeList(@Param("pList") String pList);

    /**
     *
     * 新消息通知表
     *
     *
     * CREATE TABLE IF NOT EXISTS notification(
     *     notify_id   VARCHAR(13)  NOT NULL,               -- RandomlyCreateID / 前端 randId()
     *     to_user     VARCHAR(13)  NOT NULL,               -- 通知给谁（作品主人 / 被回复者）
     *     from_user   VARCHAR(13)  NOT NULL,               -- 谁触发的
     *     type        VARCHAR(16)  NOT NULL,               -- like / comment / reply / favorite / follow
     *     video_id    BIGINT       NULL,                   -- 相关视频（关注类为 NULL）
     *     comment_id  VARCHAR(13)  NULL,                   -- 相关评论（点赞/关注类为 NULL）
     *     ref_id      VARCHAR(13)  NULL,                   -- 兜底：动态ID等
     *     contents    VARCHAR(200) NULL,                   -- 摘要，如"赞了你的视频《xxx》"或评论前 50 字
     *     is_read     TINYINT(1)   NOT NULL DEFAULT 0,
     *     create_time DATETIME     DEFAULT CURRENT_TIMESTAMP,
     *     PRIMARY KEY (notify_id),
     *     KEY idx_nt_inbox (to_user, is_read, create_time),   -- 收件箱 + 未读数，与私信同款
     *     CONSTRAINT fk_nt_to   FOREIGN KEY (to_user)
     *         REFERENCES user_information(user_id) ON DELETE CASCADE,
     *     CONSTRAINT fk_nt_from FOREIGN KEY (from_user)
     *         REFERENCES user_information(user_id) ON DELETE CASCADE
     * ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
     *
     *
     * **/


    //我的通知列表：最新在前，带触发人昵称头像、摘要、未读标记
    @Select("""
    SELECT n.notify_id, n.type, n.video_id, n.comment_id, n.contents, n.is_read,
           DATE_FORMAT(n.create_time, '%Y-%m-%d %H:%i:%S') AS create_time,
           u.user_id AS from_user, u.nickname, u.avatar
    FROM notification n
    JOIN user_information u ON u.user_id = n.from_user
    WHERE n.to_user = #{me}
    ORDER BY n.create_time DESC
    LIMIT #{size} OFFSET #{offset}
    """)
    List<Map<String, Object>> selectMyNotifications(@Param("me")     String me,
                                                    @Param("size")   int size,
                                                    @Param("offset") int offset);


    //***********************************************************消息通知模块***********************************************************
    /**
     *
     * 新增消息功能
     * 2026/10/14/23:00
     *
     *
     *
     *
     *
     * **/
    //写入一条通知（通知失败不应影响主业务，Service 层用 try-catch 包住）
    @Insert("""
    INSERT INTO notification(notify_id,to_user,from_user,type,video_id,comment_id,contents)
    VALUES(#{notifyId},#{toUser},#{fromUser},#{type},#{videoId},#{commentId},#{contents})
    """)
    int insertNotify(@Param("notifyId")  String notifyId,
                     @Param("toUser")    String toUser,
                     @Param("fromUser")  String fromUser,
                     @Param("type")      String type,
                     @Param("videoId")   Long videoId,
                     @Param("commentId") String commentId,
                     @Param("contents")  String contents)    ;

    //查视频作者与标题（点赞/收藏通知要用）
    @Select("SELECT user_id, title FROM video WHERE id=#{id}")
    Map<String,Object> selectVideoOwner(@Param("id") long id);

    //查某条评论的作者（回复了你的评论->要通知被回复的人，不是视频作者）
    @Select("SELECT user_id FROM video_comment WHERE comment_id=#{commentId}")
    String selectCommentOwner(@Param("commentId") String commentId);

    /**
     * 截止2026/10/15/20:17，此设计有通知已读后不会消失通知红点，而是继续存在。这是一个已知的bug。
     * deepseek给我的提示是is_read永远没有改变，需要一个@Update使之置1（0表示未读，1表示已读）
     *
     * **/

    //消除未读的通知红点：把发给我的所有未读通知标记为已读
    @Update("""
    UPDATE notification SET is_read=1
    WHERE to_user=#{me} AND is_read=0
    """)
    int readAndRemoveRedDot(@Param("me") String me);


    //新增封面功能，添加封面
    @Update("""
    UPDATE video SET cover_path=#{coverPath} WHERE id=#{id} AND user_id=#{userId}
    """)
    int updateCover(@Param("coverPath") String coverPath,
                    @Param("id") long id,
                    @Param("userId") String userId);
    //新增观看历史功能，可查询和删除，此处为查询观看历史，一次查询分200条数据，防止因数据过多而查询变慢
    /**
     * CREATE TABLE IF NOT EXISTS watch_history (
     *       user_id     VARCHAR(13) NOT NULL,               -- 谁看的
     *       video_id    BIGINT      NOT NULL,               -- 看了哪条视频（video.id 是 BIGINT，这里必须同为 BIGINT）
     *       watch_time  DATETIME    DEFAULT CURRENT_TIMESTAMP, -- 最近一次观看时间
     *       PRIMARY KEY (user_id, video_id),                -- 联合主键 = 同一用户同一视频只保留一条
     *       KEY idx_wh_user_time (user_id, watch_time DESC),-- 我的历史按时间倒序走索引
     *       KEY idx_wh_video (video_id),                    -- 反查这视频被谁看过（可选，但留着有用）
     *       CONSTRAINT fk_wh_user FOREIGN KEY (user_id)
     *           REFERENCES user_information(user_id) ON DELETE CASCADE,
     *       CONSTRAINT fk_wh_video FOREIGN KEY (video_id)
     *           REFERENCES video(id) ON DELETE CASCADE      -- 删视频，历史里的引用自动清
     * ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
     * **/
    @Select("""
    SELECT h.video_id,
           h.watch_time,
           v.title,
           v.video_path,
           v.cover_path,
           v.view_count,
           -- 删除冗余列
           (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) AS like_count,
           v.create_time,
           u.nickname AS uploader
    FROM watch_history h
    LEFT JOIN video v            ON h.video_id = v.id
    LEFT JOIN user_information u ON v.user_id  = u.user_id
    WHERE h.user_id = #{userId}
    ORDER BY h.watch_time DESC
    LIMIT 200
    """)
    List<Map<String,Object>> selectHistory(@Param("userId") String userId);

    //上传我看过的视频，自动上传，看过视频后就可以在历史区块里查找此视频
    @Insert("""
    INSERT INTO watch_history(user_id, video_id, watch_time)
    VALUES(#{userId}, #{videoId}, NOW())
    ON DUPLICATE KEY UPDATE watch_time = NOW()
     """)
    int insertHistory(@Param("userId") String userId,@Param("videoId") long videoId);


    /************************************************设计短视频模块***********************************************************/
    /**
     *
     * 2026/10/17/10:02
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     *
     */
    //看短视频
    @Select("""
    SELECT v.id, v.user_id, v.title, v.video_path, v.cover_path,
           v.view_count, v.duration_sec, v.create_time,
           (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) AS like_count,
           (SELECT COUNT(*) FROM video_comment vc WHERE vc.video_id = v.id) AS comment_count,
           u.nickname AS uploader, u.avatar AS uploader_avatar,
               CONCAT('/videos/', SUBSTRING_INDEX(SUBSTRING_INDEX(v.video_path, CHAR(92), -1), '/', -1)) AS play_url
    FROM video v
    LEFT JOIN user_information u ON v.user_id = u.user_id
    WHERE v.is_short = 1
    ORDER BY (v.view_count * 0.3 +
              (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) * 0.7) DESC,
             v.create_time DESC
    LIMIT #{size} OFFSET #{offset}

    """)
    List<Map<String,Object>> selectShortFeed(@Param("size") int size, @Param("offset") int offset);
    /**
     * 评论区点赞，在视频 id为id的情况下点赞此评论
     * 2026/10/19/14:15
     *
     *-- 评论区点赞，本人给他点赞
     * CREATE TABLE IF NOT EXISTS comment_like(
     *     user_id     VARCHAR(13) NOT NULL,   -- 谁点的赞
     *     comment_id  VARCHAR(13) NOT NULL,   -- 赞了哪条评论
     *     create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
     *     PRIMARY KEY (user_id, comment_id),   -- 一人一评论只能赞一次
     *     CONSTRAINT fk_cl_user    FOREIGN KEY (user_id)    REFERENCES user_information(user_id) ON DELETE CASCADE,
     *     CONSTRAINT fk_cl_comment FOREIGN KEY (comment_id) REFERENCES video_comment(comment_id) ON DELETE CASCADE
     * );
     *
     *
     *
     * **/
    //点赞：插入一条 (user_id, comment_id)。联合主键保证同一人同一评论只能赞一次，
    //重复点赞会抛 DuplicateKeyException，由 Service 捕获处理。
    @Insert("""
    INSERT INTO comment_like(user_id, comment_id) VALUES(#{me}, #{commentId})
    """)
    int addCommentLike(@Param("me") String me, @Param("commentId") String commentId);

    // 取消点赞：删掉那一行，返回1=成功取消，0=本来就没赞过
    @Delete("""
    DELETE FROM comment_like WHERE user_id=#{me} AND comment_id=#{commentId}
    """)
    int removeCommentLike(@Param("me") String me, @Param("commentId") String commentId);

    // 某条评论的赞数
    @Select("SELECT COUNT(*) FROM comment_like WHERE comment_id=#{commentId}")
    int countCommentLikes(@Param("commentId") String commentId);

    // 我赞没赞过这条（前端按钮实心/空心）
    @Select("SELECT COUNT(*) FROM comment_like WHERE user_id=#{me} AND comment_id=#{commentId}")
    int likedByMe(@Param("me") String me, @Param("commentId") String commentId);
    /**
     * 评论区的点赞通知
     * 2026/10/20/11:11
     * Kitaajya
     *
     * **/
    // 查评论的作者、所属视频ID、评论内容（用于发点赞通知）
    @Select("SELECT user_id, video_id, contents FROM video_comment WHERE comment_id = #{commentId}")
    Map<String, Object> selectCommentInfoForNotify(@Param("commentId") String commentId);
}
