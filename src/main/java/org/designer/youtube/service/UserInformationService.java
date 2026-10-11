package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.entity.UserInformation;
import org.designer.youtube.mapper.UserInformationMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.HashMap;
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
        if(userInformationMapper.selectByUsername(username) != null){
            return Map.of("success", false, "message", "用户名已存在");
        }

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
        if(user == null){
            return Map.of("success", false, "message", "用户不存在");
        }
        if(!user.getPassword().equals(password)){
            return Map.of("success", false, "message", "密码错误");
        }
        Map<String,Object> data = new HashMap<>();
        data.put("success", true);
        data.put("message", "登录成功");
        data.put("userId", user.getUserId());
        data.put("nickname", user.getNickname());
        return data;
    }
}