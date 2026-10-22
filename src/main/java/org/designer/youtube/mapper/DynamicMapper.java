package org.designer.youtube.mapper;


import org.apache.ibatis.annotations.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public interface DynamicMapper {
    //查看动态
    @Select("""
    SELECT myid,user_id,content,create_time FROM dynamic WHERE myid=#{id} AND content=#{content} AND create_time=#{createTime}
    """)
    List<Map<String,Object>> selectDynamic(@Param("id") String id,
                                           @Param("content") String content,
                                           @Param("createTime") LocalDateTime createTime);
    //写动态
    @Insert("INSERT INTO dynamic(myid,user_id,content) VALUES(#{id},#{userId},#{content})")
    int writeDynamic(@Param("content")String content,@Param("id")String id,@Param("userId")String userId);
    //删除动态
    @Delete("DELETE FROM dynamic WHERE myid=#{id} AND create_time=#{createTime}")
    int deleteDynamic(@Param("id")String id,@Param("createTime") LocalDateTime createTime);
    //修改动态
    @Update("UPDATE dynamic SET content=#{newContent} WHERE myid=#{id} AND create_time=#{createTime}")
    int editDynamic(@Param("content") String newContent,
                    @Param("id") String id,
                    @Param("createTime") LocalDateTime createTime);
    //把动态评论塞给DeepSeek
    @Select("""
    SELECT * FROM content_comments
    """)
    List<Map<String,Object>> getDynamicCommentsForDeepSeek();
}
