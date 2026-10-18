package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.entity.PrivateMessage;
import org.designer.youtube.mapper.PrivateMessageMapper;
import org.jspecify.annotations.NonNull;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 *
 * 私信业务代码
 *
 *
 * 2026/10/11/15:51
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
@Service
@RequiredArgsConstructor
@Component
public class PrivateMessageService {
    private final PrivateMessageMapper privateMessageMapper;

    // 我的收件箱：会话列表（每个对话最后一句 + 未读数 + 对方昵称）
    public List<Map<String, Object>> selectInbox(String me) {
        if (me == null || me.isEmpty()) return List.of();
        return privateMessageMapper.selectInbox(me);
    }

    // 别人发给我的未读总数
    public int countUnread(String me) {
        if (me == null || me.isEmpty()) return 0;
        return privateMessageMapper.countUnread(me);
    }

    // 打开与某人的对话后，把对方发来的消息标记已读
    public void markRead(String me, String other) {
        if (me == null || me.isEmpty() || other == null || other.isEmpty()) return;
        privateMessageMapper.markRead(me, other);
    }

    // 展示我和某人的完整对话，双向，按时间正序
    public List<PrivateMessage> selectOurMessage(String a,String b){
        return privateMessageMapper.selectOurMessage(a,b);
    }
    // 我发送私信（msgId 由 Service 调RandomlyCreateID填好再传进来）
    public Result<Map<String,Object>> send(@NonNull PrivateMessage privateMessage){
        String content=privateMessage.getContents();
        if(content==null||content.isEmpty()) return Result.fail("发送信息不能为空！");
        if(privateMessage.getFromUser()==null) return Result.fail("发件人不能为空");
        if(privateMessage.getToUser()==null) return Result.fail("目标人不能为空");
        privateMessage.setContents(content);
        RandomlyCreateID randomlyCreateID = new RandomlyCreateID();
        privateMessage.setMsgId(randomlyCreateID.createId());
        privateMessage.setIsRead(0);
        int k= privateMessageMapper.send(privateMessage);
        if(k==0) return Result.fail("发送失败！");
        return Result.success("发送成功！",Map.of("msgId",privateMessage.getMsgId()));
    }

    //从我这里删除发出的信息，但是对方依旧能看得到。因为这不是撤回操作，软删除
    public Result<Map<String,Object>> deleteFromMySide(String msgId,String userId){
        try{
            int k= privateMessageMapper.deleteFromMySide(msgId, userId);
            if(k!=0) return Result.success("删除成功！",Map.of("success",true));
        }catch (DuplicateKeyException esq){
            return Result.success("已经删除过一次了！",Map.of("success",true));
        }
        return Result.fail("删除失败！");
    }
    //撤回操作
    public Result<Map<String,Object>> withdraw(String msgId,String userId,int timeWithdraw){
        try {
            int k= privateMessageMapper.withdraw(msgId, userId, timeWithdraw);
            if(k!=0) return Result.success("撤回成功！",Map.of("success",true));
        }catch (DuplicateKeyException esq){
            return Result.success("你已经撤回过一次了！",Map.of("success",true));
        }
        return Result.fail("撤回失败！");
    }
}
