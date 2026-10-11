package org.designer.youtube;

import org.mybatis.spring.annotation.MapperScan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

//@MapperScan 扫描 mapper 包下的 MyBatis 接口
@MapperScan("org.designer.youtube.mapper")
@SpringBootApplication
public class YoutubeApplication {
    private static Logger log = LoggerFactory.getLogger(YoutubeApplication.class);
    public static void main(String[] args) {
        log.info("调试代码");
        SpringApplication.run(YoutubeApplication.class, args);
    }

}