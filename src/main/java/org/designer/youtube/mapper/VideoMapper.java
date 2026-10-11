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
    INSERT INTO video(user_id,title,video_path) VALUES(#{userId},#{title},#{videoPath})
    """)
    int uploadVideo(@Param("userId") String userId,
                    @Param("title") String title,
                    @Param("videoPath") String videoPath);

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
    @Select("""
    SELECT v.id, v.user_id, v.title, v.video_path, v.create_time, v.view_count,
           (SELECT COUNT(*) FROM video_like vl WHERE vl.video_id = v.id) AS like_count,
           u.nickname AS uploader, u.avatar AS uploader_avatar
    FROM video v
    LEFT JOIN user_information u ON v.user_id = u.user_id
    WHERE v.id=#{id}
    """)
    List<Map<String,Object>> selectVideoById(@Param("id")long id);
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

    //查看此视频的所有评论，根据id（视频id）
    @Select("""
    SELECT * FROM video_comment WHERE video_id=#{videoId}
    """)
    List<Map<String,Object>> selectCommentsById(@Param("videoId") long videoId);
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
     * 联合主键 (video_id, user_id) 保证一人一视频只能赞一次，
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

}
