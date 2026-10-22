package org.designer.youtube.service;

import jakarta.persistence.Cacheable;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.mapper.VideoMapper;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Cacheable
public class VideoService {
    private final VideoMapper vm;

    /**
     *
     * 设置新消息通知功能
     *
     * **/
    private void sendLikeNotify(long videoId, String fromUser) {
        try {
            RandomlyCreateID e=new RandomlyCreateID();
            Map<String,Object> v = vm.selectVideoOwner(videoId);
            if (v == null) return;
            String toUser = String.valueOf(v.get("user_id"));
            String title  = String.valueOf(v.get("title"));
            if (toUser.equals(fromUser)) return;                    // 自己赞自己不发
            String contents = "赞了你的视频《" + title + "》";
            if (contents.length() > 200) contents = contents.substring(0, 200);
            vm.insertNotify(e.createId(), toUser, fromUser, "like",
                    videoId, null, contents);
        } catch (Exception e) {
            log.warn("点赞通知写入失败 videoId={}", videoId, e);   // 不影响点赞
        }
    }

    private void sendCommentNotify(String commentId, long videoId,
                                   String fromUser, String content, String parentId) {
        try {
            String toUser, type, action;
            if (parentId == null) {
                // 一级评论 → 通知视频作者
                Map<String,Object> v = vm.selectVideoOwner(videoId);
                if (v == null) return;
                toUser = String.valueOf(v.get("user_id"));
                action = "评论了你的视频《" + v.get("title") + "》";
                type   = "comment";
            } else {
                // 楼中楼 → 通知被回复评论的作者
                toUser = vm.selectCommentOwner(parentId);
                if (toUser == null) return;
                action = "回复了你的评论";
                type   = "reply";
            }
            if (toUser.equals(fromUser)) return;

            String brief = content == null ? "" : content;
            if (brief.length() > 50) brief = brief.substring(0, 50);
            String contents = action + "：" + brief;
            if (contents.length() > 200) contents = contents.substring(0, 200);
            RandomlyCreateID e=new RandomlyCreateID();
            vm.insertNotify(e.createId(), toUser, fromUser, type,
                    videoId, commentId, contents);
        } catch (Exception e) {
            log.warn("评论通知写入失败 commentId={}", commentId, e);
        }
    }
    //***********************************************************视频模块***********************************************************

