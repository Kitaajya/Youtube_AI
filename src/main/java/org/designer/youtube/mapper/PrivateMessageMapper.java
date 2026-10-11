package org.designer.youtube.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.designer.youtube.entity.PrivateMessage;

import java.util.List;

public interface PrivateMessageMapper {

    // 展示我和某人的完整对话，双向，按时间正序
    @Select("""
    SELECT * FROM private_message
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
}