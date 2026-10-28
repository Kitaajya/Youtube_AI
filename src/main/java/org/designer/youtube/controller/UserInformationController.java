package org.designer.youtube.controller;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.service.UserInformationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserInformationController {
    private final UserInformationService userInformationService;

    //注册
    @PostMapping("/create/user/account")
    public Result<Map<String,Object>> createNewAccount(@RequestParam String username,@RequestParam String password,
                                                       @RequestParam String nickname,@RequestParam String email,
                                                       @RequestParam String phone) {
        RandomlyCreateID randomlyCreateID=new RandomlyCreateID();
        if(userInformationService.countProhibitedWords(nickname)>0){
            //Thread.sleep(20000);
            log.info("恭喜你，领取先知白兑换码！");
            return Result.success(userInformationService.createNewAccount(username,password,randomlyCreateID.createId(),email,phone));
        }
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
    //查看我关注了谁
    @GetMapping("/select/me/follow")
    public Result<List<Map<String,Object>>> selectIFollowWhom(@RequestParam String me){
        return Result.success(userInformationService.selectIFollowWhom(me));
    }
    //查看谁关注了我
    @GetMapping("/select/me/fans")
    public Result<List<Map<String,Object>>> selectMyFans(@RequestParam String me){
        return Result.success(userInformationService.selectMyFans(me));
    }
    //我关注了up主
    @PostMapping("/follow")
    public Result<Map<String,Object>> follow(@RequestParam String me,@RequestParam String upId){
        return userInformationService.follow(me,upId);
    }
    //我取关了up主，我原本是up主的粉丝，现在不是了
    @PostMapping("/unfollow")
    public Result<Map<String,Object>> unfollow(@RequestParam String me,@RequestParam String upId){
        return userInformationService.unfollow(me, upId);
    }
    /**
     * 添加nickname审核功能-> int countProhibitedWords(@Param("nickname") String nickname);
     * **/
    @GetMapping("/check/nickname")
    public Result<Map<String,Object>>countProhibitedWords(@RequestParam String nickname){
        if(nickname.isEmpty()) return Result.fail("昵称不应为空！");
        if(userInformationService.countProhibitedWords(nickname)>0) return Result.fail("你的昵称包含违禁字！");
        return Result.success("昵称可用！",Map.of("nickname",nickname));
    }
}