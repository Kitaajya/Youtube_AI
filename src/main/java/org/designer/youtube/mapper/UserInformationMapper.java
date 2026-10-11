package org.designer.youtube.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.designer.youtube.entity.UserInformation;

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
    @Select("SELECT * FROM user_information WHERE username = #{username}")
    UserInformation selectByUsername(@Param("username") String username);
}