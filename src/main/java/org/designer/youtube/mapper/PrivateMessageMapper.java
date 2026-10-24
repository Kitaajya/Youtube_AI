package org.designer.youtube.mapper;

import org.apache.ibatis.annotations.*;
import org.designer.youtube.entity.PrivateMessage;

import java.util.List;
import java.util.Map;

public interface PrivateMessageMapper {

    // 展示我和某人的完整对话，双向，按时间正序
    @Select("""
    SELECT msg_id       AS msgId,
           from_user    AS fromUser,
           to_user      AS toUser,
           contents,
           is_read      AS isRead,
           is_withdrawn AS isWithdrawn,
           from_deleted AS fromDeleted,
           msg_type     AS msgType,
           media_path   AS mediaPath,
           create_time  AS createTime
    FROM private_message
    WHERE ((from_user=#{a} AND to_user=#{b}) OR (from_user=#{b} AND to_user=#{a}))
      AND NOT (from_user=#{a} AND from_deleted = 1)
    ORDER BY create_time
    """)
    List<PrivateMessage> selectOurMessage(@Param("a") String a, @Param("b") String b);

    // 我发送私信（msgId 由 Service 调RandomlyCreateID填好再传进来）
    @Insert("""
    INSERT INTO private_message(msg_id, from_user, to_user, contents, is_read)
    VALUES(#{msgId}, #{fromUser}, #{toUser}, #{contents}, 0)
    """)
    int send(PrivateMessage privateMessage);

    // 我的收件箱未读数（配合 idx_pm_inbox(to_user,is_read,...) 索引）
    @Select("SELECT COUNT(*) FROM private_message WHERE to_user=#{me} AND is_read=0 AND is_withdrawn=0")
    int countUnread(@Param("me") String me);

    // 把某人发给我的消息标记已读
    @Update("""
    UPDATE private_message SET is_read=1
    WHERE to_user=#{me} AND from_user=#{other} AND is_read=0
    """)
    int markRead(@Param("me") String me, @Param("other") String other);

