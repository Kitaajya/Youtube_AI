package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.mapper.VideoMapper;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.cors.CorsConfigurationSource;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
//@Cacheable
public class VideoService {
    @Autowired
    private final VideoMapper vm;
    @Autowired
    private final StringRedisTemplate redisTemplate;
    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

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
    /**对video_id为videoId的视频增添我的评论（parentId 传 null 表示一级评论）**/
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
    //改造后的点赞方法
    // 点赞：数据库为主，Redis 为辅，彻底解决刷新丢失问题
    /**    这两个原方法会导致Redis缓存没写入数据库而使得前端数据与后端数据不一致的bug
     *     public Result<Map<String,Object>> addLike(long id, String userId){
     *         int k=vm.countVideo(id);
     *         if(k==0) return Result.fail("video_bug!");
     *         String likeSetKey="video:like"+id;//点赞的人
     *         String countKey="video:like_count"+id;
     *         Boolean isDone=redisTemplate.opsForSet().isMember(likeSetKey,userId);
     *         //如果点赞过了，直接从缓存里拿出值
     *         if(Boolean.TRUE.equals(isDone)){
     *             long count;
     *             String redisLikeCount=redisTemplate.opsForValue().get(countKey);
     *             if(redisLikeCount!=null) count=Long.parseLong(redisLikeCount);
     *             else count=vm.selectLikeQuantity(id);
     *             return Result.success("had done",Map.of("like_count",count,"liked",true));
     *         }
     *         redisTemplate.opsForSet().add(likeSetKey,userId);
     *         redisTemplate.opsForValue().increment(countKey);
     *         sendLikeNotify(id,userId);
     *         String notInRedisCountLike=redisTemplate.opsForValue().get(countKey);
     *         long newNotInRedisCountLike;
     *         if (notInRedisCountLike != null)
     *             newNotInRedisCountLike=Long.parseLong(notInRedisCountLike);
     *         else newNotInRedisCountLike=1L;
     *         return Result.success("success",Map.of("like_count",newNotInRedisCountLike,"liked",true));
     *     }
     *     //取消点赞
     *     public Result<Map<String,Object>> cancelLike(long id, String userId){
     *         if (vm.countVideo(id) == 0) return Result.fail("video bug!");
     *         String likeSetKey="video:like"+id;
     *         String countKey="video:like_count"+id;
     *         Boolean isDone=redisTemplate.opsForSet().isMember(likeSetKey,userId);
     *         //如果本来就没有点赞
     *         if(Boolean.FALSE.equals(isDone)){
     *             long count;
     *             String redisLikeCount=redisTemplate.opsForValue().get(countKey);
     *             if(redisLikeCount!=null) count=Long.parseLong(redisLikeCount);
     *             else count=vm.selectLikeQuantity(id);
     *             return Result.success("cancel the like successfully",Map.of("like_count",count,"liked",false));
     *         }
     *         //如果已经点赞了
     *         redisTemplate.opsForSet().remove(likeSetKey,userId);
     *         redisTemplate.opsForValue().decrement(countKey);
     *         String notInRedisCountLike=redisTemplate.opsForValue().get(countKey);
     *         long newNotInRedisCountLike;
     *         if (notInRedisCountLike != null) newNotInRedisCountLike=Long.parseLong(notInRedisCountLike);
     *         else newNotInRedisCountLike=0;
     *         if(newNotInRedisCountLike<0) newNotInRedisCountLike=0;
     *         return Result.success("cancel the like successfully",Map.of("like_count",newNotInRedisCountLike,"liked",false));
     *     }
     *
     * **/
    /**
     * 点赞
     *
     * **/
    public Result<Map<String,Object>> addLike(long id, String userId){
        if(vm.countVideo(id) == 0) return Result.fail("视频不存在！");

        String likeSetKey = "video:like:" + id;
        String countKey = "video:like_count:" + id;

        // 以 MySQL 为准：INSERT IGNORE 重复点赞不会报错，返回 0 表示已经赞过
        int dbResult = vm.addLike(id, userId);
        if (dbResult > 0) {
            sendLikeNotify(id, userId);
        }

        // 无论 Redis 是否可用，返回给前端的点赞数都回读数据库
        long finalCount = vm.selectLikeQuantity(id);

        // Redis 只做缓存：连不上/超时都不能影响点赞本身
        try {
            redisTemplate.opsForSet().add(likeSetKey, userId);
            redisTemplate.opsForValue().set(countKey, String.valueOf(finalCount));
        } catch (Exception e) {
            log.warn("Redis 点赞缓存更新失败（不影响点赞） videoId={}", id, e);
        }

        return Result.success(dbResult > 0 ? "点赞成功" : "已经点过赞了",
                Map.of("like_count", finalCount, "liked", true));
    }

