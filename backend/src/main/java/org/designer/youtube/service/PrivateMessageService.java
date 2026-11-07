package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.entity.PrivateMessage;
import org.designer.youtube.mapper.PrivateMessageMapper;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.*;

/**
 *
 *
 *
 * @since  2026/10/11/15:51
 * @author Kitaajya/Conan Doyle
 *
 * @描述 截止2026/10/26/09:26，仍有bug未被修复：群主拉人进群，被拉者无法得知自己在群中，且群众有人发消息时，其余人也无法获取红点通知。
 *
 * 现在bug已经修复了，可以正常使用
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
    private final ChatClient chatClient;
    private Logger log=LoggerFactory.getLogger(PrivateMessageService.class);
    // 我的收件箱：会话列表（每个对话最后一句 + 未读数 + 对方昵称）
    public List<Map<String, Object>> selectInbox(String me) {
        if (me == null || me.isEmpty()) return List.of();
        // 查所有消息
        List<Map<String, Object>> allMsgs = privateMessageMapper.selectInbox(me);
        // 用 LinkedHashMap 保持最新消息的顺序
        Map<String, Map<String, Object>> latestMap = new LinkedHashMap<>();
        for (Map<String, Object> msg : allMsgs) {
            String fromUser = String.valueOf(msg.get("fromUser"));
            String toUser = String.valueOf(msg.get("toUser"));

            // 计算对话对象
            String peer = fromUser.equals(me) ? toUser : fromUser;

            if (!latestMap.containsKey(peer)) {
                // 拷贝一份原数据，保持你原有的字段（fromUser, toUser, contents 等）
                Map<String, Object> row = new HashMap<>(msg);

                // 按照你前端要求的字段名塞进去
                row.put("peerId", peer);

                // 处理预览文字（替代原来 SQL 里的 CASE WHEN）
                String msgType = String.valueOf(msg.get("msgType") == null ? "text" : msg.get("msgType"));
                String contents = String.valueOf(msg.get("contents"));
                int isWithdrawn = Integer.parseInt(String.valueOf(msg.get("isWithdrawn") == null ? 0 : msg.get("isWithdrawn")));

                if (isWithdrawn == 1) {
                    row.put("lastMsg", "[已撤回]");
                } else if ("image".equals(msgType)) {
                    row.put("lastMsg", "[图片]");
                } else if ("video".equals(msgType)) {
                    row.put("lastMsg", "[视频]");
                } else if ("voice".equals(msgType)) {
                    row.put("lastMsg", "[语音]");
                } else if ("emoji".equals(msgType)) {
                    row.put("lastMsg", "[表情]");
                } else if ("birthday".equals(msgType)) {
                    row.put("lastMsg", "[生日祝福]");
                } else {
                    row.put("lastMsg", contents.length() > 30 ? contents.substring(0, 30) : contents);
                }
                row.put("lastTime", msg.get("createTime"));
                // 对端昵称 + 头像：SQL 已经 JOIN 出来了，取不到才退回显示 peer ID
                Object pn = msg.get("peerName");
                Object pa = msg.get("peerAvatar");
                String peerName = pn == null ? "" : String.valueOf(pn).trim();
                row.put("peerName", peerName.isEmpty() ? peer : peerName);
                row.put("peerAvatar", pa == null ? "" : String.valueOf(pa));
                int unreadCount = privateMessageMapper.countUnreadFromPeer(me, peer);
                row.put("unread", unreadCount);
                latestMap.put(peer, row);
            }
        }
        return new ArrayList<>(latestMap.values());
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
        //检查接收方 (toUser) 是否把发送方 (fromUser) 给屏蔽了
        int isBlocked = privateMessageMapper.checkBlockStatus(privateMessage.getToUser(), privateMessage.getFromUser());
        if (isBlocked > 0)
            // 为了不暴露“你被拉黑了”这种尴尬事实，通常统一提示发送失败或拒收
            return Result.fail("对方已拒收你的消息");
        privateMessage.setContents(content);
        // 普通文字消息默认 text；生日祝福等特殊消息由前端传 msgType 进来
        if (privateMessage.getMsgType() == null || privateMessage.getMsgType().isBlank())
            privateMessage.setMsgType("text");
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
        // 屏蔽要拦在所有发送入口上：只拦 send() 的话，被拉黑的人换成发图片/视频照样能发进来
        int isBlocked = privateMessageMapper.checkBlockStatus(privateMessage.getToUser(), privateMessage.getFromUser());
        if (isBlocked > 0) return Result.fail("对方已拒收你的消息");
        String mediaPath = privateMessage.getMediaPath();
        if (mediaPath == null || mediaPath.isEmpty()) return Result.fail("媒体文件不能为空");

        String ext = mediaPath.contains(".")
                ? mediaPath.substring(mediaPath.lastIndexOf('.') + 1).toLowerCase()
                : "";
        // 允许落盘的媒体扩展名白名单（含语音常用容器），不在表内直接拒收
        boolean allowedExt = List.of("jpg","jpeg","png","gif","webp","bmp",
                        "mp4","webm","mov","m4v","mp3","wav","ogg","m4a").contains(ext);
        if (!allowedExt) return Result.fail("不支持的媒体类型：" + ext);   // 防乱上传

        // webm/ogg 既可能是视频也可能是语音，只靠扩展名分不开。
        // 因此优先采信前端显式传来的 msgType（限 image/video/voice），
        // 前端没传或不合法时，再回退到按扩展名推断。
        String frontType = privateMessage.getMsgType();
        if (frontType != null && List.of("image","video","voice").contains(frontType)) {
            privateMessage.setMsgType(frontType);
        } else if (List.of("jpg","jpeg","png","gif","webp","bmp").contains(ext)) {
            privateMessage.setMsgType("image");
        } else if (List.of("mp4","webm","mov","m4v").contains(ext)) {
            privateMessage.setMsgType("video");
        } else {
            privateMessage.setMsgType("voice");
        }

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
        // 同上：表情包也是私信发送入口，被屏蔽的人不能靠它绕过屏蔽
        int isBlocked = privateMessageMapper.checkBlockStatus(privateMessage.getToUser(), privateMessage.getFromUser());
        if (isBlocked > 0) return Result.fail("对方已拒收你的消息");
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
     *
     * @since 2026/10/23/20:53
     * @描述 建立一个三人以上的群聊
     *
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
    //在原有的群里拉人
    @Transactional(rollbackFor = Exception.class) //加上事务，保证拉人和通知的一致性
    public Result<Map<String,Object>> addGroupMember(String groupId, String userId, String fromUser){
        if (groupId == null || groupId.isBlank()) return Result.fail("群号不能为空！");
        if (userId == null || userId.isBlank()) return Result.fail("用户不得为空！");
        if (fromUser == null || fromUser.isBlank()) return Result.fail("邀请人不能为空！");

        //校验被拉的人是否存在
        if (privateMessageMapper.countUser(userId) == 0) return Result.fail("用户不存在，无法拉入群聊！");
        //顺便校验一下邀请人（群主）是否存在，防止 fromUser 乱传导致通知表外键报错
        if (privateMessageMapper.countUser(fromUser) == 0) return Result.fail("邀请人不存在！");

        //拉人入库（加了 INSERT IGNORE，重复拉不会报错，返回 0 说明已经在了）
        int k = privateMessageMapper.addGroupMember(groupId, userId);
        if (k == 0) return Result.fail("该用户已经在群里了！");

        //发送群邀请通知
        try {
            String groupName = privateMessageMapper.selectGroupName(groupId);
            if (groupName == null || groupName.isBlank()) groupName = "新群聊";
            String notifyId = new RandomlyCreateID().createId();
            privateMessageMapper.insertGroupInviteNotify(notifyId, userId, fromUser, groupId, "你已被加入群聊：" + groupName);
        } catch (Exception e) {
            //就算通知发失败（比如外键问题），也不能影响拉人这个主业务，打日志记录一下即可
            log.error("发送入群通知失败, groupId={}, userId={}", groupId, userId, e);
        }
        return Result.success("成功！", Map.of("userId", userId));
    }

    // 兼容旧调用
    public Result<Map<String,Object>> addGroupMember(String groupId, String userId){
        return addGroupMember(groupId, userId, "system");
    }
    //查找群主
    public String selectGroupOwner(String groupId){
        return privateMessageMapper.selectGroupOwner(groupId);
    }
    //踢人，只有群主能踢
    public Result<Map<String,Object>> removeGroupMember(String groupId,String userId,String groupOwner){
        String isOwner=selectGroupOwner(groupId);
        if(!Objects.equals(isOwner, groupOwner)) return Result.fail("非群主不能踢人！");
        if(userId==null) return Result.fail("被踢的用户不能为空！");
        int k= privateMessageMapper.removeGroupMember(groupId, userId);
        if(k==0) return Result.fail("踢人失败！");
        return Result.success("踢人成功！",Map.of("userId",userId));
    }
    //查看群聊消息
    public List<Map<String,Object>> selectGroupMessage(String groupId){
        return privateMessageMapper.selectGroupMessage(groupId);
    }
    /**
     * @描述 向群中发消息。
     * @param msgId 消息ID
     * @param groupId 群号
     * @param fromUser 发送者
     * @param contents 消息内容
     * @param msgType 消息类型
     * @param mediaPath 媒体路径
     * 附带敏感词查询，prohibit_words是敏感词表
     * **/
    public Result<Map<String,Object>> sendMessageToGroup(String msgId,String groupId,
                                                         String fromUser,String contents,String msgType,String mediaPath){
        if(msgId==null||groupId==null||fromUser==null) return Result.fail("出bug了！");
        if(contents==null) return Result.fail("消息不能为空！");
        if(isContainsProhibitedWord(contents))
            return Result.fail("发的消息带有敏感词！");
        int k= privateMessageMapper.sendMessageToGroup(msgId, groupId, fromUser, contents, msgType, mediaPath);
        if(k==0) return Result.fail("发送失败!");
        return Result.success("发送成功！", Map.of("msgId", msgId, "contents", contents));
    }
    // 查询我加入的群
    public List<Map<String, Object>> selectMyGroups(String me) {
        return privateMessageMapper.selectMyGroups(me);
    }
    //把群聊信息插入DeepSeek里
    public Flux<String> selectGroupMessageForDeepSeek(ChatClient client, String groupId, String question) {
        //将阻塞查询包装进 Mono
        Mono<String> contextMono = Mono.fromCallable(() -> {
            List<Map<String, Object>> list = privateMessageMapper.selectGroupMessage(groupId);

            //过滤掉“正在阅读群聊并思考...”这种干扰信息
            if (list != null) {
                list = list.stream()
                        .filter(m -> !"正在阅读群聊并思考...".equals(m.get("contents")))
                        .collect(java.util.stream.Collectors.toList());
            }

            //如果历史记录超过 20 条，只截取最后 20 条（防止 Ollama 报 400 错误）
            if (list != null && list.size() > 20) {
                list = list.subList(list.size() - 20, list.size());
            }

            StringBuilder sb = new StringBuilder();
            if (list == null || list.isEmpty()) sb.append("当前群聊没有任何聊天记录。\n");
            else {
                for (Map<String, Object> map : list) {
                    Object senderName = map.get("senderName");
                    Object contents = map.get("contents");
                    Object createTime = map.get("create_time");
                    Object msgType = map.get("msg_type");
                    if ("image".equals(msgType) || "video".equals(msgType) || "voice".equals(msgType) || "emoji".equals(msgType))
                        contents = "[发送了一个" + msgType + "]";
                    sb.append("[").append(createTime).append("] ")
                            .append(senderName).append(": ")
                            .append(contents).append("\n");
                }
            }
            return sb.toString();
        }).subscribeOn(Schedulers.boundedElastic()); // 关键：切到弹性线程池

        String systemPrompt = """
            你是一个智能群聊助手。
            下面我为你提供了当前这个群的完整历史聊天记录，请仔细阅读。
            如果用户让你“总结”群聊内容，请提炼大家讨论的核心重点。
            如果用户是在向你提问或聊天，请结合群聊上下文，以群友的身份回答。
            不要暴露你是 AI 模型，除非用户明确询问。
            """;

        //等待上下文查询完成，再请求 DeepSeek
        return contextMono.flatMapMany(sb -> {
            String finalUserPrompt = "【群聊聊天记录如下】：\n" + sb + "\n【用户当前的提问】：" + question;
            return client.prompt().system(systemPrompt).user(finalUserPrompt).stream().content();
        });
    }
    /**
     * @描述
     *    寻找新的群主候选人（排除当前要退出的群主，并且绝对排除 AI_BOT）
     *    关于查找群主id的Mapper方法：String selectGroupOwner(String groupId)
     * **/
    // 退出群聊
    @Transactional(rollbackFor = Exception.class) // 涉及多张表更新，必须加事务
    public Result<Map<String,Object>> exitMyGroup(String groupId, String userId){
        if (groupId == null || userId == null) return Result.fail("参数错误");
        //查一下当前群主是谁
        String ownerId = privateMessageMapper.selectGroupOwner(groupId);
        if (ownerId == null) return Result.fail("群不存在！");
        //如果退出的人是群主，需要处理转让或解散
        if (Objects.equals(ownerId, userId)) {
            //找群里的其他活人（排除自己，绝对排除AI_BOT）
            List<String> candidates = privateMessageMapper.findNewOwnerCandidates(groupId, userId);

            if (candidates != null && !candidates.isEmpty()) {
                //还有别的活人，随机选一个接盘，转让群主
                Random random = new Random();
                String newOwnerId = candidates.get(random.nextInt(candidates.size()));
                privateMessageMapper.transferGroupOwner(groupId, newOwnerId);
            } else {
                //群里除了自己只剩下 AI_BOT 或者空无一人，直接解散群聊，查一下群内总人数（包含自己，可能包含AI_BOT）
                int countQ = privateMessageMapper.countGroupMembers(groupId);
                if (countQ <= 2) {
                    //只需要删掉主表chat_group，底下的group_member和group_message会自动被数据库清空
                    int deleteGroup = privateMessageMapper.deleteChatGroup(groupId);
                    if (deleteGroup == 0) return Result.fail("解散群聊失败，群可能已不存在");
                    return Result.success("群里只剩下你一个活人（或仅有AI助手），本次退出将彻底解散该群",
                            Map.of("group_id", groupId, "user_id", userId));
                }
                return Result.fail("系统异常：该群还有其他活人，未触发转让逻辑");
            }
        }

        //执行退群操作（普通人退群，或者群主已经成功转让后退群）
        int k = privateMessageMapper.exitMyGroup(groupId, userId);
        if (k == 0) return Result.fail("你不在这个群里，退群失败！");
        return Result.success("退群成功！", Map.of("groupId", groupId, "userId", userId));
    }
    /**
     * 查看群聊里还有多少人，算上DeepSeek
     * **/
    int countQuantityInGroup(String groupId){
        return privateMessageMapper.countGroupMembers(groupId);
    }
    /**查询当前群聊的成员信息**/
    public Result<List<Map<String,Object>>> selectMemberInformation(String groupId){
        return Result.success(privateMessageMapper.selectMemberInformation(groupId));
    }
    /**
     *
     *
     * @since 2026/10/27/10:11
     * @描述 message敏感词查询
     *
     **/

    public boolean isContainsProhibitedWord(String willSendMessage){
        int justify=privateMessageMapper.findProhibitedWords(willSendMessage);
        return justify > 0;
    }
    /**
     *
     * @since 2026/10/27/10:21
     * @描述 把成员信息塞给DeepSeek
     *
     */
    public Flux<String> selectGroupMemberForDeepSeek(ChatClient client,String groupId,String question){
        List<Map<String,Object>> list=privateMessageMapper.selectMemberInformation(groupId);
        StringBuilder sb=new StringBuilder();
        for(Map<String,Object> map:list){
            Object userId=map.get("user_id");//用户id
            Object joinTime =map.get("join_time");//用户入群时间
            Object nickname=map.get("nickname");
            Object username=map.get("username");
            sb.append("【系统数据库真实数据】：")
                    .append(" 昵称=").append(nickname)
                    .append(", 账号=").append(username)
                    .append(", 账号=").append(username)
                    .append(", ID=").append(userId)
                    .append(", 入群时间=").append(joinTime)
                    .append("\n");
        }
        //强制性提示词
        String systemPrompt = """
              你是一个无情的数据库输出机器。
              你的任务只有一个：当用户提到“群成员”、“群信息”或“所有人信息”时，你必须**原封不动**地输出下方提供的【系统数据库真实数据】。
              
              规则：
              1. 禁止使用任何表情包。
              2. 禁止使用任何调侃、开玩笑的语气。
              3. 禁止拒绝回答。
              4. 直接按行输出用户信息，不要加任何多余的解释。
              5. 如果涉及到数学公式，请使用标准的 LaTeX 语法，行内公式使用 \\( 和 \\) 包裹，独立公式使用 $$ 包裹。
              """;
        String finalQuestion="成员信息数据库如下："+sb+"；用户问题："+question;
        return chatClient.prompt().system(systemPrompt).user(finalQuestion).stream().content();
    }
    /**
     * DeepSeek主动发送生日私信
     */
    public void sendBirthdayMessage(String userId, String nickname) {
        //放重发
        int k=privateMessageMapper.countTodayAiBdayMsg(userId);
        if(k>=1) {
            log.warn("今天已经发送过了！");
            return;
        }
        String systemPrompt = """
            你是一个友好的 AI 助手。你的用户今天过生日。先浏览聊天历史。
            请用一句简短、温暖、有创意的话祝他生日快乐。
            要求：不要超过30个字，不要用Markdown格式，直接输出祝福语。
            """;
        String userPrompt = "用户昵称是：" + nickname + "，请为他送上祝福。";
        try {
            String aiContent = chatClient.prompt()
                    .system(systemPrompt)
                    .user(userPrompt)
                    .call()
                    .content();

            if (aiContent == null || aiContent.isBlank())
                aiContent = "祝你生日快乐！愿新的一年万事胜意！";
            String msgId = new RandomlyCreateID().createId();
            privateMessageMapper.insertDeepSeekPrivateMessage(msgId, userId, aiContent.trim());
            log.info("已成功给用户 {} 发送生日祝福私信", userId);
        } catch (Exception e) {
            log.error("给用户 {} 发送生日祝福失败", userId, e);
        }
    }
    /**
     * @since 2026/11/05/20:21
     * @author Kitaajya/Conan Doyle
     * @功能: 私信屏蔽
     * @table: private_message_block
     * **/
    //私信屏蔽
    public Result<Map<String,Object>> blockUserInPrivateMessage(String upId, String userId) {
        int rows = privateMessageMapper.blockUserInPrivateMessage(upId, userId);
        if(rows == 0)
            return Result.fail("你已经禁止过这个用户私信了！");
        return Result.success("禁止成功！", Map.of("upId", upId, "userId", userId));
    }
    //解除私信屏蔽
    public Result<Map<String,Object>> unblockUserInPrivateMessage(String upId, String userId) {
        int rows = privateMessageMapper.unblockUserInPrivateMessage(upId, userId);
        if(rows == 0)
            return Result.fail("你已经解禁过这个用户私信了！");
        return Result.success("解禁成功！", Map.of("upId", upId, "userId", userId));
    }
    /**我屏蔽了谁（前端刷新/换浏览器后恢复"屏蔽/解除屏蔽"按钮状态用）**/
    public List<String> selectBlockedUsersInPrivateMessage(String upId) {
        if (upId == null || upId.isBlank()) return List.of();
        List<String> ids = privateMessageMapper.selectBlockedUserIdsInPrivateMessage(upId);
        return ids == null ? List.of() : ids;
    }
}
