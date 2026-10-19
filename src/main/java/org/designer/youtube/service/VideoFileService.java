package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.mapper.VideoMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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


    private int probeDuration(Path file) {
        try {
            Process p = new ProcessBuilder(
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=nw=1:nk=1",
                    file.toString()).redirectErrorStream(true).start();
            String out = new String(p.getInputStream().readAllBytes()).trim();
            p.waitFor();
            double sec = Double.parseDouble(out);
            return (int) Math.round(sec);
        } catch (Exception e) {
            log.warn("ffprobe 探测时长失败: {}", file, e);
            return 0;   // 探测失败按长视频处理，不阻断上传
        }
    }


    /** 用 ffprobe 读宽高，height > width 视为竖屏；探测失败按横屏处理（不阻断上传） */
    private int isVerticalOf(Path file) {
        try {
            Process p = new ProcessBuilder(
                    "ffprobe", "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=width,height",
                    "-of", "csv=s=x:p=0",
                    file.toString()).redirectErrorStream(true).start();
            String out = new String(p.getInputStream().readAllBytes()).trim();
            p.waitFor();
            // 输出形如 "1080x1920"
            String[] wh = out.split("x");
            if (wh.length != 2) return 0;
            int w = Integer.parseInt(wh[0].trim());
            int h = Integer.parseInt(wh[1].trim());
            return h > w ? 1 : 0;
        } catch (Exception e) {
            log.warn("ffprobe 探测宽高失败: {}", file, e);
            return 0;
        }
    }

    /**
     * 探测时长。返回 >0 为秒数；0 表示失败（没装 ffprobe、异常退出等）。
     * 浏览器读出的 duration 偶尔会有几秒误差（可变帧率、容器元数据不准），
     * 与前端兜底值相差超过 5 秒时优先信前端值。
     */
    private int resolveDuration(int probed, int clientSec) {
        if (probed > 0) {
            if (clientSec > 0 && Math.abs(probed - clientSec) > 5) return clientSec;
            return probed;
        }
        return clientSec > 0 ? clientSec : 0;   // 探测失败：前端值兜底，都没有就 0
    }

    @Transactional
    public Result<Map<String, Object>> uploadFile(String userId, String title, MultipartFile file,
                                                  int clientDurationSec, int clientVertical) {
        if (file == null || file.isEmpty()) return Result.fail("没有收到视频文件");
        if (title == null || title.trim().isEmpty()) return Result.fail("标题不能为空");

        String ext = extensionOf(file.getOriginalFilename());
        if (!isPlayable(ext)) {
            return Result.fail("暂不支持 ." + ext + " 格式，请上传 mp4 或 webm");
        }

        String fileName = idGen.createId().toLowerCase(Locale.ROOT) + "." + ext;
        Path dir = Paths.get(storageDir).toAbsolutePath().normalize();
        Path target = dir.resolve(fileName).normalize();
        if (!target.startsWith(dir)) return Result.fail("文件名不合法");

        try {
            Files.createDirectories(dir);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("视频文件保存失败: {}", target, e);
            return Result.fail("文件保存失败：" + e.getMessage());
        }

        // 落盘成功 → 探测时长/竖屏（ffprobe 不可用时用浏览器值兜底）→ 只插一次
        int durationSec = resolveDuration(probeDuration(target), clientDurationSec);
        int vertical    = isVerticalOf(target) == 1 ? 1
                        : (clientVertical == 1 ? 1 : 0);
        boolean isShort = durationSec > 0 && durationSec <= 60;

        int k;
        try {
            k = vm.uploadVideo(userId, title.trim(), target.toString(),
                    isShort ? 1 : 0, durationSec, vertical);
        } catch (RuntimeException e) {
            deleteQuietly(target);
            log.error("视频入库失败，已回收文件 {}", target, e);
            return Result.fail("登记失败：" + rootMessage(e));
        }
        if (k == 0) {
            deleteQuietly(target);
            return Result.fail("上传失败");
        }

        long videoId  = vm.selectLastVideoId();
        String playUrl = publicPrefix() + "/" + fileName;
        log.info("视频上传成功，id={}, 时长={}s, 短视频={}, 竖屏={}",
                videoId, durationSec, isShort, vertical == 1);

        return Result.success(Map.of(
                "videoId", videoId,
                "playUrl", playUrl,
                "filePath", target.toString(),
                "size", file.getSize(),
                "durationSec", durationSec,
                "isShort", isShort
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

    /** 封面图允许的格式 */
    private static final String[] IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "gif"};

    /** 上传/更换视频封面：只收图片，落盘到 video.storage.dir，再把路径写回 video.cover_path */
    public Result<Map<String, Object>> uploadCover(long videoId, String userId, MultipartFile file) {
        if (file == null || file.isEmpty()) return Result.fail("没有收到封面图");
        if (file.getSize() > 5 * 1024 * 1024) return Result.fail("封面图不能超过 5MB");

        String ext = extensionOf(file.getOriginalFilename());
        if (!isImage(ext)) return Result.fail("封面只支持 jpg/png/webp/gif");

        String fileName = "cover_" + idGen.createId().toLowerCase(Locale.ROOT) + "." + ext;
        Path dir = Paths.get(storageDir).toAbsolutePath().normalize();
        Path target = dir.resolve(fileName).normalize();
        if (!target.startsWith(dir)) return Result.fail("文件名不合法");

        try {
            Files.createDirectories(dir);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("封面保存失败: {}", target, e);
            return Result.fail("封面保存失败：" + e.getMessage());
        }

        int k;
        try {
            k = vm.updateCover(target.toString(), videoId, userId);
        } catch (RuntimeException e) {
            deleteQuietly(target);
            log.error("封面入库失败，已回收文件 {}", target, e);
            return Result.fail("登记失败：" + rootMessage(e));
        }
        if (k == 0) {
            deleteQuietly(target);
            return Result.fail("视频不存在或无权限");
        }

        String coverUrl = publicPrefix() + "/" + fileName;
        log.info("封面上传成功，videoId={}, 本地={}, 访问={}", videoId, target, coverUrl);
        return Result.success("封面上传成功", Map.of(
                "coverUrl", coverUrl,
                "filePath", target.toString()
        ));
    }

    /** 是不是图片扩展名 */
    private boolean isImage(String ext) {
        for (String p : IMAGE_EXT) if (p.equals(ext)) return true;
        return false;
    }

    /** 私信媒体允许的格式：图片 + 浏览器可直接播放的视频 */
    private boolean isPmMedia(String ext) {
        for (String p : IMAGE_EXT) if (p.equals(ext)) return true;
        for (String p : PLAYABLE) if (p.equals(ext)) return true;
        return false;
    }

    /**
     * 私信图片/视频上传：只负责落盘并返回文件名与访问 URL，
     * 入库由前端拿着 mediaPath 再调 /api/private_message/send/picture/video 完成。
     */
    public Result<Map<String, Object>> uploadPmMedia(MultipartFile file) {
        if (file == null || file.isEmpty()) return Result.fail("没有收到文件");
        if (file.getSize() > 100 * 1024 * 1024) return Result.fail("文件不能超过 100MB");

        String ext = extensionOf(file.getOriginalFilename());
        if (!isPmMedia(ext)) return Result.fail("仅支持 jpg/png/webp/gif 图片或 mp4/webm/mov/m4v 视频");

        String fileName = "pm_" + idGen.createId().toLowerCase(Locale.ROOT) + "." + ext;
        Path dir = Paths.get(storageDir).toAbsolutePath().normalize();
        Path target = dir.resolve(fileName).normalize();
        if (!target.startsWith(dir)) return Result.fail("文件名不合法");

        try {
            Files.createDirectories(dir);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("私信媒体保存失败: {}", target, e);
            return Result.fail("文件保存失败：" + e.getMessage());
        }

        return Result.success("上传成功", Map.of(
                "mediaPath", fileName,                                  // 入库只存文件名
                "url", publicPrefix() + "/" + fileName                  // 前端直接可显示的地址
        ));
    }

}