    /**取消点赞**/
    public Result<Map<String,Object>> cancelLike(long id, String userId){
        if (vm.countVideo(id) == 0) return Result.fail("视频不存在！");

        String likeSetKey = "video:like:" + id;
        String countKey = "video:like_count:" + id;

        // 以 MySQL 为准删除
        int dbResult = vm.cancelLike(id, userId);

        // 返回给前端最新的数据库真实点赞数
        long finalCount = vm.selectLikeQuantity(id);

        // Redis 只做缓存：连不上/超时都不能影响取消点赞本身
        try {
            redisTemplate.opsForSet().remove(likeSetKey, userId);
            redisTemplate.opsForValue().set(countKey, String.valueOf(finalCount));
        } catch (Exception e) {
            log.warn("Redis 取消点赞缓存更新失败（不影响取消） videoId={}", id, e);
        }

        return Result.success("取消点赞成功", Map.of("like_count", finalCount, "liked", false));
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
    /**我的通知列表：最新在前，带触发人昵称头像、摘要、未读标记**/
    public List<Map<String,Object>> selectMyNotifications(String me,int size,int offset){
        return vm.selectMyNotifications(me, size, offset);
    }
    /**写入一条通知**/
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
                e.printStackTrace();
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

    public Flux<String> selectSpecialVideoCommentsForDeepSeek(ChatClient client, long vid, String question) {
        //将阻塞的 MyBatis 查询和字符串拼接包裹在 Mono.fromCallable 中
        Mono<String> commentsMono = Mono.fromCallable(() -> {
                    // ================= 阻塞区域开始 =================
                    // MyBatis 查询，线程会在这里死等数据库返回
                    List<Map<String, Object>> list = vm.selectSpecialVideoCommentsForDeepSeek(vid);

                    StringBuilder sb = new StringBuilder();
                    for (Map<String, Object> map : list) {
                        Object commentId = map.get("comment_id");
                        Object userId = map.get("user_id");
                        Object parentId = map.get("parent_id");
                        Object contents = map.get("contents");
                        Object createTime = map.get("create_time");
                        sb.append("视频Id为").append(vid).append("，父评论是").append(parentId)
                                .append("，父评论的id为").append(commentId).append(",发表此父评论的用户是:").append(userId)
                                .append("，评论内容").append(contents).append("发表时间:").append(createTime);
                    }
                    return sb.toString();
                    // ================= 阻塞区域结束 =================
                })
                //核心：将这个阻塞任务调度到弹性线程池，绝不占用主线程
                .subscribeOn(Schedulers.boundedElastic());

        String systemPrompt = """
            你是一个视频内容分析师。
            如果用户的问题是让你总结视频的评论区，请严格根据我提供的【数据库评论数据】进行总结。
            如果用户问的是其他无关问题，请用你自己的知识回答。
            """;

        // 组装 Prompt 并调用 DeepSeek (Spring AI 的流式接口天然是响应式的)
        return commentsMono.flatMapMany(comments -> {
            String finalQuestion = "视频数据如下：" + comments + "用户最终提问：" + question;

            return client.prompt()
                    .system(systemPrompt)
                    .user(finalQuestion)
                    .stream()
                    .content();
        });
    }
    /**
    * 关于视频审核，禁止色情、暴力、敏感内容，每上传一个视频就审核，调用int uploadVideo(@Param("userId") String userId,
     *  @Param("title") String title,
     *  @Param("videoPath") String videoPath,
     *  @Param("isShort") int isShort,
     *  @Param("durationSec") int durationSec,
     *  @Param("isVertical") int isVertical)接口
    * */
    public boolean checkTitle(long videoId){
        List<String> list=vm.findHitWordsByVideoId(videoId);
        if(list.isEmpty()) {
            log.info("视频审核通过！");
            return true;//没有违规
        }
        else{
            log.error("视频审核不通过！");
            try{
                int k=vm.deleteProhibitedVideo(videoId);
                if (k != 0) log.info("视频已经删除！");
            } catch (Exception e) {
                log.error("删除违规视频出bug{}了！",videoId,e);
            }
            return false;
        }
    }
    /**
     * 让DeepSeek自动实现删除违规评论的功能
     *
     *  //查找包含违禁词的评论ID（利用你现有的 prohibit_words 表）
     *  @Select("""
     *  SELECT vc.comment_id
     *  FROM video_comment vc
     *  JOIN prohibit_words pw ON vc.contents LIKE CONCAT('%', pw.message, '%')
     *  """)
     *  List<String> findViolationCommentIds();
     * */
    /**
     * DeepSeek查出违规评论，实现自动化删评
     * **/
    public List<String> findViolationCommentIds(){
        return vm.findViolationCommentIds();
    }
    /**自动检测并删除违规评论**/
    @Transactional
    public Result<String> auditAndDeleteComments(ChatClient client,long videoId) {
        if (vm.countVideo(videoId) == 0)
            return Result.fail("视频不存在或已被删除");
        if (client == null) {
            log.error("ChatClient 未注入，无法执行 AI 审核");
            return Result.fail("AI 审核服务未就绪");
        }

        // ---------- 查该视频全部评论（双参版，有 comment_id） ----------
        List<Map<String, Object>> allComments = vm.selectCommentsById(videoId, "");
        if (allComments == null || allComments.isEmpty()) {
            return Result.success("该视频下没有评论，无需审核");
        }
        int total = allComments.size();

        // ---------- 用违禁词表做 SQL 粗筛，只留可疑评论 ----------
        // 注意：原来 findViolationCommentIds() 不带 video 条件，会把全站评论拉出来，
        // 不能直接用；这里若没有按 video 过滤的版本，就在 Java 里用 allComments 做匹配。
        List<Map<String, Object>> suspicious = filterSuspiciousByProhibitedWords(videoId, allComments);
        if (suspicious.isEmpty()) {
            log.info("AI 审核 videoId={}：共 {} 条评论，未命中违禁词，跳过 AI 调用", videoId, total);
            return Result.success("审查完毕，共 " + total + " 条评论，未发现违规");
        }
        log.info("AI 审核 videoId={}：共 {} 条评论，粗筛出 {} 条可疑评论送 AI 复核",
                videoId, total, suspicious.size());

        // ---------- 一次性批量送 AI ----------
        StringBuilder sb = new StringBuilder("[\n");
        for (int i = 0; i < suspicious.size(); i++) {
            Map<String, Object> c = suspicious.get(i);
            String id = String.valueOf(c.get("comment_id"));
            String content = String.valueOf(c.get("contents"));
            content = content.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "");
            if (content.length() > 300) content = content.substring(0, 300) + "...";
            sb.append("  {\"comment_id\":\"").append(id)
                    .append("\",\"contents\":\"").append(content).append("\"}");
            if (i < suspicious.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("]");

        String systemPrompt = """
        你是严格的内容审核员。
        判断给定评论中哪些包含：色情、辱骂、暴恐、政治敏感、广告引流。
        输入是一个 JSON 数组，每条含 comment_id 和 contents。
        你必须只返回一个 JSON 数组，元素为违规评论的 comment_id 字符串，
        形如 ["id1","id2"]；如果没有任何违规，返回 []。
        不要输出任何解释、markdown 代码块或多余文字。
        """;
        String userPrompt = "请审核以下评论：\n" + sb;

        // ---------- 调用 AI（批量一次） ----------
        String aiResponse;
        try {
            aiResponse = client.prompt()
                    .system(systemPrompt)
                    .user(userPrompt)
                    .call()
                    .content();
        } catch (Exception e) {
            log.error("AI 审核调用失败 videoId={}", videoId, e);
            return Result.fail("AI 审核服务调用失败：" + e.getMessage());
        }

        // ---------- 解析 AI 返回，取交集防幻觉 ----------
        List<String> violationIds = parseViolationIds(aiResponse);
        if (violationIds.isEmpty()) {
            log.info("AI 审核 videoId={}：可疑 {} 条，AI 判定均未违规", videoId, suspicious.size());
            return Result.success("审查完毕，共 " + total + " 条评论，未发现违规");
        }
        Set<String> suspiciousIdSet = new HashSet<>();
        for (Map<String, Object> c : suspicious) {
            suspiciousIdSet.add(String.valueOf(c.get("comment_id")));
        }
        List<String> finalIds = new ArrayList<>();
        for (String id : violationIds) {
            if (suspiciousIdSet.contains(id) && !finalIds.contains(id)) {
                finalIds.add(id);
            }
        }
        if (finalIds.isEmpty()) {
            return Result.success("审查完毕，共 " + total + " 条评论，未发现违规");
        }

        // ---------- 6. 删除（连带楼中楼回复） ----------
        int deleted = 0;
        for (String id : finalIds) {
            try {
                // 先删子回复，再删父评论（parent_id 无外键级联）
                deleted += vm.deleteRepliesByParent(id);
                deleted += vm.deleteCommentById(id);
            } catch (Exception e) {
                log.error("删除违规评论失败 commentId={}", id, e);
            }
        }
        log.info("AI 审核 videoId={}：判定违规 {} 条，实际删除 {} 行（含回复）",
                videoId, finalIds.size(), deleted);

        return Result.success(
                "审查完毕：共 " + total + " 条评论，粗筛 " + suspicious.size()
                        + " 条可疑，AI 判定违规 " + finalIds.size()
                        + " 条，已删除（含回复）共 " + deleted + " 行");
    }
    /**
     * 用 prohibit_words 表在 Java 侧对"该视频的评论"做粗筛。
     * 之所以不放 SQL：现有的 findViolationCommentIds() 没带 video 条件，
     * 直接加 SQL 又要动 Mapper；这里用现成的 getProhibitedWords() 在内存匹配即可。
     */
    private List<Map<String, Object>> filterSuspiciousByProhibitedWords(
            long videoId, List<Map<String, Object>> allComments) {
        List<Map<String, Object>> words = vm.getProhibitedWords();
        if (words == null || words.isEmpty()) return List.of();
        List<String> badWords = new ArrayList<>();
        for (Map<String, Object> w : words) {
            Object m = w.get("message");
            if (m != null) badWords.add(String.valueOf(m));
        }
        if (badWords.isEmpty()) return List.of();

        List<Map<String, Object>> suspicious = new ArrayList<>();
        for (Map<String, Object> c : allComments) {
            String content = String.valueOf(c.get("contents"));
            if (content == null) continue;
            for (String w : badWords) {
                if (!w.isEmpty() && content.contains(w)) {
                    suspicious.add(c);
                    break;
                }
            }
        }
        return suspicious;
    }

    /**
     * 解析 AI 返回的 comment_id 数组，容错 markdown 代码块和前后解释文字。
     */
    private List<String> parseViolationIds(String aiResponse) {
        if (aiResponse == null || aiResponse.isBlank()) return List.of();
        String s = aiResponse.trim();
        if (s.startsWith("```")) {
            int firstNl = s.indexOf('\n');
            int lastFence = s.lastIndexOf("```");
            if (firstNl > 0 && lastFence > firstNl) {
                s = s.substring(firstNl + 1, lastFence).trim();
            }
        }
        int lb = s.indexOf('[');
        int rb = s.lastIndexOf(']');
        if (lb < 0 || rb <= lb) {
            log.warn("AI 返回格式无法解析：{}", aiResponse);
            return List.of();
        }
        String arr = s.substring(lb + 1, rb).trim();
        if (arr.isEmpty()) return List.of();
        List<String> ids = new ArrayList<>();
        for (String part : arr.split(",")) {
            String id = part.trim().replaceAll("^\"|\"$", "");
            if (!id.isEmpty()) ids.add(id);
        }
        return ids;
    }
    /**
     * DeepSeek扫描评论表，查看是否存在某条评论存在“@DeepSeek”字段，如果存在，则意味着发表评论的人在呼叫DeepSeek需要回答问题。
     *   用到接口List<Map<String, Object>> allComments = vm.selectCommentsByIdOnlyOneArgument(videoId);
     *   DeepSeek评论入库:Result<Map<String,Object>> addComment(String commentId,long videoId,String userId,String content,String parentId)，
     *   DeepSeek 虚拟用户 ID，对应 console.sql 里 INSERT 的 AI_BOT
     * **/
    private static final String DEEPSEEK_USER_ID = "AI_BOT";

    public Flux<String> detectCommentsIsHaveAtDeepSeek(ChatClient client, long videoId) {
        List<Map<String, Object>> comments = vm.selectCommentsByIdOnlyOneArgument(videoId);
        Optional<Map<String, Object>> targetComment = comments.stream()
                .filter(m -> {
                    Object c = m.get("contents");
                    return c != null && String.valueOf(c).contains("@DeepSeek");
                })
                .reduce((first, second) -> second);

        if (targetComment.isEmpty())
            return Flux.just("目前没有人@DeepSeek哦~");

        Map<String, Object> comment = targetComment.get();
        String rawContents = String.valueOf(comment.get("contents"));
        String questionContent = rawContents.replace("@DeepSeek", "").trim();
        String askUserId  = String.valueOf(comment.get("user_id"));
        String parentId   = String.valueOf(comment.get("comment_id"));  // 回复挂在这条评论下

        //防御同一个parentId下AI已经回复过，不再重复入库（防前端重连/刷新重复触发）
        Integer exist = vm.countReplyByUser(parentId, DEEPSEEK_USER_ID);
        if (exist != null && exist > 0) {
            log.info("parentId={} 下已有 AI_BOT 回复，跳过重复入库", parentId);
            // 仍然把已有的回复流式返回给前端（或直接返回提示）
            return Flux.just("DeepSeek 已经回答过这个问题了~");
        }

        String systemPrompt = """
        你是一个智能视频评论助手。
        现在有用户在评论区向你提问，请根据他的问题给出回答。
        回答时不要暴露你是 AI 模型，可以直接以友好的语气回复。
        """;
        String finalUserPrompt = "用户（ID：" + askUserId + "）向你提问：\n" + questionContent;

        //结束时一次性入库
        StringBuilder answerBuf = new StringBuilder();
        return client.prompt()
                .system(systemPrompt)
                .user(finalUserPrompt)
                .stream()
                .content()
                .doOnNext(chunk -> {
                    if (chunk != null) answerBuf.append(chunk);
                })
                .doOnComplete(() -> {
                    String answer = answerBuf.toString().trim();
                    if (answer.isEmpty()) {
                        log.warn("DeepSeek 返回空内容，跳过入库 videoId={} parentId={}", videoId, parentId);
                        return;
                    }
                    try {
                        String newCommentId = new RandomlyCreateID().createId();
                        //入库video_comment（user_id=AI_BOT，parent_id=被@的评论）
                        int k = vm.addComment(newCommentId, videoId, DEEPSEEK_USER_ID,
                                answer, parentId);
                        if (k > 0) {
                            log.info("DeepSeek 回复已入库 commentId={} videoId={} parentId={}",
                                    newCommentId, videoId, parentId);
                            //通知提问者（sendCommentNotify 内部会查 parentId 的 commentOwner）
                            sendCommentNotify(newCommentId, videoId,
                                    DEEPSEEK_USER_ID, answer, parentId);
                        } else {
                            log.warn("DeepSeek 回复入库返回 0 行 videoId={}", videoId);
                        }
                    } catch (Exception e) {
                        log.error("DeepSeek 回复入库异常 videoId={} parentId={}",
                                videoId, parentId, e);
                    }
                })
                .doOnError(e -> log.error("DeepSeek 流式回答异常 videoId={}", videoId, e));
    }

}