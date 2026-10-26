
***

# YouTube Imitate

一个从零实现的视频社区网站，前后端一体，深度接入 AI 与高并发架构

本项目为个人学习实践作品，与 YouTube 官方无任何关联。

覆盖 AI 智能问答、视频上传/播放/点赞/评论、短视频流、动态社交、私信会话（含群聊）、关注粉丝、收藏夹、消息通知、历史记录等完整模块。前端为原生 HTML/CSS/JS 多页应用，后端为 Spring Boot + Spring AI + MyBatis + MySQL + Redis。

## 🖼️ 界面预览

**🤖 DeepSeek AI 助手**
<img width="100%" src="https://github.com/user-attachments/assets/3b2a585b-672f-434d-a1f8-f6b17af81ac3" alt="DeepSeek AI样式" />

**🗄️ 数据库智能问答（NL2SQL 逻辑）**
<img width="100%" src="https://github.com/user-attachments/assets/42e08553-da93-4c71-aa2b-9bc41ab56d11" alt="插入数据库后的DeepSeek" />

**📝 视频评论区 AI 总结**
<img width="100%" src="https://github.com/user-attachments/assets/f141190c-842a-4c0c-b3e9-ff1931f84b14" alt="视频评论区总结" />

**🎬 视频流与短视频**
<img width="100%" src="https://github.com/user-attachments/assets/afd8fc23-8f47-48fa-a5f5-ec7005e85e6c" alt="普通样例" />
<img width="100%" src="https://github.com/user-attachments/assets/a5bdeeed-8111-4477-adf8-ba6c3b3c8b3e" alt="短视频区域" />

**👤 个人主页与观看历史**
<img width="100%" src="https://github.com/user-attachments/assets/279127f0-8e3e-4bf3-9637-c5d4a206cae6" alt="个人主页" />
<img width="100%" src="https://github.com/user-attachments/assets/523e6da2-513f-49fa-9899-a869aa71bb1c" alt="查找历史" />

## 📖 目录

