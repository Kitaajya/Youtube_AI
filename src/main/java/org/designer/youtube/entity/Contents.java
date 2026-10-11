package org.designer.youtube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Table(name="content_comments")
public class Contents {
    @Column(name="comment_id")
    private String commentId;
    @Column(name="dynamic_id")
    private String dynamicId;
    @Column(name="user_id")
    private String userId;
    @Column(name="parent_id")
    private String parentId;
    @Column(name="contents")
    private String contents;
    @Column(name="create_time")
    private LocalDateTime createTime;
}
