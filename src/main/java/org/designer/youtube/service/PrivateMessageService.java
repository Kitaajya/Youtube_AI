package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.entity.PrivateMessage;
import org.designer.youtube.mapper.PrivateMessageMapper;
import org.jspecify.annotations.NonNull;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

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
    //私信功能要求不仅仅是可以互相发送文字，还可以发送视频与图片
    public Result<Map<String,Object>> sendPictureOrVideo(PrivateMessage privateMessage){
        if (privateMessage.getFromUser() == null) return Result.fail("发件人不能为空");
        if (privateMessage.getToUser() == null) return Result.fail("目标人不能为空");
        String mediaPath = privateMessage.getMediaPath();
        if (mediaPath == null || mediaPath.isEmpty()) return Result.fail("媒体文件不能为空");

        String ext = mediaPath.contains(".")
                ? mediaPath.substring(mediaPath.lastIndexOf('.') + 1).toLowerCase()
                : "";
        if (List.of("jpg","jpeg","png","gif","webp","bmp").contains(ext)) privateMessage.setMsgType("image");
        else if (List.of("mp4","webm","mov","m4v").contains(ext)) privateMessage.setMsgType("video");
        else return Result.fail("不支持的媒体类型：" + ext);   // 防乱上传

        privateMessage.setContents("");
        RandomlyCreateID id = new RandomlyCreateID();
        privateMessage.setMsgId(id.createId());
        privateMessage.setIsRead(0);
        int k = privateMessageMapper.sendPictureOrVideo(privateMessage);
        if (k == 0) return Result.fail("发送失败！");
        return Result.success("发送成功！", Map.of("msgId", privateMessage.getMsgId()));
    }

    //发送表情包（INSERT 已固定 contents=''/is_read=0/msg_type='emoji'，实体只需备好 msgId/fromUser/toUser/mediaPath）
    public Result<Map<String,Object>> sendEmoji(PrivateMessage privateMessage){
        if (privateMessage.getFromUser() == null) return Result.fail("发件人不能为空");
        if (privateMessage.getToUser() == null)   return Result.fail("目标人不能为空");
        String fileName = privateMessage.getMediaPath();
        if (fileName == null || fileName.isEmpty()) return Result.fail("表情不能为空");
        // 白名单：只认 emoji_item 里登记过且未下架的文件
        if (privateMessageMapper.countEnabledEmoji(fileName) == 0) return Result.fail("表情不存在或已下架");

        RandomlyCreateID id = new RandomlyCreateID();
        privateMessage.setMsgId(id.createId());
        int k = privateMessageMapper.sendEmoji(privateMessage);
        if (k == 0) return Result.fail("发送失败！");
        return Result.success("发送成功！", Map.of("msgId", privateMessage.getMsgId()));
    }
    //查看表情包
    public Result<List<Map<String,Object>>> selectEmojiList(){
        return Result.success(privateMessageMapper.selectEmojiList());
    }
    /**表情包塞给DeepSeek**/
    public Flux<String> getPrivateMessageEmojiForDeepSeek(ChatClient client, String question){
        List<Map<String,Object>> list=privateMessageMapper.getPrivateMessageEmojiForDeepSeek();
        StringBuilder k=new StringBuilder();
        if(list==null||list.isEmpty()) k.append("当前没有表情包！");
        else{
            for(Map<String,Object> map:list){
                Object emojiId=map.get("emoji_id");
                Object name=map.get("name");
                Object fileName=map.get("file_name");
                //上架时间
                Object createTime=map.get("create_time");
                //人
                Object pack=map.get("pack");
                k.append("表情包id").append(emojiId).append(",表情包名称:").append(name)
                        .append("表情包文件名称：").append(fileName).append(",表情包上架时间：").append(createTime)
                        .append(",表情包人名：").append(pack);
            }
        }
        String systemPrompt= """
                用户提问的如果是表情包内容，那就根据我数据库里的信息给他回答。若不是，比如问了一些数理化、日常聊天、代码等问题就如实回答。
                """;
        String finalQuestion="表情包数据库如下："+ k +"\n"+"用户提问：\n"+question;
        return client.prompt().system(systemPrompt).user(finalQuestion).stream().content();
    }
    /**
     * 建立一个三人以上的群聊
     * 2026/10/23/20:53
     *
     * 群聊数据库：
     *  chat_group
     字段名	     类型	     作用	            设计亮点
     group_id	VARCHAR(13)	群号（主键）	延续了你项目 13 位随机字符串的规范，比自增数字更安全，防爬防遍历。
     group_name	VARCHAR(50)	群名称	限制 50 字符，防止有人起超长名字把前端 UI 撑爆。
     owner_id	VARCHAR(13)	群主ID	记录这个群是谁建的，方便后续做“解散群”、“踢人”等权限控制。
     create_time	DATETIME	建群时间	默认当前时间，方便按建群时间倒序排列“我最近加了什么群”。
     * **/
    // 建立群聊（这里只负责建群并拉群主，拉别人可以再写个方法）
    public Result<Map<String,Object>> establishGroup(String groupId, String groupName, String ownerId){
        if(groupName == null || groupName.trim().isEmpty()) return Result.fail("群名不得为空！");
        if(ownerId == null) return Result.fail("群主不得为空！");
        if(groupId == null) return Result.fail("系统出了bug，群号生成失败！");
        int k = privateMessageMapper.establishGroup(groupId, groupName, ownerId);
        if(k == 0) return Result.fail("建立失败！");
        //把群主拉进群，插入 group_member 表
        privateMessageMapper.addGroupMember(groupId, ownerId);
        return Result.success("建立成功", Map.of("groupId", groupId));
    }
    //在原有的群里拉人
    public Result<Map<String,Object>> addGroupMember(String groupId,String userId){
        if(userId==null) return Result.fail("用户不得为空！");
        int k=privateMessageMapper.addGroupMember(groupId, userId);
        if(k==0) return Result.fail("拉人失败！重新拉人！");
        return Result.success("成功！",Map.of("userId",userId));
    }
}
