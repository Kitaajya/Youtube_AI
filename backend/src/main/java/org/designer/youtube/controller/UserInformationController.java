package org.designer.youtube.controller;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.mapper.UserInformationMapper;
import org.designer.youtube.service.PrivateMessageService;
import org.designer.youtube.service.UserInformationService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;

@Slf4j
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserInformationController {
    private final UserInformationService userInformationService;
    private final ScheduledExecutorService service;
    private final RandomlyCreateID randomlyCreateID;
    private final UserInformationMapper userInformationMapper;
    private final PrivateMessageService privateMessageService;

    //注册
    @PostMapping("/create/user/account")
    public Result<Map<String, Object>> createNewAccount(@RequestParam String username, @RequestParam String password,
                                                        @RequestParam String nickname, @RequestParam String email,
                                                        @RequestParam String phone) {
        //Thread.sleep(20000);
        //log.info("恭喜你，领取先知白兑换码！");
        //return Result.success(userInformationService.createNewAccount(username,password,randomlyCreateID.createId(),email,phone))
        return Result.success(userInformationService.createNewAccount(username, password, nickname, email, phone));
    }

    //登录
    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestParam String username, @RequestParam String password,
                                             @RequestParam String captcha, HttpSession session) {
        // 强制校验验证码，防止绕过前端直接调用登录接口
        String sessionCode = (String) session.getAttribute("captchaCode");
        if (sessionCode == null || !sessionCode.equalsIgnoreCase(captcha))
            return Result.fail("验证码错误或已过期");
        session.removeAttribute("captchaCode");
        return Result.success(userInformationService.login(username, password));
    }

    //查看我关注了谁
    @GetMapping("/select/me/follow")
    public Result<List<Map<String, Object>>> selectIFollowWhom(@RequestParam String me) {
        return Result.success(userInformationService.selectIFollowWhom(me));
    }

    //查看谁关注了我
    @GetMapping("/select/me/fans")
    public Result<List<Map<String, Object>>> selectMyFans(@RequestParam String me) {
        return Result.success(userInformationService.selectMyFans(me));
    }

    //我关注了up主
    @PostMapping("/follow")
    public Result<Map<String, Object>> follow(@RequestParam String me, @RequestParam String upId) {
        return userInformationService.follow(me, upId);
    }

    //我取关了up主，我原本是up主的粉丝，现在不是了
    @PostMapping("/unfollow")
    public Result<Map<String, Object>> unfollow(@RequestParam String me, @RequestParam String upId) {
        return userInformationService.unfollow(me, upId);
    }
    /**
     * @since  2026/10/28/15:00
     * @说明: 新增审核方法
     **/
    @GetMapping("/check/nickname")
    public Result<Map<String, Object>> countProhibitedWords(@RequestParam String nickname, @RequestParam String userId) {
        if (nickname.isEmpty()) return Result.fail("昵称不应为空！");
        if (userInformationService.countProhibitedWords(nickname) > 0) {
            return Result.fail("你的昵称包含违禁字！");
        }
        return Result.success("昵称可用！", Map.of("nickname", nickname));
    }

    /**
     * 修改昵称
     *
     **/
    @PostMapping("/edit/nickname")
    public Result<Map<String, Object>> editNickname(@RequestParam String newNickname, @RequestParam String userId) {
        return userInformationService.editNickname(newNickname, userId);
    }

    /**
     * 把违规的昵称变成先知白兑换码
     *
     */
    @PostMapping("/edit/prohibited/nickname")
    public Result<Map<String, Object>> editProhibitedNickname(@RequestParam String userId) {
        return userInformationService.editProhibitedNickname(userId);
    }

    /**
     *
     * @deprecated 2026/10/27
     * 当以上方法都无法清理违规昵称时，用此方法清理所有违规昵称，临时测试，不打算写入代码中
     *
     *
     **/

    @GetMapping("/clean/all/prohibited")
    public String cleanAll() {
        List<String> allUserIds = userInformationMapper.getAllUserIds();
        int count = 0;
        for (String uid : allUserIds) {
            Result<Map<String, Object>> res = userInformationService.editProhibitedNickname(uid);
            if (res.getMessage().contains("已重置")) count++;
        }
        return "清理完成！共重置了 " + count + " 个违规昵称。";
    }

    /**
     * 2026/10/31
     * <p>
     * <p>
     * 万圣节时创建
     * 添加出生日期
     *
     **/
    @PostMapping("/add/birthday")
    public Result<Map<String, Object>> addBirthday(@RequestParam LocalDateTime birthday,
                                                   @RequestParam String userId) {
        return userInformationService.addBirthday(birthday, userId);
    }

    @GetMapping("/select/birthday")
    public Result<List<Map<String, Object>>> selectMyBirthday(@RequestParam String userId) {
        return userInformationService.selectMyBirthday(userId);
    }

    @PostMapping("/trigger/birthday")
    public Result<String> triggerBirthdayMessage() {
        // 调用 service 查出今天生日的人
        List<Map<String, Object>> todayList = userInformationService.selectTodayBirthdayUsers();
        if (todayList == null || todayList.isEmpty()) {
            return Result.successMessage("今天没有人过生日");
        }

        int count = 0;
        for (Map<String, Object> user : todayList) {
            String userId = String.valueOf(user.get("userId"));
            String nickname = String.valueOf(user.get("nickname"));
            // 这里需要注入 PrivateMessageService
            privateMessageService.sendBirthdayMessage(userId, nickname);
            count++;
        }
        return Result.successMessage("生日祝福发送完毕，共处理 " + count + " 人");
    }

    @GetMapping("/search")
    public Result<List<Map<String, Object>>> searchUsers(@RequestParam String keyword) {
        return userInformationService.searchUsers(keyword);
    }


    /**
     * @author Conan Doyle
     * @since 2026/11/06/16:10
     * @功能: 添加视频会员功能，我加入到youtuber的VIP，可以看youtuber的特定视频（VIP视频）
     * @注意: 暂时先不加前端界面
     *
     **/
    //加入会员
    @PostMapping("/join/youtuber/video/vip")
    public Result<Map<String, Object>> joinYoutuberSpecialVideoVIP(@RequestParam String myUserId, @RequestParam String youtuberId) {
        return userInformationService.joinYoutuberSpecialVideoVIP(myUserId, youtuberId);
    }
    //退出会员
    @PostMapping("/quit/youtuber/video/vip")
    public Result<Map<String,Object>> quitYoutuberVip(@RequestParam String myUserId,@RequestParam String youtuberId){
        return userInformationService.quitYoutuberVip(myUserId, youtuberId);
    }
    //某位UP主的所有会员列表（UP主后台查看用）
    @GetMapping("/select/youtuber/video/vip/members")
    public Result<List<Map<String,Object>>> selectYoutuberVipList(@RequestParam String youtuberId){
        return userInformationService.selectYoutuberVipList(youtuberId);
    }
}