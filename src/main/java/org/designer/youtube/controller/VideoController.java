package org.designer.youtube.controller;
/**
 * imitate youtube，2026
 * Copyright © 2026 /10/10. All rights reserved.
 *
 * @author: Jya Yijya (Tanmoku Kitaajya),China
 * at website www.github.com/Kitaajya in github
 *
 *
 *
 * 第120行左右的模糊搜索我预埋了sleep，提醒只有交会员才能解除
 *
 * @time: 2026/9/25~2026/10/10
 *
 * @version 1.0
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * **/
import lombok.RequiredArgsConstructor;
import org.designer.youtube.common.Result;
import org.designer.youtube.service.VideoFileService;
import org.designer.youtube.service.VideoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/video")
public class VideoController {
    private final VideoService vs;
    private final VideoFileService vfs;
    private final Logger log= LoggerFactory.getLogger(VideoController.class);

    //上传视频文件（文件本体真正传到服务器并落盘，返回可直接播放的 URL）
    //clientDurationSec / clientVertical：浏览器上传前读出的时长与是否竖屏，
    //  供服务器没有 ffprobe、探测失败时兜底判定短视频；读不出来传 -1，-1 表示不参与兜底
    @PostMapping("/upload/file")
    public Result<Map<String, Object>> uploadVideoFile(@RequestParam String userId,
                                                       @RequestParam String title,
                                                       @RequestParam MultipartFile file,
                                                       @RequestParam(defaultValue = "-1") int clientDurationSec,
                                                       @RequestParam(defaultValue = "-1") int clientVertical) {
        return vfs.uploadFile(userId, title, file, clientDurationSec, clientVertical);
    }

    //上传视频（旧方式：只登记服务器上的路径字符串，文件本体不经过服务器）
    @PostMapping("/upload")
    public Result<Map<String, Object>> uploadVideo(@RequestParam String userId,
                                                   @RequestParam String title,
                                                   @RequestParam String videoPath) {
        return vs.uploadVideo(userId, title, videoPath);
    }

    //显示视频标题
    @GetMapping("/show/title")
    public Result<List<Map<String, Object>>> selectVideoTitle() {
        return Result.success(vs.selectVideoTitle());
    }

    //查看某人的视频，根据用户id
    @GetMapping("/select")
    public Result<List<Map<String, Object>>> selectVideo(@RequestParam String userId) {
        return Result.success(vs.selectVideo(userId));
    }

    //按照视频标题查询视频
    @GetMapping("/select/video/title")
    public Result<List<Map<String, Object>>> selectVideoByTitle(@RequestParam String title) {
        return Result.success(vs.selectVideoByTitle(title));
    }

    //查全部视频+UP主信息
    @GetMapping("/select/videos/upinfor")
    public Result<List<Map<String, Object>>> selectVideoAndUpInformation() {
        return Result.success(vs.selectVideoAndUpInformation());
    }

    //根据up主的昵称查询他的所有视频
    @GetMapping("/select/videos/upname")
    public Result<List<Map<String, Object>>> selectVideosByUpName(@RequestParam String userId) {
        return Result.success(vs.selectVideosByUpName(userId));
    }

    //显示全部视频
    @GetMapping("/select/all/videos")
    public Result<List<Map<String, Object>>> selectAllVideo() {
        return Result.success(vs.selectAllVideo());
    }

    //按视频 ID 查询单个视频详情
    @GetMapping("/select/video/single/infor")
    public Result<List<Map<String, Object>>> selectVideoById(@RequestParam long id) {
        return Result.success(vs.selectVideoById(id));
    }

    //模糊搜索
    @GetMapping("/select/like")
    public Result<List<Map<String, Object>>> searchVideo(@RequestParam String keyword) throws InterruptedException {
        Thread.sleep(5000);
        return Result.success(vs.searchVideo(keyword));
    }

    //查询视频存储路径（用于播放/删除）
    @GetMapping("/select/path")
    public Result<List<Map<String, Object>>> selectVideoPathById(@RequestParam long id) {
        return Result.success(vs.selectVideoPathById(id));
    }

    //修改自己的视频标题
    @PostMapping("/edit/title")
    public Result<Map<String, Object>> editTitle(@RequestParam String newTitle, @RequestParam long id,
                                                 @RequestParam String userId) {
        return vs.editTitle(newTitle, id, userId);
    }

