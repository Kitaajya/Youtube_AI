package org.designer.youtube.service;

import jakarta.persistence.Cacheable;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.designer.youtube.common.Result;
import org.designer.youtube.mapper.VideoMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Cacheable
public class VideoService {
    private final VideoMapper vm;
    //***********************************************************视频模块***********************************************************

    //上传视频
    @Transactional
    public Result<Map<String,Object>> uploadVideo(String userId, String title, String videoPath){
        int k = vm.uploadVideo(userId, title, videoPath);
        if(k == 0) return Result.fail("上传失败");
        //取刚上传视频的自增ID：必须与 uploadVideo 在同一事务中调用（Service 方法上加 @Transactional）
        long videoId = vm.selectLastVideoId();
        log.info("视频上传成功，id={}", videoId);
        return Result.success(Map.of("videoId", videoId));
    }
    //显示视频标题
    public List<Map<String,Object>> selectVideoTitle(){
        return vm.selectVideoTitle();
    }
    //查看某人的视频，根据用户id
    public List<Map<String,Object>> selectVideo(String userId){
        return vm.selectVideo(userId);
    }
    //按照视频标题查询视频
    public List<Map<String,Object>> selectVideoByTitle(String title){
        return vm.selectVideoByTitle(title);
    }
    //查全部视频+UP主信息
    public List<Map<String,Object>> selectVideoAndUpInformation(){
        return vm.selectVideoAndUpInformation();
    }
    //根据up主的昵称查询他的所有视频
    public List<Map<String,Object>> selectVideosByUpName(String userId){
        return vm.selectVideosByUpName(userId);
    }
    //显示全部视频
    public List<Map<String,Object>> selectAllVideo(){
        return vm.selectAllVideo();
    }
    //按视频 ID 查询单个视频详情
    public List<Map<String,Object>> selectVideoById(long id){
        return vm.selectVideoById(id);
    }
    //模糊搜索
    public List<Map<String, Object>> searchVideo(String keyword){
        return vm.searchVideo(keyword);
    }
    //查询视频存储路径（用于播放/删除）
    public List<Map<String,Object>> selectVideoPathById(long id){
        return vm.selectVideoPathById(id);
    }
    //修改自己的视频标题
    public Result<Map<String,Object>> editTitle(String newTitle, long id, String userId){
        int k=vm.editTitle(newTitle, id, userId);
        if(k==0) return Result.fail("修改失败");
        return Result.success();
    }
    //删除自己的视频
    public Result<Map<String,Object>>deleteMyVideo(long id,String userId){
        int k=vm.deleteMyVideo(id, userId);
        if(k==0) return Result.fail("删除失败");
        return Result.success();
    }

    //***********************************************************评论区模块***********************************************************
    //查看此视频的所有评论，根据id（视频id）
    public List<Map<String,Object>> selectCommentsById(long videoId){
        return vm.selectCommentsById(videoId);
    }
    //删除我的评论
    public Result<Map<String,Object>>deleteSelfComment(String myUserId, long videoId, String commentId){
        int k=vm.deleteSelfComment(myUserId, videoId, commentId);
        if(k==0) return Result.fail("删除失败");
        return Result.success();
    }
    //修改我的评论
    public Result<Map<String,Object>> editSelfComment(String newContent,String commentId,String myUserId){
        int k=vm.editSelfComment(newContent, commentId, myUserId);
        if(k==0) return Result.fail("修改失败");
        return Result.success();
    }
    //对video_id为videoId的视频增添我的评论（parentId 传 null 表示一级评论）
    public Result<Map<String,Object>> addComment(String commentId,long videoId,String userId,String content,String parentId){
        int k=vm.addComment(commentId, videoId, userId, content, parentId);
        if(k==0) return Result.fail("评论失败");
        return Result.success();
    }
    //查某条评论下的全部回复（楼中楼）
    public List<Map<String,Object>> selectRepliesByParent(@Param("parentId") String parentId){
        return vm.selectRepliesByParent(parentId);
    }

    /**
     * 播放计数：只做一次 UPDATE，再 SELECT 回读真实播放量。
     * 切勿再调 vm.addVideoView 拿返回值当播放量——那是受影响行数，永远是 1。
     * **/
    public Result<Map<String,Object>> addVideoView(long id){
        if (vm.countVideo(id) == 0) return Result.fail("视频不存在或已被删除");
        int k = vm.addVideoView(id);
        if (k == 0) return Result.fail("播放计数失败，请稍后重试");
        Long view = vm.selectViewCount(id);   // 回读 UPDATE 之后的真实值
        return Result.success("播放计数成功", Map.of("view_count", view == null ? 0L : view));
    }

    //***********************************************************点赞模块***********************************************************
    //显示点赞数（以 video_like 表为唯一口径）
    public long selectLikeQuantity(long id){
        return vm.selectLikeQuantity(id);
    }
    //当前用户是否赞过该视频
    public boolean isLiked(long id, String userId){
        return vm.selectMyLike(id, userId) > 0;
    }
    //点赞：已赞过时不报错，返回当前状态；返回 data 里带上最新 like_count，前端就地更新
    public Result<Map<String,Object>> addLike(long id, String userId){
        if (vm.countVideo(id) == 0) return Result.fail("视频不存在或已被删除");
        int k = vm.addLike(id, userId);
        if (k == 0) {
            log.info("用户 {} 重复点赞视频 {}，忽略", userId, id);
            return Result.success("已经点过赞啦", Map.of(
                    "like_count", vm.selectLikeQuantity(id), "liked", true));
        }
        return Result.success("点赞成功", Map.of(
                "like_count", vm.selectLikeQuantity(id), "liked", true));
    }
    //取消点赞
    public Result<Map<String,Object>> cancelLike(long id, String userId){
        if (vm.countVideo(id) == 0) return Result.fail("视频不存在或已被删除");
        int k = vm.cancelLike(id, userId);
        if (k == 0) {
            return Result.success("还没有点过赞", Map.of(
                    "like_count", vm.selectLikeQuantity(id), "liked", false));
        }
        return Result.success("已取消点赞", Map.of(
                "like_count", vm.selectLikeQuantity(id), "liked", false));
    }
    public Result<Map<String,Object>> createLikeFormat(String pList,
                                                       String userId,
                                                       String name,
                                                       String description,
                                                       int isPublic){
        int k=vm.createLikeFormat(pList, userId, name, description, isPublic);
        if(k==0) return Result.fail("收藏失败");
        return Result.success("收藏成功",Map.of("success",true));
    }
}