- [✨ 功能特性](#-功能特性)
- [🛠 技术栈](#-技术栈)
- [🚀 快速开始](#-快速开始)
- [📁 目录结构](#-目录结构)
- [🗄 数据表一览](#-数据表一览)
- [📡 API 一览](#-api-一览)
- [🧠 踩坑与排错 Skill 指南](#-踩坑与排错-skill-指南)
- [⚠️ 已知局限](#️-已知局限)

## ✨ 功能特性

### 🤖 AI 智能交互模块（核心亮点）
- **全流式 AI 问答**：前端利用 `fetch` 配合 `ReadableStream`，配合后端 `Flux` 实现打字机效果的流式对话，并处理了中断与重试逻辑。
- **智能意图路由**：前端 AI 助手根据用户提问关键词（如“表情”、“动态”、“用户”、“点赞”等），自动将请求分发至不同的数据分析接口或普通聊天接口。
- **自然语言查库（NL2SQL 逻辑）**：将用户信息、点赞记录、动态评论、表情包数据转换为自然语言上下文塞入 Prompt。
- **AI 群聊总结与问答**：私信群聊中，若用户发送特定指令（如包含“DeepSeek”），AI 会自动读取群聊历史记录，总结上下文并以群友身份回答（前端使用 `aiLock` 状态锁 + 临时思考气泡，彻底解决流式输出引发的死循环）。
- **视频评论一键总结**：播放页提供 AI 总结按钮，一键分析该视频下的所有评论并提炼核心观点。

### 🎬 视频与短视频模块
- **真实文件上传**：Multipart 分片接收，最大支持 1GB，后端自动使用 `ffprobe` 探测时长与分辨率，自动判定是否为竖屏短视频（浏览器端兜底探测时长，解决服务器无 ffprobe 的问题）。
- **站内播放**：服务端通过 `WebMvcConfigurer` 将本地目录映射为 `/videos/**` 静态资源。
- **短视频流（Shorts）**：竖屏滑动流，自动计算热度（播放量*0.3 + 点赞*0.7），`IntersectionObserver` 实现进入视口自动播放、滑出暂停。
- **观看历史**：自动记录用户看过的视频，按时间倒序分页查询（单次最多 200 条）。

### 🚀 高并发点赞模块
- **MySQL 为主，Redis 为辅（Cache-Aside 模式）**：以数据库记录为唯一口径，Redis Set 用于拦截重复点赞请求，避免高并发下的数据库写热点。
- **缓存一致性保障**：取消点赞时，直接将 Redis 计数重置为数据库最新值，彻底解决缓存与数据库不一致（刷新后数据归零）的 Bug。

### 💬 私信与群聊模块（全新升级）
- **一对一私信**：双向会话完整加载，支持文本、图片、视频、表情包发送。
- **服务器端收件箱**：使用 MySQL 8 窗口函数聚合每个会话最后一条消息 + 未读数，换设备不丢记录。
- **群聊与成员管理**：支持创建群聊、拉人、退群、查看群成员列表。
- **群主智能转让与群解散**：群主退群时，系统自动随机（排除 AI_BOT）转让给群内活人；若群内无活人，则触发级联删除（`ON DELETE CASCADE`），自动解散并清空所有群消息及成员记录。
- **消息撤回与软删除**：支持 120 秒内撤回消息，支持单方面软删除（对方依然可见）。

### 👥 动态与社交
- 发布 / 编辑 / 删除动态，动态评论支持楼中楼。
- 关注 / 取关 UP 主，查看关注列表与粉丝列表。
- 仿 YouTube 频道页：横幅封面、居中头像、Subscribe 风格按钮，包含「首页 / 视频 / 收藏夹 / 关注与粉丝」四标签页。

### 🔔 消息通知模块
- 视频点赞、视频评论、回复、评论点赞、关注等操作会写入 `notification` 表。
- 顶栏铃铛按钮 + 未读红点，前端 5 秒长轮询，下拉面板显示通知列表，点开面板即标记已读。

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| **AI 引擎** | Spring AI · Ollama / DeepSeek API (SSE 流式响应) |
| 后端 | Java 17 · Spring Boot 3.x · Spring MVC |
| **缓存层** | Redis (StringRedisTemplate 处理点赞拦截与计数) |
| 持久层 | MyBatis (注解 SQL) · MySQL 8 (InnoDB / utf8mb4) |
| 前端 | 原生 HTML / CSS / JavaScript，无框架、无构建 |
| 其他 | Lombok · Multipart 文件存储 · Caffeine (本地缓存) |

## 🚀 快速开始

### 环境要求
- JDK 17+
- MySQL 8.0+
- Redis (用于点赞模块)
- Spring AI 支持的模型环境（如本地 Ollama 运行 deepseek-r1:8b / qwen2.5-coder，或配置 API Key）

### 1. 初始化数据库
执行 `sql/` 目录下的建表脚本，创建 `youtube` 库及全部表。

### 2. 修改配置
编辑 `src/main/resources/application.properties`：

```properties
# 数据库配置
spring.datasource.url=jdbc:mysql://localhost:3306/youtube?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8
spring.datasource.username=你的数据库用户
spring.datasource.password=你的数据库密码

# Redis 配置
spring.data.redis.host=localhost
spring.data.redis.port=6379

# 视频文件落盘目录（需提前创建）
video.storage.dir=D:/videos/Video_Bilibili_Practice/videos

# Spring AI 配置 (示例为本地 Ollama)
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.chat.model=deepseek-r1:8b
```

### 3. 启动
运行 `YoutubeApplication.java`，浏览器访问 `http://localhost:8080`，注册账号即可体验全部功能。

## 📁 目录结构

```text
├── sql/                        # 建表与修复脚本
└── src/main/
    ├── java/org/designer/youtube/
    │   ├── common/             # 统一响应体 Result
    │   ├── config/             # 静态资源映射、Caffeine 缓存等配置
    │   ├── controller/         # 用户/视频/动态/私信/验证码/DeepSeek/Redis
    │   ├── entity/             # 实体类
    │   ├── mapper/             # MyBatis 注解 SQL
    │   ├── service/            # 业务层 (含 DeepSeek 流式处理、私信、点赞逻辑)
    │   └── RandomlyCreateID.java   # 13 位随机业务主键生成器
    └── resources/
        ├── application.properties
        └── static/             # 前端多页应用
            ├── css/            # 主题变量、深色模式、模块化样式
            ├── js/             # 包含 common.js、home.js、message.js 等
            └── *.html          # index/login/register/upload/dynamic/watch/profile/message/shorts 等
```

## 🗄 数据表一览

| 表 | 用途 | 关键设计 |
|---|---|---|
| `user_information` | 用户 | user_id 13位随机主键，username 唯一 |
| `video` | 视频 | 自增主键，含 `is_short`、`duration_sec`、`cover_path` |
| `video_like` | 视频点赞 | 联合主键 (video_id, user_id) |
| `video_comment` | 视频评论 | parent_id 自引用实现楼中楼 |
| `comment_like` | 评论点赞 | 联合主键 (user_id, comment_id) |
| `dynamic` | 动态 | - |
| `content_comments` | 动态评论 | 独立于视频评论的表 |
| `private_message` | 私信 | is_read 标记 + 软删除/撤回标记 |
| `chat_group` | 群聊主体 | 记录群主、建群时间 |
| `group_member` | 群成员 | 关联群与用户 |
| `group_message` | 群聊消息 | 支持文本/图片/视频/表情 |
| `subscription` | 关注关系 | 联合主键 (fan_id, up_id) |
| `playlist` | 收藏夹 | uk_playlist_name 同人不可重名 |
| `playlist_video` | 收藏内容 | 联合主键 (playlist_id, video_id) |
| `notification` | 消息通知 | is_read 标记 + 索引优化 |
| `watch_history` | 观看历史 | 联合主键 (user_id, video_id) |
| `emoji_item` | 表情包 | 记录表情包文件路径与名称 |

## 📡 API 一览

统一返回 `Result{code, success, message, data}`；参数均为 `@RequestParam`。

**🤖 AI 对话 `/api/deepseek`**
- GET `/stream` (流式问答)
- GET `/analyze/likes` (分析点赞库)
- GET `/analyze/user` (分析用户库)
- GET `/analyze/dynamic/comments` (分析动态评论)
- GET `/analyze/private/message/emoji` (分析表情包)
- GET `/analyze/video/comments` (分析特定视频评论)

**👤 用户 `/api/user`**
- POST `/create/user/account` · POST `/login`（验证码校验）
- GET `/select/me/follow` · GET `/select/me/fans`
- POST `/follow` · POST `/unfollow`

**🎬 视频 `/api/video`**
- POST `/upload/file` (真实文件) · POST `/upload` (仅登记路径)
- GET `/select/videos/upinfor` · GET `/select/video/single/infor` · GET `/select/like` (搜索)
- POST `/edit/title` · DELETE `/delete/videos` · POST `/add/view`
- GET `/select/short` (短视频流) · GET `/select/history` · POST `/insert/history`
- **点赞**：POST `/add/like` · POST `/cancel/like` · GET `/select/like/count`
- **评论**：GET `/get/all/comments` · POST `/add/my/comments` · POST `/add/comment/like`
- **通知**：GET `/notify` · POST `/notify/read/all`

**📁 收藏夹 `/api/video`**
- POST `/create/like/format` · POST `/add/to/like` · DELETE `/remove/from/like`
- GET `/select/like/format` · POST `/edit/like/format/public`

**💬 私信与群聊 `/api/private_message`**
- POST `/send` · GET `/select/message` · GET `/select/inbox` · POST `/read`
- POST `/withdraw/private/message` (撤回) · POST `/upload/media`
- POST `/establish/group` · POST `/add/member` · POST `/exit/group`
- GET `/select/my/groups` · POST `/add/group/message` · GET `/select/group/member`

## 🧠 踩坑与排错 Skill 指南

在开发过程中，我们总结了大量复杂全栈场景的排错经验（详见 `Skill.txt`）：
1. **AI 流式输出防抖**：不要用特征文本（如“思考中”）作为状态载体，应当使用 `msgType='ai_thinking'` 标记并在渲染时过滤；前端必须加 `aiLock` 状态锁，防止轮询和流式请求把主线程打满。
2. **异常兜底**：遇到点击无反应，先按 `F12` 看 Network 是否有满屏红色 500。Spring AI 的 `.stream()` 调用必须捕获异常，避免底层 500 堆栈直接抛给前端。
3. **外键与脏数据**：建群拉人时，如果前端静默吞掉了后端的 `message`，会导致“假成功”。应当明确通过 `alert` 暴露错误，并在后端使用 `@Transactional` 保证一致性。
4. **SSE 接口 400 排查**：遇到 `WebClientResponseException: 400 Bad Request`，大概率是塞给 AI 的上下文超长了（`num_ctx` 溢出），或者模型不支持 Tool Calling。
