package org.designer.youtube.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class DeepSeekTest{
    private final ChatClient client;
    public DeepSeekTest(ChatClient.Builder c){
        this.client=c.build();
    }
    public String ask(String question){
        //客户端->提示词->用户问题->回答->内容
        return client.prompt().user(question).call().content();
    }
    public Flux<String>streamAsk(String question){
        return client.prompt().user(question).stream().content();
    }
}