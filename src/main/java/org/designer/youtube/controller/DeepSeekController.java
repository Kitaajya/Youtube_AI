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
    public DeepSeekController(DeepSeekTest deepSeekTest,VideoService videoService,ChatClient.Builder cb){
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
}
