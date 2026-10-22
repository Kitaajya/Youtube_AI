# YouTube Imitate

**一个从零实现的视频社区网站，前后端一体，深度接入 AI**

本项目为个人学习实践作品，与 YouTube 官方无任何关联。

覆盖 AI 智能问答、视频上传/播放/点赞/评论、动态社交、私信会话、关注粉丝、收藏夹、消息通知七大模块。前端为原生 HTML/CSS/JS 多页应用，后端为 Spring Boot + Spring AI + MyBatis + MySQL。

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-brightgreen)
![Spring AI](https://img.shields.io/badge/Spring%20AI-DeepSeek-blueviolet)
![MyBatis](https://img.shields.io/badge/MyBatis-annotation%20SQL-red)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)
![License](https://img.shields.io/badge/license-学习项目-lightgrey)

---

### 🖼️ 界面预览

**DeepSeek AI 样式：**
<img width="713" height="1132" alt="DeepSeek AI样式" src="https://github.com/user-attachments/assets/3b2a585b-672f-434d-a1f8-f6b17af81ac3" />

**插入数据库后的 DeepSeek：**
<img width="642" height="1094" alt="插入数据库后的DeepSeek" src="https://github.com/user-attachments/assets/42e08553-da93-4c71-aa2b-9bc41ab56d11" />
**对每个视频添加评论区DeepSeek总结
<img width="1836" height="1122" alt="image" src="https://github.com/user-attachments/assets/f141190c-842a-4c0c-b3e9-ff1931f84b14" />

**普通样例：**
<img width="100%" alt="普通样例" src="https://github.com/user-attachments/assets/afd8fc23-8f47-48fa-a5f5-ec7005e85e6c" />

**短视频区域：**
<img width="100%" alt="短视频区域" src="https://github.com/user-attachments/assets/a5bdeeed-8111-4477-adf8-ba6c3b3c8b3e" />

**个人主页：**
<img width="100%" alt="个人主页" src="https://github.com/user-attachments/assets/279127f0-8e3e-4bf3-9637-c5d4a206cae6" />

**查找历史：**
<img width="100%" alt="查找历史" src="https://github.com/user-attachments/assets/523e6da2-513f-49fa-9899-a869aa71bb1c" />

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

### 🤖 AI 智能交互模块（核心亮点）

本项目深度集成了 **Spring AI** 与 **DeepSeek 大模型**，实现了从传统 CRUD 到智能交互的跨越：
- **全流式 AI 问答**：前端利用 `fetch` 配合 `ReadableStream`，配合后端 `Flux` 实现打字机效果的流式对话。
- **自然语言查库（NL2SQL 逻辑）**：将数据库中的点赞记录、用户信息转换为自然语言上下文，塞入 System Prompt 中。用户可以直接向 AI 提问（如：“帮我查查谁赞了最多”、“有没有叫张三的用户”），AI 会基于真实数据进行推理回答。
- **智能意图路由**：前端 AI 助手具备路由逻辑，根据用户提问的关键词（如包含“点赞”、“用户”等），自动将请求分发至不同的数据分析接口或普通聊天接口。

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
- 未读角标、打开会话自动标记已读、支持富媒体消息（图片/视频）发送与软删除

### 👥 关注与频道
- 关注 / 取关 UP 主（`subscription` 联合主键表，一条记录 = 一次关注）
- 关注列表 / 粉丝列表（JOIN 用户表输出昵称头像）
- 仿 YouTube 频道页：默认横幅封面、居中头像、`@handle · 粉丝数 · 视频数`、Subscribe 风格按钮，以及「首页 / 视频 / 收藏夹 / 关注与粉丝」四标签页

### 🔔 消息通知模块
- 点赞、评论、回复、收藏、关注等操作会写入 `notification` 表，通知对应的人
- 顶栏铃铛按钮 + 未读红点，下拉面板显示通知列表，按时间倒序、带触发人昵称头像
- **点开面板即标记已读**，红点即时消失

### 🎨 其他
- 深浅色主题切换（CSS 变量驱动，跟随系统偏好，全站自适应）
- 登录图形验证码（HttpSession 校验，AWT 绘制，防绕过前端直接调接口）
- 13 位随机字符串业务主键（`SecureRandom`），统一使用

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| **AI 引擎** | Spring AI · DeepSeek API (SSE 流式响应) |
| 后端 | Java 17 · Spring Boot 4.1 · Spring MVC |
| 持久层 | MyBatis (注解 SQL) · MySQL 8 (InnoDB / utf8mb4_0900_ai_ci) |
| 前端 | 原生 HTML / CSS / JavaScript，无框架、无构建 |
| 其他 | Lombok · Multipart 文件存储 · Caffeine |

---

## 🚀 快速开始

### 环境要求

- JDK 17+
- MySQL 8.0+（依赖窗口函数与 `utf8mb4_0900_ai_ci` 排序规则）
- Maven（或直接使用项目自带 `mvnw`）
- DeepSeek API Key（用于 AI 模块）

### 1. 初始化数据库

执行 `sql/数据库建表脚本.sql`（按外键依赖顺序，从头到尾一次执行），创建 `youtube` 库及全部表。

### 2. 修改配置

编辑 `src/main/resources/application.properties`：

```properties
# 数据库配置
spring.datasource.url=jdbc:mysql://localhost:3306/youtube?...
spring.datasource.username=你的数据库用户
spring.datasource.password=你的数据库密码

# 视频文件落盘目录（需提前创建）
video.storage.dir=D:/videos/Video_Bilibili_Practice/videos

# Spring AI (DeepSeek) 配置
spring.ai.openai.api-key=你的_DeepSeek_API_Key
spring.ai.openai.base-url=https://api.deepseek.com
spring.ai.openai.chat.options.model=deepseek-chat
```

### 3. 启动

```bash
./mvnw spring-boot:run
# 或 IDE 直接运行 YoutubeApplication
```

浏览器访问 `http://localhost:8080`，注册账号即可体验全部功能。

---

## 📁 目录结构

```text
├── sql/                        # 建表与修复脚本
└── src/main/
    ├── java/org/designer/youtube/
    │   ├── common/             # 统一响应体 Result
    │   ├── config/             # 静态资源映射、Caffeine 缓存等配置
    │   ├── controller/         # 用户/视频/动态/私信/验证码/DeepSeek
    │   ├── entity/             # 实体类
    │   ├── mapper/             # MyBatis 注解 SQL
    │   ├── service/            # 业务层 (含 DeepSeekTest 流式服务、视频落盘等)
    │   └── RandomlyCreateID.java   # 13 位随机业务主键生成器
    └── resources/
        ├── application.properties
        └── static/             # 前端多页应用
            ├── css/
            ├── js/             # 包含 home.js 里的 AI 聊天窗逻辑
            └── *.html          # index/login/register/upload/dynamic/watch/profile/message
```

---

## 🗄 数据表一览

| 表 | 用途 | 关键设计 |
|---|---|---|
| `user_information` | 用户 | user_id 13位随机主键，username 唯一 |
| `video` | 视频 | 自增技术主键，view_count 默认 0 |
| `video_like` | 点赞 | 联合主键 (video_id, user_id) 去重 |
| `video_comment` | 视频评论 | parent_id 自引用外键实现楼中楼 |
| `dynamic` | 动态 | — |
| `content_comments` | 动态评论 | 同上，楼中楼 |
| `private_message` | 私信 | is_read 标记 + idx_pm_inbox 收件箱索引 |
| `subscription` | 关注关系 | 联合主键 (fan_id, up_id)，双向 ON DELETE CASCADE |
| `playlist` | 收藏夹 | user_id 归属，uk_playlist_name 同人不可重名 |
| `playlist_video` | 收藏内容 | 联合主键 (playlist_id, video_id) 去重，双端级联清理 |
| `notification` | 消息通知 | is_read 标记 + idx_nt_inbox(to_user, is_read, create_time) 索引 |

---

## 📡 API 一览

统一返回 `Result{code, success, message, data}`；参数均为 `@RequestParam`。

**AI 对话 `/api/deepseek`**
`GET /ask/deepseek` (阻塞式问答) · `GET /stream` (流式问答) · `GET /analyze/likes` (分析点赞库) · `GET /analyze/user` (分析用户库)

**用户 `/api/user`**  
`POST /create/user/account` · `POST /login`（验证码校验） · `GET /select/me/follow` · `GET /select/me/fans` · `POST /follow` · `POST /unfollow`

**视频 `/api/video`**  
`POST /upload/file` · `POST /upload` · `GET /select` · `GET /select/videos/upinfor` · `GET /select/video/single/infor` · `GET /select/like`（模糊搜索） · `POST /edit/title` · `DELETE /delete/videos` · `POST /add/view`  
点赞：`POST /add/like` · `POST /cancel/like` · `GET /select/like/count`  
评论：`GET /get/all/comments` · `POST /add/my/comments` · `POST /edit/my/comments` · `DELETE /delete/my/comments` · `POST /add/comment/like`

**收藏夹 `/api/video`**  
`POST /create/like/format` · `POST /add/to/like` · `DELETE /remove/from/like` · `DELETE /delete/like` · `GET /select/like/format` · `GET /select/like/format/videos` · `POST /edit/like/format/public` · `DELETE /clear/list`

**私信 `/api/private_message`**  
`POST /send` · `GET /select/message` · `GET /select/inbox` · `GET /count/unread` · `POST /read` · `POST /withdraw/private/message` (撤回) · `POST /upload/media`

**消息通知 `/api/video`**  
`GET /notify` · `POST /notify/read/all` · `POST /select/owner`

---

## ⚠️ 已知局限（学习项目取舍）

- 密码明文存储；登录态仅存于浏览器 localStorage，接口层未做会话鉴权（生产场景必须补 Token 校验与密码哈希）。
- **AI 模块**：目前仅将查询结果以长字符串拼接入 Prompt，数据量极大时可能超出模型上下文限制（Token 溢出）；未使用向量数据库进行 RAG 检索优化。
- 播放量未做防刷去重，刷新页面会重复计数。
- 列表接口大多无分页，数据量大时需补 LIMIT/OFFSET。
- 删除视频只删数据库记录，不清理磁盘文件。
- 私信发送失败后前端「先上屏」的乐观更新未做失败回滚。
- 缓存依赖（Caffeine）已引入，但 `VideoService` 上的 `@Cacheable` 未真正生效（类级注解用法有误）。

---

## 📄 License

个人学习项目。仅供交流学习使用。

---

*Made with ❤️ by Jya Yijya (Tanmoku Kitaajya) · 2026*
