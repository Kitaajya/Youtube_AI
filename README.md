# Youtube

注：本说明书由AI生成，有哪里不对的地方直接跟我说就行。

一个从零实现的视频社区网站，前后端一体。覆盖视频上传/播放/点赞/评论、动态社交、私信会话、关注粉丝、收藏夹五大模块，前端为原生 HTML/CSS/JS 多页应用，后端为 Spring Boot + MyBatis + MySQL。

> 本项目为个人学习实践作品，与 YouTube 官方无任何关联。

markdown
<div align="center">

# YouTube Imitate

**一个从零实现的视频社区网站，前后端一体**

覆盖视频上传/播放/点赞/评论、动态社交、私信会话、关注粉丝、收藏夹、消息通知六大模块  
前端为原生 HTML/CSS/JS 多页应用，后端为 Spring Boot + MyBatis + MySQL

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-brightgreen)
![MyBatis](https://img.shields.io/badge/MyBatis-annotation%20SQL-red)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)
![License](https://img.shields.io/badge/license-学习项目-lightgrey)

> 本项目为个人学习实践作品，与 YouTube 官方无任何关联。

</div>

---

## 📖 目录

- [✨ 功能特性](#-功能特性)
- [🛠 技术栈](#-技术栈)
- [🚀 快速开始](#-快速开始)
- [📁 目录结构](#-目录结构)
- [🗄 数据表一览](#-数据表一览)
- [📡 API 一览](#-api-一览)
- [⚠️ 已知局限](#️-已知局限)

---

## ✨ 功能特性

### 🎬 视频模块

- 真实文件上传（multipart，支持 1GB，落盘目录可配置）与旧式路径登记双模式
- 站内播放：服务端将视频目录映射为 `/videos/**` 静态资源
- 播放计数（进页自动上报，后端回读真实值）
- 点赞 / 取消点赞（`INSERT IGNORE` + 联合主键天然去重，一人一视频仅一赞）
- 评论区：一级评论 + 楼中楼回复（`parent_id` 自引用外键）
- 标题模糊搜索、修改自己视频标题、删除视频（点赞/评论随外键级联清理）

### 📁 收藏夹模块

- 一人可建多个收藏夹，支持公开/私密（`is_public`）
- 播放页「收藏」弹窗：勾选式加入/移出、弹窗内直接新建收藏夹、`in_list` 回显该视频已在哪些夹
- 频道页「收藏夹」标签：渐变封面卡片网格，点击展开夹内视频（显示收藏时间）
- 中间表 `playlist_video` 联合主键去重 + `INSERT IGNORE`，同一夹内一个视频只存一次
- 看他人频道时自动只展示公开收藏夹（`viewer` 空串即游客语义）

### 📝 动态模块

- 发布 / 查看 / 编辑 / 删除自己的动态
- 动态评论同样支持楼中楼

### 💬 私信模块

- 用户间一对一私信，消息持久化于 `private_message` 表
- 双向会话完整加载（按时间正序）
- **服务器端收件箱**：窗口函数聚合每个会话最后一条消息 + 未读数 + 对方昵称，新设备/换浏览器不丢会话
- 未读角标、打开会话自动标记已读

### 👥 关注与频道

- 关注 / 取关 UP 主（`subscription` 联合主键表，一条记录 = 一次关注）
- 关注列表 / 粉丝列表（JOIN 用户表输出昵称头像）
- 仿 YouTube 频道页：默认横幅封面、居中头像、`@handle · 粉丝数 · 视频数`、Subscribe 风格按钮，以及「首页 / 视频 / 收藏夹 / 关注与粉丝」四标签页
- 播放页与频道页均有关注按钮与私信入口

### 🔔 消息通知模块

- 点赞、评论、回复、收藏、关注等操作会写入 `notification` 表，通知对应的人
- 顶栏铃铛按钮 + 未读红点（数字 = 第一页里 `is_read=0` 的条数）
- 下拉面板显示通知列表，按时间倒序、带触发人昵称头像、按类型配 emoji 图标
- **点开面板即标记已读**：调用 `/api/video/notify/read/all` 把发给我的未读通知全部置 1，红点即时消失
- 收藏类通知匿名处理（只显示"收藏了你的视频《xxx》"，不显示谁收藏的）

### 🎨 其他

- 深浅色主题切换（CSS 变量驱动，跟随系统偏好，全站自适应）
- 登录图形验证码（HttpSession 校验，防绕过前端直接调接口）
- 13 位随机字符串业务主键（`SecureRandom`），用户/动态/评论/私信/收藏夹/通知统一使用

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Java 17 · Spring Boot 4.1 · Spring MVC |
| 持久层 | MyBatis (注解 SQL) · MySQL 8 (InnoDB / utf8mb4_0900_ai_ci) |
| 前端 | 原生 HTML / CSS / JavaScript，无框架、无构建 |
| 其他 | Lombok · Multipart 文件存储 · Caffeine（依赖已引入，见已知局限） |

---

## 🚀 快速开始

### 环境要求

- JDK 17+
- MySQL 8.0+（依赖窗口函数与 `utf8mb4_0900_ai_ci` 排序规则）
- Maven（或直接使用项目自带 `mvnw`）

### 1. 初始化数据库

执行 `sql/数据库建表脚本.sql`（按外键依赖顺序，从头到尾一次执行），创建 `youtube` 库及全部表。

> 注：`private_message` / `subscription` / `playlist` / `playlist_video` / `notification` 若为后期手动新增，脚本内附有对应 `CREATE TABLE` 与补索引的 `ALTER` 注释，按需执行。

### 2. 修改配置

编辑 `src/main/resources/application.properties`：

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/youtube?...
spring.datasource.username=你的数据库用户
spring.datasource.password=你的数据库密码

# 视频文件落盘目录（需提前创建）
video.storage.dir=D:/videos/Video_Bilibili_Practice/videos
3. 启动
bash
./mvnw spring-boot:run
# 或 IDE 直接运行 YoutubeApplication
浏览器访问 http://localhost:8080，注册账号即可体验全部功能。

📁 目录结构
text
├── sql/                        # 建表与修复脚本
└── src/main/
    ├── java/org/designer/youtube/
    │   ├── common/             # 统一响应体 Result
    │   ├── config/             # 静态资源映射、Caffeine 缓存等配置
    │   ├── controller/         # 用户/视频/动态/私信/验证码
    │   ├── entity/             # 实体类
    │   ├── mapper/             # MyBatis 注解 SQL
    │   ├── service/            # 业务层（含视频文件落盘、通知写入）
    │   └── RandomlyCreateID.java   # 13 位随机业务主键生成器
    └── resources/
        ├── application.properties
        └── static/             # 前端多页应用
            ├── css/            # vars(主题变量)/dark/style/channel/pm/register
            ├── js/             # common(请求封装)/watch/profile/message 等
            └── *.html          # index/login/register/upload/dynamic/watch/profile/message
🗄 数据表一览
表	用途	关键设计
user_information	用户	user_id 13位随机主键，username 唯一
video	视频	自增技术主键，view_count 默认 0
video_like	点赞	联合主键 (video_id, user_id) 去重
video_comment	视频评论	parent_id 自引用外键实现楼中楼
dynamic	动态	—
content_comments	动态评论	同上，楼中楼
private_message	私信	is_read 标记 + idx_pm_inbox 收件箱索引
subscription	关注关系	联合主键 (fan_id, up_id)，双向 ON DELETE CASCADE
playlist	收藏夹	user_id 归属，uk_playlist_name 同人不可重名
playlist_video	收藏内容	联合主键 (playlist_id, video_id) 去重，双端级联清理
notification	消息通知	is_read 标记 + idx_nt_inbox(to_user, is_read, create_time) 索引
所有外键两端类型逐字对齐（VARCHAR(13) / utf8mb4_0900_ai_ci），避免 MySQL 3780 错误。

📡 API 一览
统一返回 Result{code, success, message, data}；参数均为 @RequestParam（urlencoded / query string）。

用户 /api/user
POST /create/user/account · POST /login（验证码校验） · GET /select/me/follow · GET /select/me/fans · POST /follow · POST /unfollow

视频 /api/video
POST /upload/file · POST /upload · GET /select · GET /select/videos/upinfor · GET /select/videos/upname · GET /select/all/videos · GET /select/video/single/infor · GET /select/video/title · GET /select/like（模糊搜索） · GET /select/path · GET /show/title · POST /edit/title · DELETE /delete/videos · POST /add/view（播放计数）
点赞：POST /add/like · POST /cancel/like · GET /select/like/count
评论：GET /get/all/comments · POST /add/my/comments · POST /edit/my/comments · DELETE /delete/my/comments · GET /select/parent/comments

收藏夹 /api/video
POST /create/like/format（建夹） · POST /add/to/like（收视频入夹） · DELETE /remove/from/like（单条移出） · DELETE /delete/like（删整个夹） · GET /select/like/format（夹列表+回显） · GET /select/like/format/videos（夹内视频） · POST /edit/like/format/public（切换公开/私密） · DELETE /clear/list

动态 /api/dynamic
GET /dynamic/select/all · POST /dynamic/write · POST /dynamic/edit · DELETE /dynamic/delete

私信 /api/private_message
POST /send · GET /select/message · GET /select/inbox · GET /count/unread · POST /read

消息通知 /api/video
GET /notify（通知列表，带 is_read） · POST /insert/notify（写入通知） · POST /notify/read/all（标记全部已读，消红点） · POST /select/owner（查视频作者与标题） · GET /select/comment（查评论作者）

验证码
GET /captcha（生成图片） · GET /checkCaptcha（校验）

⚠️ 已知局限（学习项目取舍）
密码明文存储；登录态仅存于浏览器 localStorage，接口层未做会话鉴权，userId 由前端传入（可被伪造）——生产场景必须补 Session/Token 校验与密码哈希

播放量未做防刷去重，刷新页面会重复计数

列表接口大多无分页，数据量大时需补 LIMIT/OFFSET

删除视频只删数据库记录，不清理磁盘文件，长期运行会占用存储

缓存依赖（spring-boot-starter-cache + Caffeine）已引入，但 VideoService 上的 @Cacheable 未真正生效（类级注解用法有误），目前每次查询直连数据库

私信发送失败后前端「先上屏」的乐观更新未做失败回滚

通知红点数字只反映"第一页（20 条）里未读的条数"，若未读 >20 显示不会超过 20；点开后 read/all 会清空全部未读

收藏目前不会产生通知（addToLikeList 未调 insertNotify），只有点赞/评论/回复会写通知

头像/频道横幅目前用首字母占位与默认图，未开放自定义上传

📄 License
个人学习项目。仅供交流学习使用。

<div align="center">
Made with ❤️ by Jya Yijya (Tanmoku Kitaajya) · 2026

</div> ```
---
Author: Jya Yijya (Tanmoku Kitaajya) · 2026
