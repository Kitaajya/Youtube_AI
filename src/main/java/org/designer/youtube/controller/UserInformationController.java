package org.designer.youtube.controller;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.designer.youtube.common.Result;
import org.designer.youtube.service.UserInformationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserInformationController {
    private final UserInformationService userInformationService;

    //注册
    @PostMapping("/create/user/account")
    public Result<Map<String,Object>> createNewAccount(@RequestParam String username,@RequestParam String password,
                                                       @RequestParam String nickname,@RequestParam String email,
                                                       @RequestParam String phone){
        return Result.success(userInformationService.createNewAccount(username,password,nickname,email,phone));
    }

    //登录
    @PostMapping("/login")
    public Result<Map<String,Object>> login(@RequestParam String username,@RequestParam String password,
                                            @RequestParam String captcha, HttpSession session){
        // 强制校验验证码，防止绕过前端直接调用登录接口
        String sessionCode = (String) session.getAttribute("captchaCode");
        if(sessionCode == null || !sessionCode.equalsIgnoreCase(captcha))
            return Result.fail("验证码错误或已过期");
        session.removeAttribute("captchaCode");
        return Result.success(userInformationService.login(username,password));
    }
}