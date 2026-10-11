package org.designer.youtube.controller;
/**
 * 验证码功能
 * **/
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.Random;
//全部换成jakarta
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

@RestController
public class CaptchaController {

    private static final char[] CHARS = {
            '0','1','2','3','4','5','6','7','8','9',
            'A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z',
            'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'
    };
    private static final Random random = new Random();

    //生成随机验证码字符串
    private String getRandomCode(int len){
        StringBuilder sb = new StringBuilder();
        for(int i=0;i<len;i++)
            sb.append(CHARS[random.nextInt(CHARS.length)]);
        return sb.toString();
    }

    //随机颜色
    private Color getRandomColor(){
        return new Color(random.nextInt(255), random.nextInt(255), random.nextInt(255));
    }

    @GetMapping("/captcha")
    public void captcha(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        int width = 120;
        int height = 40;
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();

        // 背景白色
        g.setColor(Color.WHITE);
        g.fillRect(0,0,width,height);

        // 8条干扰线
        for(int i=0;i<8;i++){
            g.setColor(getRandomColor());
            int x1 = random.nextInt(width);
            int y1 = random.nextInt(height);
            int x2 = random.nextInt(width);
            int y2 = random.nextInt(height);
            g.drawLine(x1,y1,x2,y2);
        }

        // 4位验证码
        String code = getRandomCode(4);
        HttpSession session = req.getSession();
        session.setAttribute("captchaCode", code);

        // 绘制文字，轻微旋转
        g.setFont(new Font("Arial", Font.BOLD, 28));
        for(int i=0;i<code.length();i++){
            g.setColor(getRandomColor());
            double theta = Math.toRadians(random.nextInt(15)-7);
            g.rotate(theta, 20+i*25, 28);
            g.drawString(String.valueOf(code.charAt(i)), 20+i*25, 28);
            g.rotate(-theta, 20+i*25, 28);
        }
        g.dispose();

        // 返回图片，禁用缓存
        resp.setContentType("image/png");
        resp.setHeader("Pragma", "no-cache");
        resp.setHeader("Cache-Control", "no-cache");
        ImageIO.write(image, "png", resp.getOutputStream());
    }

    // 验证码校验接口
    @GetMapping("/checkCaptcha")
    public String checkCaptcha(String inputCode, HttpSession session){
        String sessionCode = (String) session.getAttribute("captchaCode");
        if(sessionCode != null && sessionCode.equalsIgnoreCase(inputCode)){
            session.removeAttribute("captchaCode");
            return "success";
        }
        return "fail";
    }
}