    //删除自己的视频
    @DeleteMapping("/delete/videos")
    public Result<Map<String, Object>> deleteMyVideo(@RequestParam long id,@RequestParam String userId) {
        return vs.deleteMyVideo(id, userId);
    }
    //***********************************************************评论区模块***********************************************************
    //查看此视频的所有评论，根据id（视频id）
    @GetMapping("/get/all/comments")
    public Result<List<Map<String,Object>>> selectCommentsById(@RequestParam long videoId){
        return Result.success(vs.selectCommentsById(videoId));
    }
    //删除我的评论
    @DeleteMapping("/delete/my/comments")
    public Result<Map<String,Object>>deleteSelfComment(@RequestParam String myUserId,
                                                       @RequestParam long videoId,
                                                       @RequestParam  String commentId){
        return  vs.deleteSelfComment(myUserId, videoId, commentId) ;
    }
    //修改我的评论
    @PostMapping("/edit/my/comments")
    public Result<Map<String,Object>> editSelfComment(@RequestParam String newContent,@RequestParam String commentId,@RequestParam String myUserId) {
        return vs.editSelfComment(newContent, commentId, myUserId);
    }
    //对video_id为videoId的视频增添我的评论（parentId 不传/传 null 表示一级评论）
    @PostMapping("/add/my/comments")
    public Result<Map<String,Object>> addComment(@RequestParam String commentId,@RequestParam long videoId,
                                                 @RequestParam String userId,
                                                 @RequestParam String content,
                                                 @RequestParam(required = false) String parentId) {
        return vs.addComment(commentId, videoId, userId, content, parentId);
    }
    //查某条评论下的全部回复（楼中楼）
    @GetMapping("/select/parent/comments")
    public Result<List<Map<String,Object>>>selectRepliesByParent(@RequestParam String parentId){
        return Result.success(vs.selectRepliesByParent(parentId));
    }
    /**
    显示点赞数 + 我是否赞过
    注意：路径必须是 /select/like/count，不能再用 /select/like，
          否则与上面的模糊搜索接口重名，Spring 启动会抛 Ambiguous mapping
     **/
    @GetMapping("/select/like/count")
    public Result<Map<String,Object>> selectLikeQuantity(@RequestParam long id,
                                                         @RequestParam(required = false) String userId) {
        if (vs.selectVideoById(id).isEmpty()) return Result.fail("视频不存在或已被删除");
        Map<String, Object> data = new HashMap<>();
        data.put("like_count", vs.selectLikeQuantity(id));
        data.put("liked", userId != null && !userId.isBlank() && vs.isLiked(id, userId));
        return Result.success(data);
    }
    //启动点赞
    @PostMapping("/add/like")
    public Result<Map<String,Object>>addLike(@RequestParam long id,@RequestParam String userId) {
        return vs.addLike(id,userId);
    }
    //取消点赞
    @PostMapping("/cancel/like")
    public Result<Map<String,Object>> cancelLike(@RequestParam long id, @RequestParam String userId) {
        return vs.cancelLike(id, userId);
    }
    //播放计数加一（播放页加载时调用一次，返回数据库回读的真实播放量）
    @PostMapping("/add/view")
    public Result<Map<String,Object>> addVideoView(@RequestParam long id) {
        return vs.addVideoView(id);
    }

