package org.designer.youtube.entity;

import lombok.Data;

import java.time.LocalDateTime;
/**
 *
 *
 * 私信功能，PrivateMessage
 *
 *
 *
 *
 *
 * 2026/10/11/15:50
 *
 *
 *
 *
 *
 *
 * */
@Data
public class PrivateMessage {

    private String msgId;
    private String fromUser;
    private String toUser;
    private String contents;
    private int isRead;
    private int isWithdrawn;   // 0=正常 1=已撤回（前端据此显示"撤回了一条消息"）
    private int fromDeleted;   // 0=正常 1=发送方已单方面删除（查询时直接过滤，不返回给发送方）
    private LocalDateTime createTime;


    private String msgType;    // text / image / video
    private String mediaPath;  // 图片/视频文件名，text 为 null
}