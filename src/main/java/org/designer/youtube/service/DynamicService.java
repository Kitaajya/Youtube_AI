package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.mapper.DynamicMapper;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
@Slf4j
@Service
@RequiredArgsConstructor
@Cacheable
public class DynamicService {
    public final DynamicMapper dynamicMapper;
    //查-写-删-修
    public List<Map<String,Object>> selectDynamic(String id,
                                           String content,
                                           LocalDateTime createTime){
        return dynamicMapper.selectDynamic(id, content, createTime);
    }
    public Map<String,Object> writeDynamic(String content,String id,String userId){
        log.info("测试写动态");
        int k=dynamicMapper.writeDynamic(content, id, userId);
        if(k==0) return Map.of("success",false,"message","写动态失败！");
        return Map.of("success",true,"message","写入成功");
    }
    public Map<String,Object> deleteDynamic(String id,LocalDateTime createTime){
        log.info("删除动态");
        int k=dynamicMapper.deleteDynamic(id, createTime);
        if(k==0) return Map.of("success",false,"message","删除动态失败！");
        return Map.of("success",true,"message","成功");
    }
    public Map<String,Object> editDynamic(String newContent,String id,LocalDateTime createTime){
        log.info("修改动态");
        int k=dynamicMapper.editDynamic(newContent, id, createTime);
        if(k==0) return Map.of("success",false,"message","修改动态失败！");
        return Map.of("success",true,"message","成功");
    }
    //把动态评论塞给DeepSeek，主要是动态模块
    public Flux<String> getCommentsForDeepSeek(ChatClient client, String question){
        List<Map<String,Object>> k=dynamicMapper.getDynamicCommentsForDeepSeek();
        StringBuilder sb=new StringBuilder();
        if(k==null||k.isEmpty()) sb.append("当前数据库没有任何内容。\n");
        else{
            for(Map<String,Object> map:k){
                Object commentId=map.get("comment_id");
                Object dynamicId=map.get("dynamic_id");
                Object userId=map.get("user_id");
                Object parentId=map.get("parent_id");
                Object contents=map.get("contents");
                Object createTime=map.get("create_time");
                Object contentLike=map.get("contentLike");
                sb.append("用户名为").append(userId).append("在动态id为").append(dynamicId)
                        .append("处发表了一个评论").append(contents).append("此评论发表时间为")
                        .append(createTime).append("此评论的id为").append(commentId)
                        .append(",它的父评论为").append(parentId).append(",父评论发表时间为").append(createTime)
                        .append(",对应的点赞数").append(contentLike);
            }
        }
        String systemPrompt= """
                    如果用户的问题涉及到关于查询动态评论的话，就请根据我喂给你的数据库信息如实回答。
                    如果用户问的问题不涉及动态评论问题，比如数理化、计算机代码等领域，那就不要废话，回复他。
                    """;
        String finalQuestion="动态评论表数据如下"+sb+",用户的问题是"+question;
        return client.prompt().system(systemPrompt).user(finalQuestion).stream().content();
    }

}
