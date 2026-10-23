package org.designer.youtube.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/redis")
public class RedisController {
    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    @GetMapping("/get")
    public String test(){
        stringRedisTemplate.opsForValue().set("store","String");
        stringRedisTemplate.opsForSet().add("store:set","set");
        return "写入成功";
    }
}