    //上传视频
    @Transactional
    public Result<Map<String,Object>> uploadVideo(String userId, String title, String videoPath){
        int k = vm.uploadVideo(userId, title, videoPath,0,0,0);
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
    public List<Map<String,Object>> selectCommentsById(long videoId, String userId){
        if (userId == null) userId = ""; // 防止 null
        return vm.selectCommentsById(videoId, userId);
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

        /**
         * 新增消息设置
         * **/
        sendCommentNotify(commentId, videoId, userId, content, parentId);
        return Result.success();
    }
    //查某条评论下的全部回复（楼中楼）
    public List<Map<String,Object>> selectRepliesByParent(String parentId){
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
        /**
         * 设置消息新增
         * **/
        sendLikeNotify(id,userId);
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
    //建立收藏夹，不是把视频放进收藏夹里，因为收藏夹还没创建呢！
    public Result<Map<String,Object>> createLikeFormat(String pList,
                                                       String userId,
                                                       String name,
                                                       String description,
                                                       int isPublic){
        try {
            int k = vm.createLikeFormat(pList, userId, name, description, isPublic);
            if(k == 0) return Result.fail("创建失败");
            return Result.success("收藏夹创建成功", Map.of("playlistId", pList));
        } catch (DuplicateKeyException e) {
            // uk_playlist_name(user_id,name)：同一人重复建同名收藏夹
            return Result.fail("已存在同名收藏夹");
        }
    }
    //把视频放进收藏夹里（SQL 用 INSERT IGNORE：重复收藏返回 0 行、不抛异常）
    public Result<Map<String,Object>>addToLikeList(String pList, long videoId){
        int k = vm.addToLikeList(pList, videoId);
        if(k == 0) return Result.success("你已经收藏过一次了！",Map.of("success",true));
        return Result.success("收藏成功",Map.of("success",true));
    }
    //删除收藏（整个收藏夹）
    public Result<Map<String,Object>> deleteLike(String pList, String userId){
        int k = vm.deleteLike(pList, userId);
        if(k == 0) return Result.fail("收藏夹不存在或无权限");   // DELETE 不抛重复键，0 行=没这个夹或不是你的
        return Result.success("已删除收藏夹", Map.of("success", true));
    }
    //从收藏夹移出一个视频（收藏夹还在，只删内容行）
    public Result<Map<String,Object>> removeFromLikeList(String pList, long videoId){
        int k = vm.removeFromLikeList(pList, videoId);
        if(k == 0) return Result.success("本来就没在里面", Map.of("success", true));
        return Result.success("已移出收藏夹", Map.of("success", true));
    }
    //切换收藏夹可见性（公开/私密）：只认 0/1，其它值一律归为公开，避免脏值写库
    public Result<Map<String,Object>> updateLikeFormatPublic(String pList, String userId, int isPublic){
        int pub = (isPublic == 0) ? 0 : 1;
        int k = vm.updateLikeFormatPublic(pList, userId, pub);
        if(k == 0) return Result.fail("收藏夹不存在或无权限");
        return Result.success(pub == 1 ? "已设为公开" : "已设为私密", Map.of("is_public", pub));
    }
    //某人的收藏夹列表（含 video_count 与 in_list 回显）
    public List<Map<String,Object>> selectLikeFormats(String owner, String viewer, long videoId){
        return vm.selectLikeFormats(owner, viewer, Math.max(videoId, 0L));
    }
    //某个收藏夹里的视频
    public List<Map<String,Object>> selectLikeFormatVideos(String pList){
        return vm.selectLikeFormatVideos(pList);
    }
    //清空某个文件夹
    public Result<Map<String,Object>> clearLikeList(String pList){
        try{
            int k=vm.clearLikeList(pList);
            if(k!=0) return Result.success("清空成功",Map.of("success",true));
        } catch (DuplicateKeyException e) {
            return Result.success("你已经清空过一次了！",Map.of("success",true));
        }
        return Result.fail("清空失败，重新清空");
    }
    //我的通知列表：最新在前，带触发人昵称头像、摘要、未读标记
    public List<Map<String,Object>> selectMyNotifications(String me,int size,int offset){
        return vm.selectMyNotifications(me, size, offset);
    }
    //写入一条通知
    public Result<Map<String,Object>>insertNotify(String notifyId, String toUser, String fromUser, String type,
                                                  Long videoId, String commentId, String contents){
        try {
            int k=vm.insertNotify(notifyId, toUser, fromUser, type, videoId, commentId, contents);
            if(k!=0) return Result.success("通知成功！",Map.of("success",true));
        }catch (DuplicateKeyException esq){
            return Result.success("已经通知过一次了！",Map.of("success",true));
        }
        return Result.fail("通知失败");
    }
    //查视频作者与标题（点赞/收藏通知要用），
    /**
     * 2026/10/15/20:00
     *
     * **/
    // 注意，本人设计的收藏通知意为只通知有人收藏，不通知到底是谁收藏的，为保护隐私而建，另外油管官方也是这么设计的
    public Result<Map<String,Object>> selectVideoOwner(long id){
        Map<String,Object> owner = vm.selectVideoOwner(id);
        if (owner == null) return Result.fail("视频不存在");
        return Result.success(Map.of(
                "user_id", owner.get("user_id"),
                "title",   owner.get("title")
        ));
    }
    //查某条评论的作者（回复了你的评论->要通知被回复的人，不是视频作者）
    public String selectCommentOwner(String commentId){
        return vm.selectCommentOwner(commentId);
    }
    /**
     * 截止2026/10/15/20:17，此设计有通知已读后不会消失通知红点，而是继续存在。这是一个已知的bug。
     * deepseek给我的提示是is_read永远没有改变，需要一个@Update使之置1（0表示未读，1表示已读）
     *
     * **/
    //消除未读的通知红点：把发给我的所有未读通知标记为已读
    public Result<Map<String,Object>> readAndRemoveRedDot(String me){
        if (me == null || me.isEmpty()) return Result.fail("用户ID不能为空");
        int k = vm.readAndRemoveRedDot(me);
        return Result.success(k > 0 ? "已标记 " + k + " 条为已读" : "没有未读通知",
                Map.of("success", true, "updated", k));
    }
    //新增观看历史功能，可查询和删除，此处为查询观看历史，一次查询分200条数据，防止因数据过多而查询变慢
    public Result<List<Map<String,Object>>> selectHistory(String userId){
        return Result.success(vm.selectHistory(userId));
    }
    //上传我看过的视频，自动上传，看过视频后就可以在历史区块里查找此视频
    public Result<Map<String,Object>>insertHistory(String userId,long videoId){
        int k=vm.insertHistory(userId, videoId);
        if(k<0) return Result.fail("出现bug！");
        return Result.success("历史上传成功！",Map.of("success",true));
    }
    //看短视频
    public Result<List<Map<String,Object>>> selectShortFeed(int size, int offset){
        int s = Math.min(Math.max(size, 1), 50);
        int o = Math.max(offset, 0);
        return Result.success(vm.selectShortFeed(s, o));
    }
    //给这条视频下的评论点个赞，顺便显示这条评论的点赞数。评论区点赞也要通知。
    public Result<Map<String,Object>> toggleCommentLike(String me, String commentId) {
        boolean wasLiked = vm.likedByMe(me, commentId) > 0;
        if (wasLiked) {
            vm.removeCommentLike(me, commentId);
        } else {
            try {
                vm.addCommentLike(me, commentId);
                sendCommentLikeNotify(commentId, me);
            } catch (Exception e) {
                //把错误打印出来！并把错误返回给前端！
                e.printStackTrace(); // 在 IDEA 控制台打印红字
                log.error("评论点赞失败: ", e);
                return Result.fail("点赞写入数据库失败: " + e.getMessage());
            }
        }
        return Result.success("操作成功", Map.of(
                "liked", vm.likedByMe(me, commentId) > 0,
                "count", vm.countCommentLikes(commentId)));
    }
    /**
     * 评论区的点赞通知
     * 2026/10/20/11:11
     * Kitaajya
     *
     * **/
    // 评论点赞通知
    private void sendCommentLikeNotify(String commentId, String fromUser) {
        try {
            //查这条评论的作者、视频ID和内容
            Map<String, Object> info = vm.selectCommentInfoForNotify(commentId);
            if (info == null) return;
            String toUser = String.valueOf(info.get("user_id")); // 评论作者
            Long videoId = Long.valueOf(String.valueOf(info.get("video_id")));
            String content = String.valueOf(info.get("contents"));
            //如果是自己赞自己，不发通知
            if (toUser.equals(fromUser)) return;
            //拼接摘要内容
            String brief = content == null ? "" : content;
            if (brief.length() > 30) brief = brief.substring(0, 30) + "...";
            String contents = "赞了你的评论：" + brief;
            if (contents.length() > 200) contents = contents.substring(0, 200);
            //写入数据库（type 定义为 "comment_like"）
            RandomlyCreateID e = new RandomlyCreateID();
            vm.insertNotify(e.createId(), toUser, fromUser, "comment_like", videoId, commentId, contents);
        } catch (Exception e) {
            log.warn("评论点赞通知写入失败 commentId={}", commentId, e);
        }
    }


    /**
     * 把数据库里的点赞数据翻译成自然语言，喂给 DeepSeek。2026/10/22/23:20
     */
    public Flux<String> getCommentLike(ChatClient client, String question) {
        //查数据
        List<Map<String, Object>> list = vm.getCommentLike();
        //拼接上下文
        StringBuilder context = new StringBuilder();
        if (list == null || list.isEmpty()) context.append("当前数据库没有任何点赞记录。\n");
        else {
            for (Map<String, Object> map:list) {
                Object userId = map.get("user_id");
                Object commentId = map.get("comment_id");
                Object time = map.get("create_time");
                context.append("用户【").append(userId).append("】在 ").append(time).append(" 点赞了评论【").append(commentId).append("】。\n");
            }
        }
        //设定AI规则
        String systemPrompt = "你是一个全能的 AI 助手。\n" +
                "            我的后台挂载了一个数据库，里面记录了用户对评论的点赞数据。\n" +
                "            1. 如果用户问的是关于数据库、点赞、谁赞了谁，请严格基于下面提供的【数据库记录】来回答。如果记录里没有，就说不知道。\n" +
                "            2. 如果用户问的是其他问题（比如数学题、写代码、日常聊天），请直接利用你自己的知识回答，不要被数据库记录限制。\n" +
                "            \"\"\"";
        String finalUserPrompt = "点赞记录如下：\n" + context + "\n用户提问：" + question;

        //log.info("数据库查出来的点赞条数：{}", list != null ? list.size() : "null");

        //发给AI（流式返回）
        return client.prompt()
                .system(systemPrompt)
                .user(finalUserPrompt)
                .stream()
                .content();
    }
    /**把视频id为id`(特定视频)的评论区喂给DeepSeek，并让它总结评论**/
    public Flux<String>selectSpecialVideoCommentsForDeepSeek(long vid){
        List<Map<String,Object>> list=vm.selectSpecialVideoCommentsForDeepSeek(vid);
        StringBuilder sb=new StringBuilder();
        if(k==null||k.isEmpty()) sb.append("当前数据库没有任何内容。\n");
        else{
            for(Map<String,Object> map:k){
                Object commentId=map.get("comment_id");
                Object dynamicId=map.get("dynamic_id");
                Object userId=map.get("user_id");
                Object parentId=map.get("parent_id");
                Object contents=map.get("contents");
                Object createTime=map.get("create_time");
                Object contentLike=map.get("contentLike");
                sb.append("用户名为").append(userId).append("在动态id为").append(dynamicId)
                        .append("处发表了一个评论").append(contents).append("此评论发表时间为")
                        .append(createTime).append("此评论的id为").append(commentId)
                        .append(",它的父评论为").append(parentId).append(",父评论发表时间为").append(createTime)
                        .append(",对应的点赞数").append(contentLike);
            }
        }
        String systemPrompt= """
                你是一个DeepSeek，如果用户询问了关于视频id为vid的评论区内容、或是让你总结此视频下方的评论区，你要根据我给你的数据库回答。
                相反，如果用户询问的内容与视频评论区的内容无关，就请你如实回答。
                """;
    }
}