package org.designer.youtube.controller;

import lombok.RequiredArgsConstructor;
import org.designer.youtube.common.Result;
import org.designer.youtube.entity.PrivateMessage;
import org.designer.youtube.service.PrivateMessageService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;


/**
 *
 * 私信控制层代码
 *
 *
 * 2026/10/11/16:05
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


@RequiredArgsConstructor
@RestController
@RequestMapping("/api/private_message")
public class PrivateMessageController {
    private final PrivateMessageService privateMessageService;
    // 展示我和某人的完整对话，双向，按时间正序
    @GetMapping("/select/message")
    public Result<List<PrivateMessage>> selectOurMessage(@RequestParam String a,@RequestParam String b){
        return Result.success(privateMessageService.selectOurMessage(a,b));
    }
    // 我的收件箱：会话列表（每个对话最后一句 + 未读数 + 对方昵称）
    @GetMapping("/select/inbox")
    public Result<List<Map<String,Object>>> selectInbox(@RequestParam String me){
        return Result.success(privateMessageService.selectInbox(me));
    }
    // 别人发给我的未读总数
    @GetMapping("/count/unread")
    public Result<Map<String,Object>> countUnread(@RequestParam String me){
        return Result.success(Map.of("count", privateMessageService.countUnread(me)));
    }
    // 把某人发给我的消息标记已读（打开对话时调用）
    @PostMapping("/read")
    public Result<Map<String,Object>> markRead(@RequestParam String me,@RequestParam String other){
        privateMessageService.markRead(me,other);
        return Result.successMessage("已读标记完成");
    }
    @PostMapping("/send")
    // 我发送私信（msgId 由 Service 调RandomlyCreateID填好再传进来）
    public Result<Map<String,Object>> send(@ModelAttribute PrivateMessage privateMessage) {
        return privateMessageService.send(privateMessage);
    }
}
