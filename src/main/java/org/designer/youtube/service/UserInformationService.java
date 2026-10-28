package org.designer.youtube.service;

import jakarta.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.entity.UserInformation;
import org.designer.youtube.mapper.UserInformationMapper;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserInformationService {
    private final UserInformationMapper userInformationMapper;
    private final RandomlyCreateID randomlyCreateID;

    //注册账号
    public Map<String,Object> createNewAccount(String username, String password,
                                               String nickname, String email, String phone){
        //用户名查重，避免唯一键冲突
        if(userInformationMapper.selectByUsername(username) != null)
            return Map.of("success", false, "message", "用户名已存在");

        //先生成、查重，撞了就重生成，直到不重复
        String userId;
        do {
            userId = randomlyCreateID.createId();
        } while (userInformationMapper.isDuplicate(userId) > 0);

        //再插入（只插一次）
        try {
            int k = userInformationMapper.createNewAccount(userId, username, password, nickname, email, phone);
            if(k == 0) return Map.of("success", false, "message", "创建失败");
            return Map.of("success", true, "message", "创建成功");
        } catch (DuplicateKeyException e){
            //并发下仍可能撞唯一键，兜底返回友好提示
            return Map.of("success", false, "message", "用户名已存在");
        }
    }

    //登录
    public Map<String,Object> login(String username, String password){
        UserInformation user = userInformationMapper.selectByUsername(username);
        if(user == null)
            return Map.of("success", false, "message", "用户不存在");
        if(!user.getPassword().equals(password))
            return Map.of("success", false, "message", "密码错误");

        Map<String,Object> data = new HashMap<>();
        data.put("success", true);
        data.put("message", "登录成功");
        data.put("userId", user.getUserId());
        data.put("nickname", user.getNickname());
        return data;
    }

    //我关注了谁
    public List<Map<String,Object>>selectIFollowWhom(String me){
        return userInformationMapper.selectIFollowWhom(me);
    }
    //谁关注了我
    public List<Map<String,Object>> selectMyFans(String me){
        return userInformationMapper.selectMyFans(me);
    }
    //我关注了up主
    public Result<Map<String,Object>> follow(@Nonnull String me,@Nonnull String upId){
        if(me.equals(upId)) return Result.fail("不能关注自己！");
        try{
            int k=userInformationMapper.follow(me, upId);
            if(k==1) return Result.success("关注成功", Map.of("success", true));
        }catch (DuplicateKeyException esq){
            return Result.success("已经关注过了！",Map.of("success",true));
        }
        return Result.fail("关注失败！");
    }
    /**
     * //我取关up主，我原本是此up主的粉丝，现在不是了
     *     @Delete("""
     *     DELETE FROM subscription WHERE fan_id=#{me} AND up_id=#{upId}
     *     """)
     *     int unfollow(@Param("me") String me,@Param("upId") String upId);
     * **/
    //我取关up主，我原本是此up主的粉丝，现在不是了
    public Result<Map<String,Object>>unfollow(@Nonnull String me,@Nonnull String upId){
        if(me.equals(upId)) return Result.fail("谁的小巧思能取关自己！");
        int k=userInformationMapper.unfollow(me, upId);
        if(k==0){
            //DELETE 影响 0 行 = 本来就没关注过，不算错误（与 cancelLike"还没有点过赞"同口径）
            return Result.success("还没有关注过他！",Map.of("success",true));
        }
        return Result.success("取关成功！",Map.of("success",true));
    }

    /**
     * 把数据库的信息喂给DeepSeek
     * **/
    public Flux<String> getUserInformationForDeepSeek(ChatClient client,String question){
        List<Map<String,Object>> information=userInformationMapper.getUserInformationForDeepSeek();
        StringBuilder k=new StringBuilder();
        if(information==null||information.isEmpty()) k.append("当前数据库没有任何内容！");
        else{
            for(Map<String,Object> map:information){
                Object userId=map.get("user_id");
                Object username=map.get("username");
                Object password=map.get("password");
                Object nickname=map.get("nickname");
                Object phone=map.get("phone");
                Object createTime=map.get("create_time");
                k.append("用户").append(username).append("的id为").append(userId)
                        .append("，登录密码：").append(password)
                        .append(",昵称为").append(nickname).append("，注册的电话号为").append(phone)
                        .append(",注册时间：").append(createTime);
            }
        }
        String systemPrompt= """
                    首先，你是一个智能的DeepSeek，明确你的身份！
                    其次，我是总站站长，我需要你调用我塞给你的数据库帮我查询指定的信息！
                    如果询问内容与数据库不相符，证明我没有在问数据库信息，而是在（比如数学题、写代码、日常聊天）相关内容！你要如实回答！
                    """;
        String getK="主要信息如下："+k+"用户提问的内容是："+question;
        return client.prompt().system(systemPrompt).user(getK).stream().content();
    }
    /**
     * 添加nickname审核功能->    int countProhibitedWords(@Param("nickname") String nickname);
     * **/
    public int countProhibitedWords(String nickname){
        int k=userInformationMapper.countProhibitedWords(nickname);
        return Math.max(k, 0);
    }
    /**
     * 修改nickname，
     *     int editNickname(@Param("newNickname") String newNickname,@Param("userId")String userId);
     * **/
    public Result<Map<String,Object>> editNickname(String newNickname,String userId){
        int k=userInformationMapper.editNickname(newNickname,userId);
        if(k==0) return Result.fail("修改失败！");
        return Result.success("修改成功！",Map.of("newNickname",newNickname,"userId",userId));
    }

}