package org.designer.youtube.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 把存放视频的本地目录，映射成一个可以通过网址访问的路径。
 *
 * 背景：数据库 video.video_path 里存的只是"文件在硬盘上的位置"这段文字，
 * 浏览器不能凭本地路径直接读文件，必须走 http 地址，所以需要这里做一次转发。
 *
 * 映射效果（以默认配置为例）：
 *   GET http://localhost:8080/videos/abc.mp4
 *     -> 后端返回 D:/videos/Video_Bilibili_Practice/videos/abc.mp4 的文件内容
 *
 * 目录与前缀都写在 application.properties 里，换存放位置只改配置，不动代码。
 */
@Slf4j
@Configuration
public class WebResourceConfig implements WebMvcConfigurer {

    /** 服务器上存放视频文件的真实目录 */
    @Value("${video.storage.dir}")
    private String storageDir;

    /** 对外暴露的网址前缀，例如 /videos/** */
    @Value("${video.storage.url-prefix}")
    private String urlPrefix;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // file:  URI 要求目录以 "/" 结尾，否则会被当成文件名
        String location = "file:" + storageDir.replace('\\', '/');
        if (!location.endsWith("/")) location = location + "/";

        registry.addResourceHandler(urlPrefix)
                .addResourceLocations(location);

        log.info("视频目录已映射：{} -> {}", urlPrefix, location);
    }
}
