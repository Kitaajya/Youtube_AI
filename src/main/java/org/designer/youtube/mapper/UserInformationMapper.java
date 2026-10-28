package org.designer.youtube.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.designer.youtube.entity.UserInformation;

import java.util.List;
import java.util.Map;

//数据库表名user_information
public interface UserInformationMapper {
    //注册账号
    @Insert("""
    INSERT INTO user_information(user_id,username,password,nickname,email,phone) 
    VALUES(#{userId},#{username},#{password},#{nickname},#{email},#{phone});
    """)
    int createNewAccount(@Param("userId") String userId,@Param("username") String username,@Param("password") String password,
                         @Param("nickname") String nickname,@Param("email") String email,@Param("phone") String phone);
    //查重id
    @Select("SELECT COUNT(*) FROM user_information WHERE user_id = #{userId}")
    int isDuplicate(@Param("userId") String userId);
    //登录：按用户名查用户
    @Select("""
    SELECT user_id     AS userId,
           username,
           password,
           nickname,
           avatar,
           email,
           phone,
           create_time AS createTime
    FROM user_information
    WHERE username = #{username}
    """)
    UserInformation selectByUsername(@Param("username") String username);
    //查看我关注了谁
    @Select("""
    SELECT u.user_id, u.nickname, u.avatar, s.create_time AS follow_time
    FROM subscription s
    JOIN user_information u ON u.user_id = s.up_id
    WHERE s.fan_id = #{me}
    ORDER BY s.create_time DESC
    """)
    List<Map<String,Object>> selectIFollowWhom(@Param("me") String me);
    //查看谁关注了我
    @Select("""
    SELECT u.user_id, u.nickname, u.avatar, s.create_time AS follow_time
    FROM subscription s
    JOIN user_information u ON u.user_id = s.fan_id
    WHERE s.up_id = #{me}
    ORDER BY s.create_time DESC
    """)
    List<Map<String,Object>> selectMyFans(@Param("me") String me);
//
//***
//*-- 关注关系表：一条记录 = 一次关注（与 video_like 同构）
//* CREATE TABLE IF NOT EXISTS subscription(
//*     fan_id      VARCHAR(13) NOT NULL,   -- 关注者（粉丝）
//*     up_id       VARCHAR(13) NOT NULL,   -- 被关注者（UP主）
//*     create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
//*     PRIMARY KEY (fan_id, up_id),        -- 联合主键 = 一人只能关注一次
//*     KEY idx_sub_up (up_id, create_time),        -- 查"某人有哪些粉丝"走索引
//*     CONSTRAINT fk_sub_fan FOREIGN KEY (fan_id)
//*         REFERENCES user_information(user_id) ON DELETE CASCADE,
//*     CONSTRAINT fk_sub_up FOREIGN KEY (up_id)
//*         REFERENCES user_information(user_id) ON DELETE CASCADE
//* ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
//*
//*/
//
//
    //我关注up主，我是up主的粉丝
    @Insert("""
    INSERT INTO subscription(fan_id,up_id) VALUES (#{me},#{upId})
    """)
    int follow(@Param("me") String me,@Param("upId") String upId);
    //我取关up主，我原本是此up主的粉丝，现在不是了
    @Delete("""
    DELETE FROM subscription WHERE fan_id=#{me} AND up_id=#{upId}
    """)
    int unfollow(@Param("me") String me,@Param("upId") String upId);

    /**
     * 把数据库的信息喂给DeepSeek
     * **/
    //把用户表信息喂给DeepSeek
    @Select("""
    SELECT * FROM user_information
    """)
    List<Map<String,Object>> getUserInformationForDeepSeek();

    /**
     * 校验昵称是否包含违禁词，返回命中的违禁词数量
     * 返回 0 表示通过，> 0 表示命中，应拒绝注册
     */
    @Select("""
    SELECT COUNT(*)
    FROM prohibit_words p
    WHERE #{nickname} LIKE CONCAT('%', p.message, '%')
    """)
    int countProhibitedWords(@Param("nickname") String nickname);
    /**
     * 改nickname
     * **/
    @Update("""
    UPDATE user_information SET nickname=#{newNickname} WHERE user_id={userId}
    """)
    int editNickname(@Param("newNickname") String newNickname,@Param("userId")String userId);
}