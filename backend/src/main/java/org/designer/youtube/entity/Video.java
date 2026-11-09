package org.designer.youtube.entity;

import lombok.Data;

import java.io.File;
import java.time.LocalDateTime;

/**
 * 视频实体，对应 video 表。
 *
 * @since 2026/10/11
 * @author Kitaajya/Conan Doyle
 * @改动说明: 重构
 */
@Data
public class Video {

    /** 视频ID，自增主键 */
    private Long id;

    /** 上传者用户ID，对应 user_information.user_id */
    private String userId;

    /** 视频标题 */
    private String title;

    /** 视频文件存储路径，如 "D:/videos/我的视频.mp4" */
    private String videoPath;

    /** 封面图片路径 */
    private String coverPath;

    /** 播放量 */
    private Integer viewCount;

    /** 是否短视频：0=否 1=是 */
    private Integer isShort;

    /** 时长（秒） */
    private Integer durationSec;

    /** 是否竖屏：0=否 1=是 */
    private Integer isVertical;

    /** 是否会员专享：0=公开 1=仅该UP主会员可看 */
    private Integer isVipOnly;

    /** 创建时间 */
    private LocalDateTime createTime;

    /* ========== 以下为非表字段，仅供查询时带出，插入/更新时不参与 ========== */

    /** 点赞数（聚合 video_like 得出，不落 video 表） */
    private Long likeCount;

    /** 上传者昵称 */
    private String uploader;

    /** 上传者头像 */
    private String uploaderAvatar;

    /* ============================== 工具方法 ============================== */

    /**
     * 获取视频文件的MIME类型（自动识别）
     */
    public String getMimeType() {
        if (videoPath == null) return null;
        String fileName = new File(videoPath).getName();
        int dot = fileName.lastIndexOf(".");
        if (dot < 0) return "application/octet-stream";
        String extension = fileName.substring(dot + 1).toLowerCase();
        switch (extension) {
            case "mp4":
                return "video/mp4";
            case "avi":
                return "video/x-msvideo";
            case "webm":
                return "video/webm";
            case "mov":
                return "video/quicktime";
            case "flv":
                return "video/x-flv";
            case "mkv":
                return "video/x-matroska";
            default:
                return "application/octet-stream";
        }
    }

    /**
     * 获取文件对象，方便读取
     */
    public File getVideoFile() {
        if (videoPath == null) return null;
        return new File(videoPath);
    }
}