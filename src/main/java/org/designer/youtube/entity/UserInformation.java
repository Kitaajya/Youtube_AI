package org.designer.youtube.entity;

import lombok.Data;

//用户信息实体，对应数据库用户表
@Data
public class UserInformation {
    //用户ID，主键（随机字符串）
    private String userId;
    //用户名（登录名）
    private String username;
    //密码
    private String password;
    //昵称/显示名
    private String nickname;
    //头像路径
    private String avatar;
    //邮箱
    private String email;
    //手机号
    private String phone;
    //注册时间
    private java.time.LocalDateTime createTime;
}