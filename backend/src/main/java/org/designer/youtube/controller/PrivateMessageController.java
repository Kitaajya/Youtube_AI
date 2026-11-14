package org.designer.youtube.controller;

import lombok.RequiredArgsConstructor;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.entity.PrivateMessage;
import org.designer.youtube.service.PrivateMessageService;
import org.designer.youtube.service.VideoFileService;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;


/**
 *
 *
 *
 *
 * @since  2026/10/11/16:05
 * @author Kitaajya/Conan Doyle
 * @说明 截止2026/10/16/8:34，我已经修复了通知红点bug，前端部分进行了重构，使之与原YouTube更相似。
 * 以上的红点bug注释作废.前端部分进行了重构，使之与原YouTube更相似。
 * 新增了历史功能->查询与自动插入观看历史。
 * @自:  2026/10/17/11:00
 *
 * 短视频模块搭建完成。
 * 短视频原本默认无声，现在改成了有声。新增搜索栏的语音功能
 * @自: 2026/10/23/23:00 私信新增群聊功能上线
 *
 *
 *
 *
 *
 *
 *
 * **/

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/private_message")
public class PrivateMessageController {
    private final PrivateMessageService privateMessageService;
    private final VideoFileService videoFileService;
    private final RandomlyCreateID createGroupId;
    private final ChatClient client;
    /**展示我和某人的完整对话，双向，按时间正序**/
    @GetMapping("/select/message")
    public Result<List<PrivateMessage>> selectOurMessage(@RequestParam String a, @RequestParam String b) {
        return Result.success(privateMessageService.selectOurMessage(a, b));
    }

    /**我的收件箱：会话列表（每个对话最后一句 + 未读数 + 对方昵称）**/
    @GetMapping("/select/inbox")
    public Result<List<Map<String, Object>>> selectInbox(@RequestParam String me) {
        return Result.success(privateMessageService.selectInbox(me));
    }

    /**别人发给我的未读总数**/
    @GetMapping("/count/unread")
    public Result<Map<String, Object>> countUnread(@RequestParam String me) {
        return Result.success(Map.of("count", privateMessageService.countUnread(me)));
    }

    /**把某人发给我的消息标记已读（打开对话时调用）**/
    @PostMapping("/read")
    public Result<Map<String, Object>> markRead(@RequestParam String me, @RequestParam String other) {
        privateMessageService.markRead(me, other);
        return Result.successMessage("已读标记完成");
    }

    /**我发送私信（msgId 由 Service 调RandomlyCreateID填好再传进来）**/
    @PostMapping("/send")
    public Result<Map<String, Object>> send(@ModelAttribute PrivateMessage privateMessage) {
        return privateMessageService.send(privateMessage);
    }

    /**从我这里删除发出的信息，但是对方依旧能看得到。因为这不是撤回操作，软删除**/
    @PostMapping("/delete/private/message")
    public Result<Map<String, Object>> deleteFromMySide(@RequestParam String msgId, @RequestParam String userId) {
        return privateMessageService.deleteFromMySide(msgId, userId);
    }

    /**撤回操作**/
    @PostMapping("/withdraw/private/message")
    public Result<Map<String, Object>> withdraw(@RequestParam String msgId, @RequestParam String userId, @RequestParam int timeWithdraw) {
        return privateMessageService.withdraw(msgId, userId, timeWithdraw);
    }

    /**私信功能要求不仅仅是可以互相发送文字，还可以发送视频与图片**/
    @PostMapping("/send/picture/video")
    public Result<Map<String, Object>> sendPictureOfVideo(@ModelAttribute PrivateMessage privateMessage) {
        return privateMessageService.sendPictureOrVideo(privateMessage);
    }

    // 私信媒体上传：先把图片/视频文件传到服务器落盘，拿 mediaPath 后再调上面的发送接口入库
    @PostMapping("/upload/media")
    public Result<Map<String, Object>> uploadPmMedia(@RequestParam MultipartFile file) {
        return videoFileService.uploadPmMedia(file);
    }

    /**发送表情包**/
    @PostMapping("/send/emoji")
    public Result<Map<String, Object>> sendEmoji(@ModelAttribute PrivateMessage privateMessage) {
        return privateMessageService.sendEmoji(privateMessage);
    }