    // 我的会话列表：每个对话一行（最后一条消息 + 对方昵称 + 未读数），MySQL 8 窗口函数
    // 时间用 DATE_FORMAT 输出字符串，避免 Map 返回时 Timestamp 被序列化成毫秒数
    @Select("""
    SELECT t.peer AS peerId,
           u.nickname AS peerName,
           t.contents AS lastMsg,
           DATE_FORMAT(t.create_time, '%Y-%m-%d %H:%i:%S') AS lastTime,
           (SELECT COUNT(*) FROM private_message p2
             WHERE p2.to_user=#{me} AND p2.from_user=t.peer AND p2.is_read=0 AND p2.is_withdrawn=0) AS unread
    FROM (
        SELECT CASE WHEN from_user=#{me} THEN to_user ELSE from_user END AS peer,
               CASE WHEN is_withdrawn=1 THEN '[已撤回]'
                    WHEN msg_type='image' THEN '[图片]'
                    WHEN msg_type='video' THEN '[视频]'
                    WHEN msg_type='emoji' THEN '[表情]'
                    ELSE contents END AS contents,
               create_time,
               ROW_NUMBER() OVER (PARTITION BY CASE WHEN from_user=#{me} THEN to_user ELSE from_user END
                                 ORDER BY create_time DESC, msg_id DESC) AS rn
        FROM private_message
        WHERE (from_user=#{me} OR to_user=#{me})
          AND NOT (from_user=#{me} AND from_deleted = 1)
    ) t
    LEFT JOIN user_information u ON u.user_id = t.peer
    WHERE t.rn = 1
    ORDER BY t.create_time DESC
    """)
    List<Map<String, Object>> selectInbox(@Param("me") String me);
    //从我这里删除发出的信息，但是对方依旧能看得到。因为这不是撤回操作，软删除
    @Update("""
    UPDATE private_message
       SET from_deleted = 1
     WHERE msg_id = #{msgId}
       AND from_user = #{userId}
    """)
    int deleteFromMySide(@Param("msgId") String msgId, @Param("userId") String userId);
    //撤回操作，规定timeWithdraw秒的时间内可以撤回信息，通常地，timeWithdraw==120s
    //仅发送方本人、且发送时间在timeWithdraw秒内可撤回。撤回后正文清空，双方聊天记录显示"消息已撤回"
    @Update("""
    UPDATE private_message
       SET is_withdrawn = 1,
           contents     = '',
           msg_type     = 'text',
           media_path   = NULL
     WHERE msg_id    = #{msgId}
       AND from_user = #{userId}
       AND is_withdrawn = 0
       AND create_time >= DATE_SUB(NOW(), INTERVAL #{timeWithdraw} SECOND)
    """)
    int withdraw(@Param("msgId")        String msgId,
                 @Param("userId")       String userId,
                 @Param("timeWithdraw") int timeWithdraw);
    //私信功能要求不仅仅是可以互相发送文字，还可以发送视频与图片
    @Insert("""
    INSERT INTO private_message(msg_id, from_user, to_user, contents, is_read, msg_type, media_path)
    VALUES(#{msgId}, #{fromUser}, #{toUser}, '', 0, #{msgType}, #{mediaPath})
    """)
    int sendPictureOrVideo(PrivateMessage privateMessage);
    //发送表情包（msgType固定emoji，mediaPath存emoji_item里的 file_name）
    @Insert("""
    INSERT INTO private_message(msg_id, from_user, to_user, contents, is_read, msg_type, media_path)
    VALUES(#{msgId}, #{fromUser}, #{toUser}, '', 0, 'emoji', #{mediaPath})
    """)
    int sendEmoji(PrivateMessage privateMessage);
    //查看表情包（前端选择器用：只取上架的，按套图和排序展示）
    @Select("""
    SELECT emoji_id  AS emojiId,
           name,
           file_name AS fileName,
           pack,
           sort_no   AS sortNo
    FROM emoji_item
    WHERE enabled = 1
    ORDER BY pack, sort_no, emoji_id
    """)
    List<Map<String, Object>> selectEmojiList();
    //撤回表情包无需单独方法：通用 withdraw 按 msg_id 匹配、与 msg_type 无关，
    //会把 msg_type 重置回 text、media_path 清空，表情/图片/视频/文字均复用同一条 SQL。
    //表情包白名单
    @Select("SELECT COUNT(*) FROM emoji_item WHERE file_name = #{fileName} AND enabled = 1")
    int countEnabledEmoji(@Param("fileName") String fileName);
    /**表情包分析，把表情包数据库塞给AI**/
    @Select("""
    SELECT * FROM emoji_item
    """)
    List<Map<String,Object>> getPrivateMessageEmojiForDeepSeek();
    /**
     * 建立一个三人以上的群聊
     * 2026/10/23/20:53
     *
     * 群聊数据库：
     *  chat_group
            字段名	     类型	     作用	            设计亮点
            group_id	VARCHAR(13)	群号（主键）	延续了你项目 13 位随机字符串的规范，比自增数字更安全，防爬防遍历。
            group_name	VARCHAR(50)	群名称	限制 50 字符，防止有人起超长名字把前端 UI 撑爆。
            owner_id	VARCHAR(13)	群主ID	记录这个群是谁建的，方便后续做“解散群”、“踢人”等权限控制。
            create_time	DATETIME	建群时间	默认当前时间，方便按建群时间倒序排列“我最近加了什么群”。
     * **/
    //建群
    @Insert("""
    INSERT INTO chat_group(group_id, group_name, owner_id) 
    VALUES(#{groupId}, #{groupName}, #{ownerId})
    """)
    int establishGroup(@Param("groupId") String groupId,@Param("groupName") String groupName,@Param("ownerId") String ownerId);
    //在一个已建好的群里拉进来一个人
    @Insert("""
    INSERT IGNORE INTO group_member(group_id,user_id) VALUES (#{groupId},#{userId})
    """)
    int addGroupMember(@Param("groupId") String groupId,@Param("userId") String userId);
    //查询群主号
    @Select(""" 
    SELECT owner_id FROM chat_group WHERE group_id = #{groupId}
    """)
    String selectGroupOwner(@Param("groupId") String groupId);
    //踢人，只有群主能踢
    @Delete("""
    DELETE FROM group_member WHERE group_id=#{groupId} AND user_id=#{userId}
    """)
    int removeGroupMember(@Param("groupId")String groupId,@Param("userId")String userId);
    //查看群聊消息
     @Select("""
    SELECT gm.msg_id, gm.group_id, gm.from_user, 
           u.nickname AS senderName, 
           gm.contents, gm.msg_type, gm.media_path,
           DATE_FORMAT(gm.create_time, '%Y-%m-%d %H:%i:%s') AS create_time,
           u.avatar AS senderAvatar
    FROM group_message gm
    LEFT JOIN user_information u ON gm.from_user = u.user_id
    WHERE gm.group_id = #{groupId}
    ORDER BY gm.create_time ASC
    """)
    List<Map<String,Object>> selectGroupMessage(@Param("groupId") String groupId);
    // 向群聊中发消息
    @Insert("""
    INSERT IGNORE INTO group_message(msg_id, group_id, from_user, contents, msg_type, media_path)
    VALUES(#{msgId}, #{groupId}, #{fromUser}, #{contents}, #{msgType}, #{mediaPath})
    """)
    int sendMessageToGroup(
            @Param("msgId")     String msgId,
            @Param("groupId")   String groupId,
            @Param("fromUser")  String fromUser,
            @Param("contents")  String contents,
            @Param("msgType")   String msgType,
            @Param("mediaPath") String mediaPath
    );
    //查看我们的群聊
    //查询我加入的所有群（根据 group_member 表联查 chat_group）
    @Select("""
    SELECT g.group_id    AS groupId, 
           g.group_name  AS groupName, 
           g.owner_id    AS ownerId,
           DATE_FORMAT(g.create_time, '%Y-%m-%d %H:%i:%S') AS createTime
    FROM chat_group g
    INNER JOIN group_member gm ON g.group_id = gm.group_id
    WHERE gm.user_id = #{me}
    ORDER BY g.create_time DESC
    """)
    List<Map<String, Object>> selectMyGroups(@Param("me") String me);
}