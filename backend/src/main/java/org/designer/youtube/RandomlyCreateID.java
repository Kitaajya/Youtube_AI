package org.designer.youtube;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
public class RandomlyCreateID {

    private static final String KEY = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890";
    private static final int SIZE = 13;
    private static final SecureRandom RANDOM = new SecureRandom();

    public String createId(){
        char[] id = new char[SIZE];
        //规定id的长度为13
        for(int j = 0; j < SIZE; j++)
            id[j] = KEY.charAt(RANDOM.nextInt(KEY.length()));
        return new String(id);
    }
}