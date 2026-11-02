package org.designer.youtube.entity;

import lombok.Data;

import java.io.File;

@Data
public class Video{
    //视频标题
    private String title;
    //标签 不止一个
    private String[] tag;
    //视频评论，不止一个
    private String[] comments;
    //点赞量
    private int quantity;
    //视频文件
    private String videoPath;  //"D:/videos/我的视频.mp4"
    /**
     * 获取视频文件的MIME类型（自动识别）
     */
    public String getMimeType() {
        if (videoPath == null) return null;
        String fileName = new File(videoPath).getName();
        String extension = fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
        //常见视频格式映射
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
                return "application/octet-stream";  //未知类型当作二进制流
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