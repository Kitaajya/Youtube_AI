package org.designer.youtube.entity;

import lombok.Data;
import org.springframework.context.annotation.Bean;

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
    private LocalDateTime createTime;
}