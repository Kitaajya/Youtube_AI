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
    INSERT INTO private_message(msg_id, from_user, to_user, contents, is_read, msg_type)
    VALUES(#{msgId}, #{fromUser}, #{toUser}, #{contents}, 0, #{msgType})
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
    // 顺带把"对端"的昵称和头像 JOIN 出来：对端是动态的（我是发件人时是 to_user，
    // 否则是 from_user），所以 ON 条件里用 IF 判断；前端据此在会话列表显示头像。
    @Select("""
    SELECT pm.from_user AS fromUser, pm.to_user AS toUser, pm.contents, pm.is_read AS isRead, 
           pm.is_withdrawn AS isWithdrawn, pm.from_deleted AS fromDeleted, 
           DATE_FORMAT(pm.create_time, '%Y-%m-%d %H:%i:%S') AS createTime,
           peer.nickname AS peerName,
           peer.avatar   AS peerAvatar
    FROM private_message pm
    LEFT JOIN user_information peer
           ON peer.user_id = IF(pm.from_user = #{me}, pm.to_user, pm.from_user)
    WHERE (pm.from_user=#{me} OR pm.to_user=#{me})
      AND NOT (pm.from_user=#{me} AND pm.from_deleted = 1)
    ORDER BY pm.create_time DESC
""")
    List<Map<String, Object>> selectInbox(@Param("me") String me);

    // 查某个人发给我的未读消息数
    @Select("SELECT COUNT(*) FROM private_message WHERE to_user=#{me} AND from_user=#{peer} AND is_read=0 AND is_withdrawn=0")
    int countUnreadFromPeer(@Param("me") String me, @Param("peer") String peer);


    //从我这里删除发出的信息，但是对方依旧能看得到。因为这不是撤回操作，软删除
    @Update("""
    UPDATE private_message
       SET from_deleted = 1
     WHERE msg_id = #{msgId}
       AND from_user = #{userId}
    """)
    int deleteFromMySide(@Param("msgId") String msgId, @Param("userId") String userId);
    /**
     * @since 2026/10/20
     * @author Conan Doyle
     * @功能: 撤回操作，规定timeWithdraw秒的时间内可以撤回信息，通常地，timeWithdraw==120s
     * 仅发送方本人、且发送时间在timeWithdraw秒内可撤回。撤回后正文清空，双方聊天记录显示"消息已撤回"**/
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
     *
     * @since 2026/10/23/20:53
     * @描述 建立一个三人以上的群聊
     * @数据表 chat_group
     * **/
    //建群
    @Insert("""
    INSERT INTO chat_group(group_id, group_name, owner_id) 
    VALUES(#{groupId}, #{groupName}, #{ownerId})
    """)
    int establishGroup(@Param("groupId") String groupId,@Param("groupName") String groupName,@Param("ownerId") String ownerId);
    //在一个已建好的群里拉进来一个人
    //取消了ignore，Service层用于查重抛出异常
    @Insert("""
    INSERT INTO group_member(group_id,user_id) VALUES (#{groupId},#{userId})
    """)
    int addGroupMember(@Param("groupId") String groupId,@Param("userId") String userId);
    //查询群名称（发入群邀请通知时拼文案用）
    @Select("SELECT group_name FROM chat_group WHERE group_id = #{groupId}")
    String selectGroupName(@Param("groupId") String groupId);
    //校验用户是否真实存在（拉人前防脏数据：group_member 与 notification 都引用 user_information）
    @Select("SELECT COUNT(*) FROM user_information WHERE user_id = #{userId}")
    int countUser(@Param("userId") String userId);
    //写入一条“群聊邀请”通知：ref_id 存 groupId，供前端点击精确跳转到对应群
    @Insert("""
    INSERT INTO notification(notify_id,to_user,from_user,type,ref_id,contents)
    VALUES(#{notifyId},#{toUser},#{fromUser},'group_invite',#{groupId},#{contents})
    """)
    int insertGroupInviteNotify(@Param("notifyId") String notifyId,
                                @Param("toUser")   String toUser,
                                @Param("fromUser") String fromUser,
                                @Param("groupId")  String groupId,
                                @Param("contents") String contents);
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
           gm.is_withdrawn AS isWithdrawn,
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

    /**
     * 关于退群与群主转让
     * **/
    //退出群聊（删除成员记录）
    @Delete("""
    DELETE FROM group_member WHERE group_id = #{groupId} AND user_id = #{userId}
    """)
    int exitMyGroup(@Param("groupId") String groupId, @Param("userId") String userId);

    /**寻找新的群主候选人（排除当前要退出的群主，并且绝对排除 AI_BOT）**/
    @Select("""
    SELECT user_id FROM group_member 
    WHERE group_id = #{groupId} 
      AND user_id != #{excludeUserId} 
      AND user_id != 'AI_BOT'
    """)
    List<String> findNewOwnerCandidates(@Param("groupId") String groupId, @Param("excludeUserId") String excludeUserId);

    /**转让群主**/
    @Update("""
    UPDATE chat_group SET owner_id = #{newOwnerId} WHERE group_id = #{groupId}
    """)
    int transferGroupOwner(@Param("groupId") String groupId, @Param("newOwnerId") String newOwnerId);
    /**查看群聊里还有多少人，算上DeepSeek**/
    @Select("SELECT COUNT(*) FROM group_member WHERE group_id = #{groupId}")
    int countGroupMembers(@Param("groupId") String groupId);
    /**删除群的主信息 */
    @Delete("""
    DELETE FROM chat_group WHERE group_id = #{groupId}
    """)
    int deleteChatGroup(@Param("groupId") String groupId);
    /**
     * 删除群里的message
     * **/
    @Delete("""
    DELETE FROM group_message WHERE group_id=#{groupId}
    """)
    int deleteGroupMessage(@Param("groupId")String groupId);
    /**把所有人踢出群**/
    @Delete("""
    DELETE FROM group_member WHERE group_id=#{groupId}
    """)
    int deleteAllMember(@Param("groupId")String groupId);
    /**查看当前群里的成员信息，像微信那样**/
    @Select("""
    SELECT gm.user_id AS user_id, 
           gm.join_time AS join_time, 
           u.nickname AS nickname,
           u.username AS username
    FROM group_member gm
    LEFT JOIN user_information u ON gm.user_id = u.user_id
    WHERE gm.group_id = #{groupId}
    """)
    List<Map<String,Object>> selectMemberInformation(@Param("groupId")String groupId);
    /**
     * 判断用户发送的消息中是否包含违禁词
     * 查出来大于 0 就说明有违禁词
     */
    @Select("""
    SELECT COUNT(*) FROM prohibit_words 
    WHERE #{content} LIKE CONCAT('%', message, '%')
    """)
    int findProhibitedWords(@Param("content") String content);
    /**
     * @since  2026/10/31/19:08
     * @描述 如果今天是我的生日，那么DeepSeek也得主动私信我为我祝福。
     * 本接口主要实现DeepSeek主动发送私信的功能
     * **/
    @Insert("""
         INSERT IGNORE INTO private_message (msg_id, from_user, to_user, contents, msg_type)
         VALUES (#{msgId}, 'AI_BOT', #{toUser}, #{contents}, 'text')
     """)
    int insertDeepSeekPrivateMessage(@Param("msgId") String msgId,
                                     @Param("toUser") String toUser,
                                     @Param("contents") String contents);

    /**
     * 查询今天AI_BOT是否给该用户发过生日祝福，用于防重发。
     * 如果不加这个判断，那么每次刷新的时候总会发送祝福，这不是我们想要的
     */
    @Select("""
    SELECT COUNT(*) FROM private_message 
    WHERE from_user = 'AI_BOT' 
      AND to_user = #{userId} 
      AND contents LIKE '%生日%' 
      AND DATE(create_time) = CURDATE()
    """)
    int countTodayAiBdayMsg(@Param("userId") String userId);

    /**
     * @since 2026/11/05/20:21
     * @author Kitaajya/Conan Doyle
     * @功能: 私信屏蔽
     * @table: private_message_block
     * **/
    @Insert("""
    INSERT INTO private_message_block (user_id, blocked_user_id) VALUES (#{userId}, #{blockedUserId})
    ON DUPLICATE KEY UPDATE create_time = create_time
    """)
    //私信屏蔽
    int blockUserInPrivateMessage(@Param("userId") String userId,
                                  @Param("blockedUserId") String blockedUserId);
    //解除私信屏蔽
    @Delete("""
    DELETE FROM private_message_block WHERE user_id = #{userId} AND blocked_user_id = #{blockedUserId}
    """)
    int unblockUserInPrivateMessage(@Param("userId") String userId,
                                    @Param("blockedUserId") String blockedUserId);

    /**
     * @since 2026/11/06/13:47
     * @author Kitaajya/Conan Doyle
     * @功能: 检查接收方是否屏蔽了发送方 (查询 private_message_block 表)**/
    @Select("SELECT COUNT(*) FROM private_message_block WHERE user_id = #{toUser} AND blocked_user_id = #{fromUser}")
    int checkBlockStatus(@Param("toUser") String toUser, @Param("fromUser") String fromUser);

    /**我屏蔽了谁：前端刷新页面后恢复屏蔽状态用**/
    @Select("""
    SELECT blocked_user_id FROM private_message_block WHERE user_id = #{userId}
    """)
    List<String> selectBlockedUserIdsInPrivateMessage(@Param("userId") String userId);

    /**
     * @deprecated
     * */
    @Select("""
    SELECT from_user AS fromUser, to_user AS toUser, contents, is_read AS isRead, 
           is_withdrawn AS isWithdrawn, from_deleted AS fromDeleted, 
           DATE_FORMAT(create_time, '%Y-%m-%d %H:%i:%S') AS createTime
    FROM private_message
    WHERE (from_user=#{me} OR to_user=#{me})
      AND NOT (from_user=#{me} AND from_deleted = 1)
    ORDER BY create_time DESC
    """)
    List<Map<String, Object>> selectInbox_Duplicate(@Param("me") String me);

    /**
     * @since  2026/11/07/15:55
     * @author Conan Doyle
     *
     * @说明: 语音功能预备上线，打算用MP3传输到私信或群聊里
     * @deprecated
     * **/
    int demoMethodOrInterface();

    /**
     * @since 2026/11/10/15:00
     * @功能: 群聊消息撤回。仅发送者本人、发送后 timeWithdraw 秒内、且未撤回过的消息可撤回。
     *        撤回后正文清空、媒体清空、msg_type 重置为 text，前端显示"消息已撤回"。
     * @see #withdraw(String, String, int)
     */
    @Update("""
    UPDATE group_message
       SET is_withdrawn = 1,
           contents     = '',
           msg_type     = 'text',
           media_path   = NULL
     WHERE msg_id       = #{msgId}
       AND from_user    = #{userId}
       AND is_withdrawn = 0
       AND create_time >= DATE_SUB(NOW(), INTERVAL #{timeWithdraw} SECOND)
    """)
    int withdrawGroupMessage(@Param("msgId")        String msgId,
                             @Param("userId")       String userId,
                             @Param("timeWithdraw") int timeWithdraw);

}