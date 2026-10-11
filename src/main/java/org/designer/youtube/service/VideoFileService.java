package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.mapper.VideoMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;

/**
 * 真正的视频文件上传：把浏览器传来的文件内容保存到磁盘，再往数据库登记。
 *
 * 与旧的 /api/video/upload 区别：
 *   旧接口只收一个"路径字符串"，文件本体从没到过服务器；
 *   本服务收 MultipartFile，文件真的落盘，路径由后端生成，因此一定准确、一定能播放。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VideoFileService {

    private final VideoMapper vm;
    private final RandomlyCreateID idGen;

    @Value("${video.storage.dir}")
    private String storageDir;

    @Value("${video.storage.url-prefix}")
    private String urlPrefix;

    /** 浏览器原生 <video> 能直接播放的格式，其余收进来也放不出来，干脆拒收 */
    private static final String[] PLAYABLE = {"mp4", "webm", "mov", "m4v", "ogv", "ogg"};

    public Result<Map<String, Object>> uploadFile(String userId, String title, MultipartFile file) {
        if (file == null || file.isEmpty()) return Result.fail("没有收到视频文件");
        if (title == null || title.trim().isEmpty()) return Result.fail("标题不能为空");

        String ext = extensionOf(file.getOriginalFilename());
        if (!isPlayable(ext)) {
            return Result.fail("暂不支持 ." + ext + " 格式，浏览器无法在线播放，请上传 mp4 或 webm");
        }

        // 文件名一律用随机 ID 重命名：规避中文名、重名、以及 ".." 之类的路径穿越
        String fileName = idGen.createId().toLowerCase(Locale.ROOT) + "." + ext;

        Path dir = Paths.get(storageDir).toAbsolutePath().normalize();
        Path target = dir.resolve(fileName).normalize();
        if (!target.startsWith(dir)) {
            // 双保险，理论上 resolve 单个文件名不可能越界
            return Result.fail("文件名不合法");
        }

        try {
            Files.createDirectories(dir);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("视频文件保存失败: {}", target, e);
            return Result.fail("文件保存失败：" + e.getMessage());
        }

        // 落盘成功，再登记数据库；登记失败要把文件删掉，否则磁盘上留下没人认领的视频
        int k;
        try {
            k = vm.uploadVideo(userId, title.trim(), target.toString());
        } catch (RuntimeException e) {
            deleteQuietly(target);
            log.error("视频入库失败，已回收文件 {}", target, e);
            return Result.fail("登记失败：" + rootMessage(e));
        }
        if (k == 0) {
            deleteQuietly(target);
            return Result.fail("上传失败");
        }

        long videoId = vm.selectLastVideoId();
        String playUrl = publicPrefix() + "/" + fileName;
        log.info("视频上传成功，id={}, 本地={}, 访问={}", videoId, target, playUrl);

        return Result.success(Map.of(
                "videoId", videoId,
                "playUrl", playUrl,
                "filePath", target.toString(),
                "size", file.getSize()
        ));
    }

    /** 把 /videos/** 转成 /videos，用于拼接播放地址 */
    private String publicPrefix() {
        return urlPrefix.replaceAll("/\\*\\*?$", "").replaceAll("\\*\\*?$", "");
    }

    private String extensionOf(String name) {
        if (name == null) return "";
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private boolean isPlayable(String ext) {
        for (String p : PLAYABLE) if (p.equals(ext)) return true;
        return false;
    }

    private void deleteQuietly(Path p) {
        try {
            Files.deleteIfExists(p);
        } catch (IOException e) {
            log.warn("回收文件失败，需手动清理：{}", p, e);
        }
    }

    /** 异常链最底下的那句才是真正原因（比如外键约束说的是账号不存在） */
    private String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) t = t.getCause();
        String m = t.getMessage();
        if (m == null) return e.getClass().getSimpleName();
        int nl = m.indexOf('\n');
        return nl > 0 ? m.substring(0, nl) : m;
    }
}
