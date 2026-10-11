package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.entity.PrivateMessage;
import org.designer.youtube.mapper.PrivateMessageMapper;
import org.jspecify.annotations.NonNull;
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
}
