package org.designer.youtube.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.mapper.DynamicMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
@Slf4j
@Service
@RequiredArgsConstructor
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

}