    /**查看表情包列表（选择器用；传 me 时把"我上传的"一并返回）**/
    @GetMapping("/emoji/list")
    public Result<List<Map<String, Object>>> emojiList(@RequestParam(required = false) String me) {
        return privateMessageService.selectEmojiList(me);
    }

    /**我上传的表情列表（管理面板用）**/
    @GetMapping("/emoji/my/list")
    public Result<List<Map<String, Object>>> myEmojiList(@RequestParam String me) {
        return privateMessageService.selectMyEmojiList(me);
    }

    /**删除我上传的表情（软删除，历史消息不影响）**/
    @PostMapping("/emoji/delete")
    public Result<Map<String, Object>> deleteMyEmoji(@RequestParam String emojiId, @RequestParam String ownerId) {
        return privateMessageService.disableUserEmoji(emojiId, ownerId);
    }

    /**右键收藏别人发的表情到"我的表情"（仅登记引用，不改动原文件）**/
    @PostMapping("/emoji/add/from/message")
    public Result<Map<String, Object>> addEmojiFromMessage(@RequestParam String ownerId,
                                                           @RequestParam String fileName,
                                                           @RequestParam(required = false) String rawName) {
        return privateMessageService.addEmojiFromMessage(ownerId, fileName, rawName);
    }

    /**
     * 建立一个三人以上的群聊
     **/
    //拉群主，群主建群
    @PostMapping("/establish/group")
    public Result<Map<String, Object>> establishGroup(@RequestParam String groupName,
                                                      @RequestParam String ownerId) {
        RandomlyCreateID createGroupId=new RandomlyCreateID();
        String id=createGroupId.createId();
        return privateMessageService.establishGroup(id, groupName, ownerId);
    }

    /**拉人**/
    @PostMapping("/add/member")
    public Result<Map<String, Object>> addGroupMember(@RequestParam String groupId, @RequestParam String userId,@RequestParam String fromUser) {
        return privateMessageService.addGroupMember(groupId, userId,fromUser);
    }

    /**群主踢人**/
    @PostMapping("/remove/member")
    public Result<Map<String, Object>> removeGroupMember(@RequestParam String groupId,
                                                         @RequestParam String userId,
                                                         @RequestParam String groupOwner) {
        return privateMessageService.removeGroupMember(groupId, userId, groupOwner);
    }
    /**查看群聊消息（me=当前查看的人，本人已软删除的消息不再返回；不传则不过滤，供内部调用兜底）**/
    @GetMapping("/select/group/message")
    public Result<List<Map<String,Object>>> selectGroupMessage(@RequestParam String groupId,
                                                               @RequestParam(required = false) String me){
        return Result.success(privateMessageService.selectGroupMessage(groupId, me));
    }
    /**
     * @since 2026/11/10/21:30
     * @功能: 群聊消息软删除：只删发送者自己这边的显示，其他群友照常可见（非撤回）
     */
    @PostMapping("/delete/group/message")
    public Result<Map<String, Object>> deleteGroupMessageFromMySide(@RequestParam String msgId, @RequestParam String userId) {
        return privateMessageService.deleteGroupMessageFromMySide(msgId, userId);
    }
    //向群聊中发消息
    @PostMapping("/add/group/message")
    public Result<Map<String,Object>> sendMessageToGroup(
            @RequestParam(required = false) String msgId, // 允许前端传 msgId
            @RequestParam String groupId,
            @RequestParam String fromUser,
            @RequestParam(required = false) String contents,
            @RequestParam(defaultValue = "text") String msgType,
            @RequestParam(required = false) String mediaPath) {
        // 如果前端没传，才自动生成
        if (msgId == null || msgId.isBlank()) msgId = createGroupId.createId();
        return privateMessageService.sendMessageToGroup(msgId, groupId, fromUser, contents, msgType, mediaPath);
    }
    // 查询我加入的群（前端私信页加载时调用）
    @GetMapping("/select/my/groups")
    public Result<List<Map<String, Object>>> selectMyGroups(@RequestParam String me) {
        return Result.success(privateMessageService.selectMyGroups(me));
    }
    //把DeepSeek插入群聊里，使之总结聊天内容、与人聊天。先查询聊天记录数据库
    @GetMapping("/select/group/message/deepseek")
    public Flux<String> selectGroupMessageForDeepSeek(@RequestParam String question,@RequestParam String groupId){
        return privateMessageService.selectGroupMessageForDeepSeek(this.client,groupId,question);
    }
    /**关于退群与群主转让**/
    @PostMapping("/exit/group")
    public Result<Map<String,Object>> exitMyGroup(@RequestParam String groupId, @RequestParam String userId){
        return privateMessageService.exitMyGroup(groupId, userId);
    }
    /**查看当前群聊的成员信息**/
    @GetMapping("/select/group/member")
    public Result<List<Map<String, Object>>>selectMemberInformation(@RequestParam String groupId){
        return privateMessageService.selectMemberInformation(groupId);
    }

