package org.designer.youtube;

import org.mybatis.spring.annotation.MapperScan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 2026/11/02/10:20,前后端分离
 *
 *
 *
 *
 * 截止2026/11/04/11:59，我自己都不知道怎么改视频屏蔽功能，一屏蔽某人或某些人，他/他们就完全看不到我的所有视频，但这不是我想要的，
 * 我想要的是对于我发布的某个视频或某些视频，拥有对某人或某些人的屏蔽功能，而不是一下子对他/他们屏蔽我所有的视频。这个bug我至今都改不了。
 * 根据DeepSeek的启示，在屏蔽表里添加视频id，否则被屏蔽者会看不到我的所有视频
 *
 * **/

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

/**
 * 我的一点小巧思：
 * from selenium import webdriver
 * from selenium.webdriver.common.by import By
 *
 * driver = webdriver.Chrome()
 * driver.get("你的网页地址")
 *
 * # 通过链接文字或 XPath 查找包含“点我”的元素
 * element = driver.find_element(By.XPATH, "//*[contains(text(), '点我')]")
 * element.click()
 *
 * **/