package org.designer.youtube.controller;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.designer.youtube.RandomlyCreateID;
import org.designer.youtube.common.Result;
import org.designer.youtube.mapper.UserInformationMapper;
import org.designer.youtube.service.PrivateMessageService;
import org.designer.youtube.service.UserInformationService;
import org.designer.youtube.service.VideoFileService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
    private final VideoFileService videoFileService;

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

    @GetMapping("/check/youtuber/vip")
    public Result<Map<String, Object>> checkYoutuberVip(@RequestParam String myUserId, @RequestParam String youtuberId) {
        return userInformationService.isYoutuberVip(myUserId, youtuberId);
    }
    /**
     * @since 2026/11/07/10:26
     * @author Conan Doyle
     * @功能: 添加用户头像。如果用户不添加头像，默认用首字母或汉字第一个字
     * **/
    @PostMapping("/add/avatar")
    public Result<Map<String,Object>> addAvatar(@RequestParam String userId,@RequestParam String avatar){
        return userInformationService.addAvatar(userId, avatar);
    }

    /**
     * 头像上传（一步到位）：接收图片文件 → 落盘 → 把访问 URL 写回 user_information.avatar。
     * 前端只需带 userId + file 调这一个接口，不用再分两步借用封面上传接口。
     */
    @PostMapping("/upload/avatar")
    public Result<Map<String,Object>> uploadAvatar(@RequestParam String userId,
                                                   @RequestParam("file") MultipartFile file){
        return videoFileService.uploadAvatar(userId, file);
    }
    @GetMapping("/select/avatar")
    public Result<List<Map<String, Object>>> selectAvatar(@RequestParam String userId){
        return userInformationService.selectAvatar(userId);
    }
    /**
     *
     * @since 2026/11/17/21:20
     * @author Conan Doyle
     * @功能: 用户一个手机号可以添加多个账号，最多添加5个
     * **/

    //当前电话号下有几个号
    //int quantityOfCurrentPhoneNumber=userInformationService.countAccountsByPhone(phone);
    //当前电话号的大号id
    //String mainUserIdByPhone=userInformationService.selectMainUserIdByPhone(phone);

    //判断此小号是否为手机号下的小号
    @PostMapping("/justify/subaccount")
    public Result<Map<String, Object>> isSubAccount(@RequestParam String userId, @RequestParam String phone){
        log.info("当前手机号有{}个账号",userInformationService.countAccountsByPhone(phone));
        return userInformationService.isSubAccount(userId, phone);
    }
    //标出大号ID
    @PostMapping("/highlight/main/account")
    public Result<List<Map<String,Object>>> selectMainUserIdByPhone(@RequestParam String phone){
        return Result.success(userInformationService.selectMainUserIdByPhone(phone));
    }

    /**
     * 添加小号：一个手机号最多 6 个账号（1 大号 + 5 小号）
     * 调用前应先校验手机号、昵称违禁词、userId 不重复等
     * @return 1 成功；0 表示已达上限（未插入）
     */
    @PostMapping("/add/account")
    public Result<Map<String,Object>> addTheOtherAccounts(@RequestParam String userId,@RequestParam String username,@RequestParam String password,
                                                          @RequestParam String nickname,@RequestParam String email,@RequestParam String phone){
        return userInformationService.addTheOtherAccounts(userId, username, password, nickname, email, phone);
    }

    /**
     * 删除小号：只能删小号，不能删大号；且必须同手机号，防止越权删别人账号
     * @return 1 成功；0 表示不存在 / 是大号 / 手机号不匹配
     */
    @DeleteMapping("/delete/account")
    public Result<Map<String,Object>> deleteSubAccount(String userId,String phone){
        return userInformationService.deleteSubAccount(userId, phone);
    }
}