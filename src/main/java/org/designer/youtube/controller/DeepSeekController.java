package org.designer.youtube.controller;

import org.designer.youtube.service.DeepSeekTest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/deepseek")
public class DeepSeekController {
    private final DeepSeekTest deepSeekTest;
    public DeepSeekController(DeepSeekTest deepSeekTest){
        this.deepSeekTest=deepSeekTest;
    }
    @GetMapping("/ask/deepseek")
    public String askDeepseek(@RequestParam String question){
        return deepSeekTest.ask(question);
    }
}
