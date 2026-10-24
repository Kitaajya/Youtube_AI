package org.designer.youtube.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class Config {
    public static final int MAX_TIME=10;
    public static final int MAX_SIZE=1000;
//咖啡因缓存配置，存储MAX_TIME秒内浏览过的内容，最多存储MAX_SIZE条
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager=new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder().expireAfterAccess(MAX_TIME,TimeUnit.SECONDS).maximumSize(MAX_SIZE));
        return cacheManager;
    }
    @Bean
    public ChatClient chat(ChatClient.Builder cb){
        return cb.build();
    }
}