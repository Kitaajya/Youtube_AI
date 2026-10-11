package org.designer.youtube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "dynamic")
public class Dynamic {
    @Id
    @Column(name = "myid")
    private String myid;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "create_time")
    private LocalDateTime createTime;
}
