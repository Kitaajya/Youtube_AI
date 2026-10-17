package org.designer.youtube.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.designer.youtube.entity.PrivateMessage;

import java.util.List;
import java.util.Map;

public interface PrivateMessageMapper {

    // 展示我和某人的完整对话，双向，按时间正序
    @Select("""
    SELECT msg_id      AS msgId,
           from_user   AS fromUser,
           to_user     AS toUser,
           contents,
           is_read     AS isRead,
           create_time AS createTime
    FROM private_message
    WHERE (from_user=#{a} AND to_user=#{b}) OR (from_user=#{b} AND to_user=#{a})
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
    @Select("SELECT COUNT(*) FROM private_message WHERE to_user=#{me} AND is_read=0")
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
             WHERE p2.to_user=#{me} AND p2.from_user=t.peer AND p2.is_read=0) AS unread
    FROM (
        SELECT CASE WHEN from_user=#{me} THEN to_user ELSE from_user END AS peer,
               contents, create_time,
               ROW_NUMBER() OVER (PARTITION BY CASE WHEN from_user=#{me} THEN to_user ELSE from_user END
                                 ORDER BY create_time DESC, msg_id DESC) AS rn
        FROM private_message
        WHERE from_user=#{me} OR to_user=#{me}
    ) t
    LEFT JOIN user_information u ON u.user_id = t.peer
    WHERE t.rn = 1
    ORDER BY t.create_time DESC
    """)
    List<Map<String, Object>> selectInbox(@Param("me") String me);
}