    /**
     * @since 2026/11/05/20:21
     * @author Kitaajya/Conan Doyle
     * @功能: 私信屏蔽
     * @table: private_message_block
     * **/
    @PostMapping("/block/pm")
    public Result<Map<String,Object>> blockUserForPrivateMessage(@RequestParam String upId,
                                                                 @RequestParam String userId){
        return privateMessageService.blockUserInPrivateMessage(upId, userId);
    }
    @PostMapping("/unblock/pm")
    public Result<Map<String,Object>> unblockUserForPrivateMessage(@RequestParam String upId,
                                                                   @RequestParam String userId){
        return privateMessageService.unblockUserInPrivateMessage(upId, userId);
    }
    /**我屏蔽了谁：前端刷新/清缓存后靠它恢复屏蔽状态，不用只信 localStorage**/
    @GetMapping("/block/list")
    public Result<List<String>> selectBlockedUsersForPrivateMessage(@RequestParam String upId){
        return Result.success(privateMessageService.selectBlockedUsersInPrivateMessage(upId));
    }
    /**
     * @since 2026/11/10/15:00
     * @功能: 群聊消息撤回。仅发送者本人、发送后 timeWithdraw 秒内、且未撤回过的消息可撤回。
     *        撤回后正文清空、媒体清空、msg_type 重置为 text，前端显示"消息已撤回"。
     * @see #withdraw(String, String, int)
     */
    @PostMapping("/withdraw/private/group/message")
    public Result<Map<String,Object>> withdrawGroupMessage(@RequestParam String msgId,@RequestParam String userId,@RequestParam int timeWithdraw){
        return privateMessageService.withdrawGroupMessage(msgId, userId, timeWithdraw);
    }
    /**
     * @since 2026/11/12（2026/11/14 补全文件落盘）
     * @功能: 用户上传表情包。一次请求完成"图片落盘 -> 校验 -> 入库"，
     *        落盘文件名以 emoji_ 开头，对外走 /videos/**；入库失败会回收文件。
     * @param file     图片本体（multipart，png/jpg/jpeg/gif/webp，<=2MB）
     * @param ownerId  上传者
     * @param rawName  用户可读名，缺省取原文件名去扩展名
     */
    @PostMapping("/upload/user/emoji")
    public Result<Map<String,Object>> uploadUserEmoji(@RequestParam MultipartFile file,
                                                      @RequestParam String ownerId,
                                                      @RequestParam(required = false) String rawName){
        Result<Map<String,Object>> saved = videoFileService.uploadUserEmoji(file);
        if (!saved.isSuccess()) return saved;
        String fileName = String.valueOf(saved.getData().get("fileName"));
        Result<Map<String,Object>> reg;
        try {
            reg = privateMessageService.uploadUserEmoji(ownerId, fileName, rawName);
        } catch (Exception e) {
            // 入库异常（唯一键冲突、外键等）也要回收文件，不能只处理 Result.fail
            videoFileService.deleteEmojiFile(fileName);
            return Result.fail("上传失败，请稍后重试");
        }
        if (!reg.isSuccess()) {
            videoFileService.deleteEmojiFile(fileName);
            return reg;
        }
        // 把可访问地址一并返回，前端可直接预览
        Map<String,Object> data = new java.util.HashMap<>(reg.getData());
        data.put("fileName", fileName);
        data.put("url", saved.getData().get("url"));
        return Result.success("上传成功", data);
    }
}
