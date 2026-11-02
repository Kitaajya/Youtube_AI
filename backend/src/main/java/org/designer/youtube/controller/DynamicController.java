package org.designer.youtube.controller;

import lombok.RequiredArgsConstructor;
import org.designer.youtube.common.Result;
import org.designer.youtube.service.DynamicService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/dynamic")
public class DynamicController {
    private final DynamicService dynamicService;
    @GetMapping("/dynamic/select/all")
    //查-写-删-修
    public Result<List<Map<String, Object>>> selectDynamic(@RequestParam String id,
                                            @RequestParam String content,
                                            @RequestParam LocalDateTime createTime) {
        return Result.success(dynamicService.selectDynamic(id, content, createTime));
    }
    @PostMapping("/dynamic/write")
    public Result<Map<String,Object>> writeDynamic(@RequestParam String content,@RequestParam String id,@RequestParam String userId){
        return Result.success(dynamicService.writeDynamic(content,id,userId));
    }
    @DeleteMapping("/dynamic/delete")
    public Result<Map<String,Object>> deleteDynamic(@RequestParam String id,@RequestParam LocalDateTime createTime){
        return Result.success(dynamicService.deleteDynamic(id, createTime));
    }
    @PostMapping("/dynamic/edit")
    public Result<Map<String,Object>> editDynamic(@RequestParam String newContent, @RequestParam String id,
                                                  @RequestParam LocalDateTime createTime){
        return Result.success(dynamicService.editDynamic(newContent, id, createTime));
    }
}