

***

# YouTube AI

[![CI](https://github.com/Kitaajya/Youtube_AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Kitaajya/Youtube_AI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个从零实现的视频社区网站，前后端一体，深度接入 AI 与高并发架构

本项目为个人学习实践作品，与 YouTube 官方无任何关联。

覆盖 AI 智能问答、视频上传/播放/点赞/评论、短视频流、动态社交、私信会话（含群聊）、关注粉丝、收藏夹、消息通知、历史记录等完整模块。前端为原生 HTML/CSS/JS 多页应用，后端为 Spring Boot + Spring AI + MyBatis + MySQL + Redis。

## 🖼️ 界面预览

<h1>🐳 DeepSeek AI 助手</h1>
<img width="100%" src="https://github.com/user-attachments/assets/3b2a585b-672f-434d-a1f8-f6b17af81ac3" alt="DeepSeek AI样式" />

<h1>🐳 DeepSeek网络评论警察自动筛选违规评论并删除</h1>
<h1>展示违规评论</h1>
<img width="1295" height="522" alt="image" src="https://github.com/user-attachments/assets/8a6fccfd-bdc5-4af5-b488-131c839e80f1" />
<h1>DeepSeek审查评论</h1>
<img width="2349" height="727" alt="image" src="https://github.com/user-attachments/assets/97f4f932-6717-4b46-90b9-b5eff7dd58be" />
<h1>DeepSeek删除评论</h1>
<img width="1302" height="389" alt="image" src="https://github.com/user-attachments/assets/72a73766-f3f3-451e-8f82-0f94708fa70f" />



<h1>🗄️ 数据库智能问答（NL2SQL 逻辑）</h1>
<img width="100%" src="https://github.com/user-attachments/assets/42e08553-da93-4c71-aa2b-9bc41ab56d11" alt="插入数据库后的DeepSeek" />

<h1>📝 视频评论区 AI 总结</h1>
<img width="100%" src="https://github.com/user-attachments/assets/f141190c-842a-4c0c-b3e9-ff1931f84b14" alt="视频评论区总结" />

<h1>🎬 视频流与短视频</h1>
<img width="100%" src="https://github.com/user-attachments/assets/afd8fc23-8f47-48fa-a5f5-ec7005e85e6c" alt="普通样例" />
<img width="100%" src="https://github.com/user-attachments/assets/a5bdeeed-8111-4477-adf8-ba6c3b3c8b3e" alt="短视频区域" />

<h1>👤 个人主页与观看历史</h1>
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

### 🛡️ 昵称内容审核与自动清洗（安全模块）
- **准入查杀拦截**：采用“先放行、后清洗”的异步机制。新用户注册时，系统后台会利用 `ScheduledExecutorService` 开启定时任务，若检测到昵称包含 `prohibit_words` 表中的违禁词，则自动将原昵称重置为 13 位随机字符串（先知白兑换码），从源头避免违规昵称污染线上环境。
- **一键全量清洗**：后台提供 `/api/user/clean/all/prohibited` 接口，支持一键遍历扫描全库已注册用户，精准定位违规昵称并强制重置为随机 ID。
- **黑名单模式匹配**：底层基于 MySQL 的 `LIKE CONCAT('%', message, '%')` 进行多模式匹配，安全隔离含有色情、暴力等敏感字段的违规内容。

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
按文件名顺序执行 `sql/` 目录下的脚本，创建 `youtube` 库及全部表：

```bash
mysql -u root -p < sql/01_schema.sql        # 建表
mysql -u root -p < sql/02_fix_collation.sql # 修复排序规则
```

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
├── sql/                        # 数据库建表与修复脚本
├── LICENSE                     # 开源协议
├── README.md                   # 项目说明
└── src/
    └── main/
        ├── java/org/designer/youtube/
        │   ├── YoutubeApplication.java   # 启动类
        │   ├── RandomlyCreateID.java     # 13 位随机业务主键生成器
        │   ├── common/                   # 统一响应体 Result
        │   ├── config/                   # 静态资源映射(WebMvc)、Caffeine 缓存配置
        │   ├── controller/               # Web 控制层 (按业务拆分)
        │   │   ├── UserInformationController.java  # 用户与粉丝关注
        │   │   ├── VideoController.java            # 视频、点赞、评论、收藏夹、通知
        │   │   ├── DynamicController.java          # 动态 CRUD
        │   │   ├── PrivateMessageController.java   # 私信、群聊、表情包
        │   │   ├── DeepSeekController.java         # AI 对话与数据分析路由
        │   │   ├── CaptchaController.java          # 图片验证码生成与校验
        │   │   └── RedisController.java            # Redis 连通性测试
        │   ├── entity/                   # 数据库实体类 (User, Video, PrivateMessage...)
        │   ├── mapper/                   # MyBatis 注解 SQL 接口 (无 XML)
        │   │   ├── UserInformationMapper.java      # 用户、关注、违禁词
        │   │   ├── VideoMapper.java                # 视频、评论、点赞、收藏夹、通知、历史
        │   │   ├── DynamicMapper.java              # 动态及评论
        │   │   └── PrivateMessageMapper.java       # 私信、群聊、表情包
        │   └── service/                  # 业务逻辑层
        │       ├── VideoService.java               # 视频、高并发点赞、AI 审核逻辑
        │       ├── VideoFileService.java           # 文件落盘、ffprobe 探测、封面/私信媒体
        │       ├── UserInformationService.java     # 注册登录、违禁词清洗
        │       ├── DynamicService.java             # 动态业务
        │       ├── PrivateMessageService.java      # 私信/群聊流转、群主转让/解散
        │       └── DeepSeekTest.java               # Spring AI 底层调用封装
        └── resources/
            ├── application.properties              # 全局配置(数据库/Redis/AI/视频路径)
            └── static/                             # 原生前端多页应用 (无构建)
                ├── css/                            # 样式文件
                │   ├── vars.css                    # 亮色主题变量
                │   ├── dark.css                    # 深色模式覆盖
                │   ├── style.css                   # 全局公共样式(顶栏、播放器、评论区)
                │   ├── channel.css                 # 频道页样式
                │   ├── pm.css                      # 私信/群聊样式
                │   ├── register.css                # 登录注册页样式
                │   └── shorts.css                  # 短视频滑动流样式
                ├── js/                             # 逻辑脚本
                │   ├── common.js                   # 全局请求封装、导航栏/侧栏渲染、通知轮询
                │   ├── theme.js                    # 深浅色主题切换记忆
                │   ├── home.js                     # 首页视频流渲染 + 悬浮 AI 助手
                │   ├── watch.js                    # 播放页、评论楼中楼、点赞、AI 总结
                │   ├── shorts.js                   # 短视频滑动、IntersectionObserver 预加载
                │   ├── message.js                  # 私信/群聊、轮询、AI 思考气泡
                │   ├── profile.js                  # 频道页、收藏夹、关注粉丝
                │   ├── upload.js                   # 分片上传、浏览器端时长兜底探测
                │   ├── dynamic.js                  # 动态发布与本地镜像
                │   ├── history.js                  # 观看历史列表
                │   ├── login.js                    # 登录与验证码
                │   ├── register.js                 # 注册
                │   └── comment.js                  # 评论组件(旧)
                └── *.html                          # 页面入口
                    ├── index.html                  # 首页(视频流)
                    ├── watch.html                  # 播放页
                    ├── shorts.html                 # 短视频流
                    ├── message.html                # 私信与群聊
                    ├── profile.html                # 个人/他人频道页
                    ├── dynamic.html                # 动态广场
                    ├── upload.html                 # 视频上传
                    ├── history.html                # 观看历史
                    ├── login.html                  # 登录
                    └── register.html               # 注册
```

## 🗄 数据表一览

| 表 | 用途 | 关键设计 |
|---|---|---|
| `user_information` | 用户 | user_id 13位随机主键，username 唯一 |
| `prohibit_words` | 违禁词表 | 存储色情、暴力等违规词汇，供昵称/消息拦截 |
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

> **全局约定：**
> 1. 统一返回体为 `Result{code, success, message, data}`。
> 2. 除特别注明外，所有接口的参数均通过 `@RequestParam` 接收，前端直接使用 **Query String**（GET/DELETE）或 **application/x-www-form-urlencoded**（POST）提交。
> 3. 文件上传接口使用 `multipart/form-data`。
> 4. 标注为 **(流式)** 的接口，返回类型为 `Flux<String>`，前端需使用 `ReadableStream` 处理流式输出。

---

### 🤖 AI 对话与智能分析 `/api/deepseek`
*深度接入 Spring AI，把数据库内容转化为上下文喂给大模型（NL2SQL 逻辑）。*

| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| GET | `/stream` | `question` | 普通 AI 流式问答（打字机效果）**(流式)** |
| GET | `/ask/deepseek` | `question` | 普通 AI 阻塞式问答 |
| GET | `/analyze/likes` | `question` | 把全站点赞记录喂给 AI，进行总结或查询 **(流式)** |
| GET | `/analyze/user` | `question` | 把全站用户信息喂给 AI，支持条件检索 **(流式)** |
| GET | `/analyze/dynamic/comments` | `question` | 把动态评论数据喂给 AI 进行分析 **(流式)** |
| GET | `/analyze/private/message/emoji` | `question` | 把表情包数据库喂给 AI 进行查询 **(流式)** |
| GET | `/analyze/video/comments` | `vid`, `question` | 提取某视频下的所有评论，让 AI 一键总结 **(流式)** |
| GET | `/analyze/private/message/member` | `groupId`, `question` | 把群成员信息喂给 AI 进行查询 **(流式)** |

---

### 👤 用户模块 `/api/user`

| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| POST | `/create/user/account` | `username`, `password`, `nickname`, `email`, `phone` | 注册账号（自动生成 13 位 userId） |
| POST | `/login` | `username`, `password`, `captcha` | 登录（强制校验 Session 中的验证码） |
| GET | `/select/me/follow` | `me` | 查询我关注了谁（返回列表） |
| GET | `/select/me/fans` | `me` | 查询谁关注了我（返回列表） |
| POST | `/follow` | `me`, `upId` | 关注某人（自动拦截重复关注） |
| POST | `/unfollow` | `me`, `upId` | 取关某人（返回 0 行视为本来就没关注，非报错） |
| GET | `/check/nickname` | `nickname`, `userId` | 注册/修改前预检昵称是否包含违禁词 |
| POST | `/edit/nickname` | `newNickname`, `userId` | 用户主动修改昵称 |
| POST | `/edit/prohibited/nickname`| `userId` | 强制清洗某个违规用户的昵称（重置为随机 ID） |
| GET | `/clean/all/prohibited` | 无 | **[管理端]** 全库扫描并重置违规昵称 |

---

### 🎬 视频与点赞模块 `/api/video`

#### 视频上传与查询
| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| POST | `/upload/file` | `userId`, `title`, `file`(Multipart), `clientDurationSec`, `clientVertical` | **首选**：真实文件上传落盘（支持前端时长兜底探测） |
| POST | `/upload` | `userId`, `title`, `videoPath` | 备用：仅登记服务器上的视频路径字符串 |
| GET | `/select/videos/upinfor` | 无 | 查全站视频（联表带出 UP 主昵称、头像、点赞数） |
| GET | `/select/video/single/infor`| `id` | 根据视频 ID 查单条详情 |
| GET | `/select/like` | `keyword` | 模糊搜索视频标题（内置了 Sleep 防刷机制） |
| POST | `/edit/title` | `newTitle`, `id`, `userId` | 修改自己视频的标题 |
| DELETE | `/delete/videos` | `id`, `userId` | 删除自己的视频 |
| POST | `/upload/cover` | `videoId`, `userId`, `file`(Multipart) | 上传/更换视频封面 |
| POST | `/check/video/title` | `videoId` | 单独触发视频标题的违禁词审核 |

#### 播放与点赞
| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| POST | `/add/view` | `id` | 视频播放量 +1（回读真实播放量返回） |
| GET | `/select/like/count` | `id`, `userId` | 查视频点赞数及当前用户是否点过赞 |
| POST | `/add/like` | `id`, `userId` | 点赞（MySQL 为准，Redis 拦截高并发重复点击） |
| POST | `/cancel/like` | `id`, `userId` | 取消点赞（直接重置 Redis 计数为 MySQL 最新值） |

#### 评论与楼中楼
| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| GET | `/get/all/comments` | `videoId`, `userId`(可选) | 查视频的所有评论（带点赞数及当前用户是否赞过） |
| POST | `/add/my/comments` | `commentId`, `videoId`, `userId`, `content`, `parentId`(可选) | 发布评论（`parentId` 有值则是楼中楼回复） |
| POST | `/add/comment/like` | `me`, `commentId` | 给评论点赞/取消点赞（Toggle 逻辑） |
| DELETE | `/delete/my/comments` | `myUserId`, `videoId`, `commentId` | 删除自己的评论 |
| POST | `/edit/my/comments` | `newContent`, `commentId`, `myUserId` | 修改自己的评论 |

#### 其他（历史、短视频、AI审核）
| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| GET | `/select/short` | `size`, `offset` | 获取短视频流（按热度 `播放*0.3+点赞*0.7` 排序） |
| GET | `/select/history` | `userId` | 查观看历史（限 200 条） |
| POST | `/insert/history` | `userId`, `videoId` | 写入观看历史（`ON DUPLICATE KEY UPDATE` 刷新时间） |
| POST | `/delete/auto/prohibited/comment` | `videoId` | 触发 DeepSeek 静默审查并自动删除违规评论 |

---

### 📁 收藏夹与通知 `/api/video`

| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| POST | `/create/like/format` | `pList`, `userId`, `name`, `description`, `isPublic` | 创建新收藏夹 |
| POST | `/add/to/like` | `pList`, `videoId` | 把视频加入收藏夹 |
| GET | `/select/like/format` | `owner`, `viewer`, `videoId` | 查某人的收藏夹列表（带视频数及视频是否在里面） |
| GET | `/select/like/format/videos`| `pList` | 查某收藏夹内的所有视频 |
| POST | `/edit/like/format/public` | `pList`, `userId`, `isPublic` | 修改收藏夹公开/私密状态 |
| DELETE | `/remove/from/like` | `pList`, `videoId` | 从收藏夹中移出单个视频 |
| DELETE | `/delete/like` | `pList`, `userId` | 删除整个收藏夹 |
| GET | `/notify` | `me`, `size`, `offset` | 拉取通知列表（点赞、评论、关注等） |
| POST | `/notify/read/all` | `me` | 把发给我的所有未读通知标记为已读 |

---

### 💬 私信与群聊 `/api/private_message`

#### 私信基础
| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| GET | `/select/message` | `a`, `b` | 加载两人之间的双向完整聊天记录 |
| GET | `/select/inbox` | `me` | 加载收件箱（会话最后一条消息 + 未读数，窗口函数实现）|
| GET | `/count/unread` | `me` | 查别人发给我的未读消息总数 |
| POST | `/send` | `PrivateMessage` 实体 | 发送文本私信（`fromUser`, `toUser`, `contents`） |
| POST | `/upload/media` | `file`(Multipart) | 私信图片/视频上传落盘，返回 `mediaPath` |
| POST | `/send/picture/video` | `PrivateMessage` 实体 | 发送图片/视频私信（携带上一步的 `mediaPath`） |
| POST | `/send/emoji` | `PrivateMessage` 实体 | 发送表情包（携带 `mediaPath`） |
| GET | `/emoji/list` | 无 | 获取可用表情包列表 |
| POST | `/withdraw/private/message` | `msgId`, `userId`, `timeWithdraw` | 撤回私信（通常前端传 120 秒内） |
| POST | `/delete/private/message` | `msgId`, `userId` | 单方面软删除私信（不影响对方查看） |

#### 群聊与 AI 助手
| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| POST | `/establish/group` | `groupName`, `ownerId` | 创建群聊（后端自动生成 `groupId`） |
| POST | `/add/member` | `groupId`, `userId`, `fromUser` | 拉人进群（自动发送通知给被拉者） |
| POST | `/remove/member` | `groupId`, `userId`, `groupOwner` | 群主踢人 |
| GET | `/select/my/groups` | `me` | 查我加入的群聊列表 |
| GET | `/select/group/message` | `groupId` | 查群聊的聊天记录 |
| POST | `/add/group/message` | `msgId`(可选), `groupId`, `fromUser`, `contents`, `msgType`, `mediaPath` | 发送群消息（文本/图片/表情） |
| POST | `/exit/group` | `groupId`, `userId` | 退群（群主退群触发随机转让或自动解散） |
| GET | `/select/group/member` | `groupId` | 查群成员列表 |
| GET | `/select/group/message/deepseek` | `question`, `groupId` | **核心 AI**：DeepSeek 读取群聊上下文并流式回答 **(流式)** |

---

### 🧩 其他辅助接口

| 方法 | 路径 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| GET | `/api/dynamic/dynamic/select/all` | `id`, `content`, `createTime` | 精确匹配查询动态 |
| POST | `/api/dynamic/dynamic/write` | `content`, `id`, `userId` | 发布动态 |
| DELETE | `/api/dynamic/dynamic/delete` | `id`, `createTime` | 删除动态 |
| GET | `/captcha` | 无 | 生成 4 位图片验证码（存入 Session） |
| GET | `/checkCaptcha` | `inputCode` | 校验验证码是否正确 |
| GET | `/api/redis/get` | 无 | Redis 连通性测试 |

---

### 💡 核心响应示例

**1. 视频点赞成功 (POST `/api/video/add/like`)**
```json
{
  "code": 200,
  "success": true,
  "message": "点赞成功",
  "data": {
    "like_count": 128,
    "liked": true
  }
}
```
## 🧠 踩坑与排错 Skill 指南

在开发过程中，我们总结了大量复杂全栈场景的排错经验（详见 `Skill.txt`）：
1. **AI 流式输出防抖**：不要用特征文本（如“思考中”）作为状态载体，应当使用 `msgType='ai_thinking'` 标记并在渲染时过滤；前端必须加 `aiLock` 状态锁，防止轮询和流式请求把主线程打满。
2. **异常兜底**：遇到点击无反应，先按 `F12` 看 Network 是否有满屏红色 500。Spring AI 的 `.stream()` 调用必须捕获异常，避免底层 500 堆栈直接抛给前端。
3. **外键与脏数据**：建群拉人时，如果前端静默吞掉了后端的 `message`，会导致“假成功”。应当明确通过 `alert` 暴露错误，并在后端使用 `@Transactional` 保证一致性。
4. **SSE 接口 400 排查**：遇到 `WebClientResponseException: 400 Bad Request`，大概率是塞给 AI 的上下文超长了（`num_ctx` 溢出），或者模型不支持 Tool Calling。
5. **字符串匹配与空值陷阱**：在编写违规词全库清洗逻辑时，务必防范 `nickname` 为空导致的 `Map.of()` 空指针异常。同时，清洗接口的 `Controller` 需对 `Service` 返回的 message 字符串进行精确匹配（如包含“已重置”），否则会出现“数据库已修改，但页面统计仍为 0”的假象。

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源，可自由使用、修改与分发，请保留版权声明。

