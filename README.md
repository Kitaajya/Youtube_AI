# Youtube 

注：本说明书由AI生成，有哪里不对的地方直接跟我说就行。

一个从零实现的视频社区网站，前后端一体。覆盖视频上传/播放/点赞/评论、动态社交、私信会话、关注粉丝四大模块，前端为原生 HTML/CSS/JS 多页应用，后端为 Spring Boot + MyBatis + MySQL。

> 本项目为个人学习实践作品，与 YouTube 官方无任何关联。

## ✨ 功能特性

### 🎬 视频模块
- 真实文件上传（multipart，支持 1GB，落盘目录可配置）与旧式路径登记双模式
- 站内播放：服务端将视频目录映射为 `/videos/**` 静态资源
- 播放计数（进页自动上报，后端回读真实值）
- 点赞 / 取消点赞（`INSERT IGNORE` + 联合主键天然去重，一人一视频仅一赞）
- 评论区：一级评论 + 楼中楼回复（`parent_id` 自引用外键）
- 标题模糊搜索、修改自己视频标题、删除视频（点赞/评论随外键级联清理）

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
- 仿 YouTube 频道页：横幅、居中头像、`@handle · 粉丝数 · 视频数`、Subscribe 风格按钮、首页/视频/关注与粉丝标签页
- 播放页与频道页均有关注按钮与私信入口

### 🎨 其他
- 深浅色主题切换（CSS 变量驱动，跟随系统偏好，全站自适应）
- 登录图形验证码（HttpSession 校验，防绕过前端直接调接口）
- 13 位随机字符串业务主键（`SecureRandom`），用户/动态/评论/私信统一使用

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Java 17 · Spring Boot 4.1 · Spring MVC |
| 持久层 | MyBatis (注解 SQL) · MySQL 8 (InnoDB / utf8mb4_0900_ai_ci) |
| 缓存 | Caffeine（进程内） |
| 前端 | 原生 HTML / CSS / JavaScript，无框架、无构建 |
| 其他 | Lombok · Multipart 文件存储 |

## 🚀 快速开始

### 环境要求
- JDK 17+
- MySQL 8.0+（依赖窗口函数与 `utf8mb4_0900_ai_ci` 排序规则）
- Maven（或直接使用项目自带 `mvnw`）

### 1. 初始化数据库
执行 `sql/数据库建表脚本.sql`（按外键依赖顺序，从头到尾一次执行），创建 `youtube` 库及全部表。

### 2. 修改配置
编辑 `src/main/resources/application.properties`：

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/youtube?...
spring.datasource.username=你的数据库用户
spring.datasource.password=你的数据库密码

# 视频文件落盘目录（需提前创建）
video.storage.dir=D:/videos/Video_Bilibili_Practice/videos

```

### 3. 启动

```bash
./mvnw spring-boot:run
# 或 IDE 直接运行 YoutubeApplication

```

浏览器访问 `http://localhost:8080`，注册账号即可体验全部功能。

## 📁 目录结构

```
├── sql/                        # 建表与修复脚本
└── src/main/
    ├── java/org/designer/youtube/
    │   ├── common/             # 统一响应体 Result
    │   ├── config/             # 静态资源映射等配置
    │   ├── controller/         # 用户/视频/动态/私信/验证码
    │   ├── entity/             # 实体类
    │   ├── mapper/             # MyBatis 注解 SQL
    │   └── service/            # 业务层（含视频文件落盘）
    └── resources/
        ├── application.properties
        └── static/             # 前端多页应用
            ├── css/            # vars(主题变量)/dark/style/channel/pm 等
            ├── js/             # common(请求封装)/watch/profile/message 等
            └── *.html          # index/login/register/upload/dynamic/watch/profile/message

```

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

所有外键两端类型逐字对齐（VARCHAR(13) / utf8mb4_0900_ai_ci），避免 MySQL 3780 错误。

## 📡 API 一览

统一返回 `Result{code, success, message, data}`；参数均为 `@RequestParam`（urlencoded / query string）。

**用户 `/api/user`**：`POST /create/user/account` · `POST /login`（验证码校验） · `GET /select/me/follow` · `GET /select/me/fans` · `POST /follow` · `POST /unfollow`

**视频 `/api/video`**：`POST /upload/file` · `POST /upload` · `GET /select` · `GET /select/videos/upinfor` · `GET /select/video/single/infor` · `GET /select/like`（搜索） · `GET /select/path` · `GET /show/title` · `POST /edit/title` · `DELETE /delete/videos` · `POST /add/like` · `POST /cancel/like` · `GET /select/like/count` · `POST /add/view` · 评论：`GET /get/all/comments` · `POST /add/my/comments` · `POST /edit/my/comments` · `DELETE /delete/my/comments` · `GET /select/parent/comments`

**动态 `/api/dynamic`**：`GET /dynamic/select/all` · `POST /dynamic/write` · `POST /dynamic/edit` · `DELETE /dynamic/delete`

**私信 `/api/private_message`**：`POST /send` · `GET /select/message` · `GET /select/inbox` · `GET /count/unread` · `POST /read`

## ⚠️ 已知局限（学习项目取舍）

- 密码明文存储；登录态仅存于浏览器 localStorage，接口层未做会话鉴权，userId 由前端传入（可被伪造）——生产场景必须补 Session/Token 校验与密码哈希
- 播放量未做防刷去重，刷新页面会重复计数
- 列表接口大多无分页，数据量大时需补 LIMIT/OFFSET
- 私信发送失败后前端"先上屏"的乐观更新未做失败回滚
- 头像/横幅目前用首字母占位与默认图，未开放自定义上传

## 📄 License

个人学习项目。仅供交流学习使用。

---
Author: Jya Yijya (Tanmoku Kitaajya) · 2026