    /**
     * 收藏夹的一系列操作
     *
     *
     *
     *
     *
     * **/
    //建立收藏夹，不是把视频放进收藏夹里，因为收藏夹还没创建呢！
    @PostMapping("/create/like/format")
    public Result<Map<String,Object>> createLikeFormat(@RequestParam String pList,
                                                       @RequestParam String userId,
                                                       @RequestParam String name,
                                                       @RequestParam String description,
                                                       @RequestParam int isPublic){
        return vs.createLikeFormat(pList, userId, name, description, isPublic);
    }
    //取消收藏
    @DeleteMapping("/delete/like")
    public Result<Map<String,Object>> deleteLike(@RequestParam String pList,
                                                 @RequestParam String userId){
        try{
            //延迟两秒
            Thread.sleep(2000);
        }
        catch (Exception e){
            log.error("休眠线程发生异常!{}",e.getMessage());
        }
        return vs.deleteLike(pList, userId);
    }
    //把视频放进收藏夹
    @PostMapping("/add/to/like")
    public Result<Map<String,Object>> addToLikeList(@RequestParam String pList,
                                                    @RequestParam long videoId){
        return vs.addToLikeList(pList, videoId);
    }
    //从收藏夹移出一个视频（收藏夹保留）
    @DeleteMapping("/remove/from/like")
    public Result<Map<String,Object>> removeFromLikeList(@RequestParam String pList,
                                                         @RequestParam long videoId){
        return vs.removeFromLikeList(pList, videoId);
    }
    //切换收藏夹可见性：isPublic 1=公开 0=私密（只能改自己的收藏夹）
    @PostMapping("/edit/like/format/public")
    public Result<Map<String,Object>> updateLikeFormatPublic(@RequestParam String pList,
                                                             @RequestParam String userId,
                                                             @RequestParam int isPublic){
        return vs.updateLikeFormatPublic(pList, userId, isPublic);
    }
    //收藏夹列表：owner=夹子归属人 viewer=当前访问者 videoId=用于回显"这条视频收进了哪些夹"
    @GetMapping("/select/like/format")
    public Result<List<Map<String,Object>>> selectLikeFormats(@RequestParam String owner,
                                                              @RequestParam String viewer,
                                                              @RequestParam(defaultValue = "0") long videoId){
        return Result.success(vs.selectLikeFormats(owner, viewer, videoId));
    }
    //某个收藏夹里的视频
    @GetMapping("/select/like/format/videos")
    public Result<List<Map<String,Object>>> selectLikeFormatVideos(@RequestParam String pList){
        return Result.success(vs.selectLikeFormatVideos(pList));
    }
    //清空收藏夹
    @DeleteMapping("/clear/list")
    public Result<Map<String,Object>> clearLikeList(@RequestParam String pList){
        return vs.clearLikeList(pList);
    }
    //我的通知列表：最新在前，带触发人昵称头像、摘要、未读标记
    @GetMapping("/notify")
    public Result<List<Map<String,Object>>>selectMyNotifications(@RequestParam String me,
                                                         @RequestParam int size,@RequestParam int offset){
        return Result.success(vs.selectMyNotifications(me, size, offset));
    }
    //写入一条通知
    @PostMapping("/insert/notify")
    public Result<Map<String,Object>>insertNotify(@RequestParam String notifyId,
                                                  @RequestParam String toUser,
                                                  @RequestParam String fromUser,@RequestParam  String type,
                                                  @RequestParam Long videoId, @RequestParam String commentId,
                                                  @RequestParam String contents){
        return vs.insertNotify(notifyId, toUser, fromUser, type, videoId, commentId, contents);
    }
    //查视频作者与标题（点赞/收藏通知要用）
    @PostMapping("/select/owner")
    public Result<Map<String,Object>> selectVideoOwner(@RequestParam long id){
        return vs.selectVideoOwner(id);
    }
    //查某条评论的作者（回复了你的评论->要通知被回复的人，不是视频作者）
    @GetMapping("/select/comment")
    public String selectCommentOwner(@RequestParam String commentId){
        return vs.selectCommentOwner(commentId);
    }
    //消除未读的通知红点：把发给我的所有未读通知标记为已读
    @PostMapping("/notify/read/all")
    public Result<Map<String,Object>> readAndRemoveRedDot(@RequestParam String me){
        return vs.readAndRemoveRedDot(me);
    }

    // 上传/更换视频封面（只能改自己的视频）
    @PostMapping("/upload/cover")
    public Result<Map<String, Object>> uploadCover(@RequestParam long videoId,
                                                   @RequestParam String userId,
                                                   @RequestParam MultipartFile file) {
        return vfs.uploadCover(videoId, userId, file);
    }
    //新增观看历史功能，可查询和删除，此处为查询观看历史，一次查询分200条数据，防止因数据过多而查询变慢
    @GetMapping("/select/history")
    public Result<List<Map<String,Object>>> selectHistory(@RequestParam String userId){
        return vs.selectHistory(userId);
    }
    //上传我看过的视频，自动上传，看过视频后就可以在历史区块里查找此视频
    @PostMapping("/insert/history")
    public Result<Map<String,Object>> insertHistory(@RequestParam String userId,@RequestParam long videoId){
        return vs.insertHistory(userId,videoId);
    }
    //看短视频
    @GetMapping("/select/short")
    public Result<List<Map<String,Object>>>selectShortFeed(@RequestParam(defaultValue ="10") int size,
                                                           @RequestParam(defaultValue = "0") int offset) {
        return vs.selectShortFeed(size, offset);
    }
    //给这条视频下的评论点个赞，顺便显示这条评论的点赞数。
    @PostMapping("/add/comment/like")
    public Result<Map<String,Object>> toggleCommentLike(@RequestParam String me,@RequestParam String commentId){
        return vs.toggleCommentLike(me, commentId);
    }

}
