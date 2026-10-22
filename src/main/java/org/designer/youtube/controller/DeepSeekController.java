package org.designer.youtube.controller;

import org.designer.youtube.service.DeepSeekTest;
import org.designer.youtube.service.VideoService;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/deepseek")
public class DeepSeekController {
    private final VideoService videoService;
    private final DeepSeekTest deepSeekTest;
    private final ChatClient client;
    private final UserInformationService userInformationService;
    private final DynamicService dynamicService;
    private final PrivateMessageService privateMessageService;
    public DeepSeekController(DeepSeekTest deepSeekTest,VideoService videoService,
                              ChatClient.Builder cb,
                              UserInformationService userInformationService,
                              DynamicService dynamicService,
                              PrivateMessageService privateMessageService){
        this.deepSeekTest=deepSeekTest;
        this.videoService=videoService;
        this.client=cb.build();
    }
    @GetMapping("/ask/deepseek")
    public String askDeepseek(@RequestParam String question){
        return deepSeekTest.ask(question);
    }
    @GetMapping("/stream")
    public Flux<String> streamAsk(@RequestParam String question){
        return deepSeekTest.streamAsk(question);
    }
    /** 把数据库的内容塞给 DeepSeek
     * 2026/10/21/17:10
     * **/
    @GetMapping("/analyze/likes")
    public Flux<String> getCommentLike(@RequestParam String question) {
        return videoService.getCommentLike(this.client,question);
    }
    @GetMapping("/analyze/user")
    public Flux<String> getUserInformationForDeepSeek(@RequestParam String question){
        return userInformationService.getUserInformationForDeepSeek(this.client,question);
    }
    //把动态评论塞给DeepSeek，主要是动态模块
    @GetMapping("/analyze/dynamic/comments")
    public Flux<String> getCommentsForDeepSeek(@RequestParam String question){
        return dynamicService.getCommentsForDeepSeek(this.client,question);
    }
    //把表情包塞给DeepSeek
    @GetMapping("/analyze/private/message/emoji")
    public Flux<String> getPrivateMessageEmoji(@RequestParam String question){
        return privateMessageService.getPrivateMessageEmojiForDeepSeek(this.client,question);
    }
    /**
     * 把视频id为id`(特定视频)的评论区喂给DeepSeek，并让它总结评论
     * **/
    public Flux<String> selectSpecialVideoCommentsForDeepSeek(@RequestParam long vid,@RequestParam String question){
        return videoService.selectSpecialVideoCommentsForDeepSeek(this.client,vid,question);
    }
}
