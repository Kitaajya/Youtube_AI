
***

# YouTube AI

[![CI](https://github.com/Kitaajya/Youtube_AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Kitaajya/Youtube_AI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A video community website built from scratch, featuring a separated frontend and backend architecture, deeply integrated with AI and high-concurrency design.

*This is a personal learning and practice project and is not affiliated with YouTube in any way.*

The project covers a complete set of modules including AI Q&A, video upload/playback/likes/comments, short video streams, dynamic social feeds, private messaging (including group chats), followers/following, playlists, notifications, and watch history. The frontend is a multi-page application using native HTML/CSS/JS, while the backend is built with Spring Boot + Spring AI + MyBatis + MySQL + Redis. DeepSeek configuration is included!

## 🖼️ Interface Preview

<h1>🐳 DeepSeek AI Assistant</h1>
<img width="100%" src="https://github.com/user-attachments/assets/3b2a585b-672f-434d-a1f8-f6b17af81ac3" alt="DeepSeek AI Style" />

<h1>🐳 DeepSeek Network Comment Police: Automatically screening and deleting violating comments</h1>
<h1>Showcasing Violating Comments</h1>
<img width="1295" height="522" alt="image" src="https://github.com/user-attachments/assets/8a6fccfd-bdc5-4af5-b488-131c839e80f1" />
<h1>DeepSeek Reviewing Comments</h1>
<img width="2349" height="727" alt="image" src="https://github.com/user-attachments/assets/97f4f932-6717-4b46-90b9-b5eff7dd58be" />
<h1>DeepSeek Deleting Comments</h1>
<img width="1302" height="389" alt="image" src="https://github.com/user-attachments/assets/72a73766-f3f3-451e-8f82-0f94708fa70f" />

<h1>🗄️ Database Intelligent Q&A (NL2SQL Logic)</h1>
<img width="100%" src="https://github.com/user-attachments/assets/42e08553-da93-4c71-aa2b-9bc41ab56d11" alt="DeepSeek after inserting into database" />

<h1>📝 Video Comment Section AI Summary</h1>
<img width="100%" src="https://github.com/user-attachments/assets/f141190c-842a-4c0c-b3e9-ff1931f84b14" alt="Video Comment Summary" />

<h1>🎬 Video Stream and Short Videos</h1>
<img width="100%" src="https://github.com/user-attachments/assets/afd8fc23-8f47-48fa-a5f5-ec7005e85e6c" alt="Normal Sample" />
<img width="100%" src="https://github.com/user-attachments/assets/a5bdeeed-8111-4477-adf8-ba6c3b3c8b3e" alt="Short Video Section" />

<h1>👤 Profile Page and Watch History</h1>
<img width="100%" src="https://github.com/user-attachments/assets/279127f0-8e3e-4bf3-9637-c5d4a206cae6" alt="Profile Page" />
<img width="100%" src="https://github.com/user-attachments/assets/523e6da2-513f-49fa-9899-a869aa71bb1c" alt="Watch History" />

## 📖 Table of Contents

- [✨ Features](#-features)
- [🛠 Tech Stack](#-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [🗄 Database Tables Overview](#-database-tables-overview)
- [📡 API Overview](#-api-overview)
- [🧠 Troubleshooting & Pitfalls Guide](#-troubleshooting--pitfalls-guide)
- [⚠️ Known Limitations](#️-known-limitations)

## ✨ Features

### 🤖 AI Intelligent Interaction Module (Core Highlight)
- **Fully Streaming AI Q&A**: The frontend uses `fetch` with `ReadableStream` and the backend uses `Flux` to achieve a typewriter-effect streaming dialogue, with handling for interruption and retry logic.
- **Intelligent Intent Routing**: Based on keywords in user queries (e.g., "emoji", "feed", "user", "like"), the frontend AI assistant automatically routes requests to different data analysis endpoints or standard chat endpoints.
- **Natural Language Database Querying (NL2SQL Logic)**: Converts user info, like records, feed comments, and emoji data into natural language context and inserts it into the Prompt.
- **AI Group Chat Summary & Q&A**: In group chats, if a user sends a specific command (e.g., containing "DeepSeek"), the AI automatically reads the chat history, summarizes the context, and answers as a group member (the frontend uses an `aiLock` state lock + temporary thinking bubbles to completely resolve infinite loops caused by streaming output).
- **One-Click Video Comment Summary**: The playback page provides an AI summary button to analyze all comments under a video and extract core viewpoints.

### 🛡️ Nickname Content Moderation & Auto-Cleansing (Security Module)
- **Admission Interception**: Uses an asynchronous "allow first, cleanse later" mechanism. When a new user registers, a background scheduled task (`ScheduledExecutorService`) checks if the nickname contains prohibited words from the `prohibit_words` table. If found, the original nickname is automatically reset to a 13-character random string (like a gift card code) from the source to prevent violating nicknames from polluting the live environment.
- **One-Click Full Cleansing**: The backend provides a `/api/user/clean/all/prohibited` endpoint, supporting a one-click full database scan of registered users to precisely locate violating nicknames and force reset them to random IDs.
- **Blacklist Pattern Matching**: The underlying system uses MySQL's `LIKE CONCAT('%', message, '%')` for multi-pattern matching, safely isolating violating content containing pornographic, violent, or other sensitive fields.

### 🎬 Video and Short Video Module
- **Real File Upload**: Multipart chunked receiving, supporting up to 1GB. The backend automatically uses `ffprobe` to detect duration and resolution, determining if it is a vertical short video (browser-side fallback duration detection resolves issues on servers without ffprobe).
- **In-Site Playback**: The server uses `WebMvcConfigurer` to map local directories as `/videos/**` static resources.
- **Short Video Stream (Shorts)**: Vertical sliding stream, automatically calculating heat (Views*0.3 + Likes*0.7), using `IntersectionObserver` for auto-play when entering the viewport and pause when sliding out.
- **Watch History**: Automatically records videos watched by the user, queried by time descending with pagination (max 200 records at a time).

### 🚀 High-Concurrency Like Module
- **MySQL as Primary, Redis as Secondary (Cache-Aside Pattern)**: Database records are the single source of truth. Redis Sets are used to intercept duplicate like requests, avoiding database write hot spots under high concurrency.
- **Cache Consistency Guarantee**: When unliking, the Redis count is directly reset to the latest database value, completely resolving cache and database inconsistency bugs (data resetting to zero after refresh).

### 💬 Private Messaging and Group Chat Module (Newly Upgraded)
- **One-on-One Private Messaging**: Complete loading of bidirectional conversations, supporting text, images, videos, and emoji sending.
- **Server-Side Inbox**: Uses MySQL 8 window functions to aggregate the last message + unread count for each conversation, so records aren't lost when switching devices.
- **Group Chat & Member Management**: Supports creating groups, inviting members, leaving groups, and viewing group member lists.
- **Smart Group Owner Transfer & Group Dissolution**: When the group owner leaves, the system automatically randomly transfers ownership (excluding AI_BOT) to an active member. If there are no active members left, it triggers a cascade delete (`ON DELETE CASCADE`), automatically dissolving the group and clearing all group messages and member records.
- **Message Recall & Soft Delete**: Supports recalling messages within 120 seconds and unilateral soft delete (the other party can still see it).

### 👥 Feed and Social
- Publish / Edit / Delete feeds. Feed comments support nested replies.
- Follow / Unfollow creators, view following lists and follower lists.
- YouTube-style channel page: Banner cover, centered avatar, Subscribe-style button, including four tabs: "Home / Videos / Playlists / Following & Followers".

### 🔔 Notification Module
- Actions like video likes, video comments, replies, comment likes, and follows will write to the `notification` table.
- Top bar bell button + unread red dot. Frontend uses 5-second long polling. The dropdown panel displays the notification list, and opening the panel marks them as read.

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **AI Engine** | Spring AI · Ollama / DeepSeek API (SSE Streaming Response) |
| Backend | Java 17 · Spring Boot 3.x · Spring MVC |
| **Cache Layer** | Redis (StringRedisTemplate for like interception and counting) |
| Persistence | MyBatis (Annotation SQL) · MySQL 8 (InnoDB / utf8mb4) |
| Frontend | Native HTML / CSS / JavaScript (Multi-page), Vite for dev proxy and build |
| Others | Lombok · Multipart File Storage · Caffeine (Local Cache) |

## 🚀 Quick Start

### Requirements
- JDK 17+
- Node.js 18+ (Frontend Vite dev server and build)
- MySQL 8.0+
- Redis (for the Like module)
- Spring AI supported model environment (e.g., local Ollama running deepseek-r1:8b / qwen2.5-coder, or configured API Key)

### 1. Initialize Database
Execute the scripts in the `sql/` directory in filename order to create the `youtube` database and all tables:

```bash
mysql -u root -p < sql/01_schema.sql        # Create tables
mysql -u root -p < sql/02_fix_collation.sql # Fix collation
```

### 2. Modify Configuration
Edit `backend/src/main/resources/application.properties`:

```properties
# Database Configuration
spring.datasource.url=jdbc:mysql://localhost:3306/youtube?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8
spring.datasource.username=YOUR_DB_USERNAME
spring.datasource.password=YOUR_DB_PASSWORD

# Redis Configuration
spring.data.redis.host=localhost
spring.data.redis.port=6379

# Video File Storage Directory (Needs to be created in advance)
video.storage.dir=D:/videos/Video_Bilibili_Practice/videos

# Spring AI Configuration (Example for local Ollama)
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.chat.model=deepseek-r1:8b
```

### 3. Launch (Separated Frontend & Backend)

The project has been split into `backend/` (Spring Boot API) and `frontend/` (Vite multi-page frontend), which need to be **started separately**.

**Method 1: One-Click Script (Recommended)**

Double-click `startYoutubeAI-分离版.bat` (Separated Version). The script will automatically check the environment, package the backend, start the frontend, and open two service windows.

> The old `startYoutubeAI.bat` has invalid internal paths due to the project split and is kept for reference only. Please use the separated version script instead.

**Method 2: Manual Start**

```bash
# Terminal 1 — Start Backend API (:8080)
cd backend
./mvnw spring-boot:run        # Use mvnw.cmd on Windows

# Terminal 2 — Start Frontend (:5173)
cd frontend
npm install                   # Only required for the first time
npm run dev
```

After starting, visit **http://localhost:5173** in your browser (Frontend pages) and register an account to experience all features.
The backend API runs separately on http://localhost:8080. The frontend uses a Vite proxy to forward `/api`, `/captcha`, `/checkCaptcha`, and `/videos` to the backend. From the browser's perspective, it's same-origin, requiring no CORS configuration.

**Production Build**

```bash
cd frontend
npm run build                 # Output goes to frontend/dist
```

`dist/` is a pure static directory. Hand it over to Nginx for hosting and reverse proxy the four paths mentioned above to the backend on port 8080 (same-origin deployment, no CORS needed). See `frontend/nginx.conf.example` for an Nginx reference configuration.

## 📁 Project Structure

```text
├── sql/                            # Database schema and fix scripts
├── LICENSE                         # Open Source License
├── README.md                       # Project Documentation
├── startYoutubeAI-分离版.bat        # One-click startup (Separated Version, Recommended)
│
├── backend/                        # Spring Boot Backend (API only, no built-in pages)
│   ├── pom.xml
│   ├── mvnw / mvnw.cmd / .mvn/     # Maven Wrapper
│   └── src/
│       ├── main/
│       │   ├── java/org/designer/youtube/
│       │   │   ├── YoutubeApplication.java   # Application entry
│       │   │   ├── RandomlyCreateID.java     # 13-char random business ID generator
│       │   │   ├── common/                   # Unified response Result
│       │   │   ├── config/                   # Video dir mapping (WebMvc), Caffeine cache, Async thread pool
│       │   │   ├── controller/               # Web Controller layer (split by business)
│       │   │   │   ├── UserInformationController.java  # User and Follow relations
│       │   │   │   ├── VideoController.java            # Video, Likes, Comments, Playlists, Notifications
│       │   │   │   ├── DynamicController.java          # Feed CRUD
│       │   │   │   ├── PrivateMessageController.java   # Private Messages, Group Chat, Emoji
│       │   │   │   ├── DeepSeekController.java         # AI Chat and Data Analysis routing
│       │   │   │   ├── CaptchaController.java          # Image Captcha generation and validation
│       │   │   │   └── RedisController.java            # Redis connectivity test
│       │   │   ├── entity/                   # Database entities (User, Video, PrivateMessage...)
│       │   │   ├── mapper/                   # MyBatis annotation SQL interfaces (No XML)
│       │   │   │   ├── UserInformationMapper.java      # User, Follow, Prohibited words
│       │   │   │   ├── VideoMapper.java                # Video, Comment, Like, Playlist, Notification, History
│       │   │   │   ├── DynamicMapper.java              # Feed and Comments
│       │   │   │   └── PrivateMessageMapper.java       # Private Message, Group Chat, Emoji
│       │   │   └── service/                  # Business Logic layer
│       │   │       ├── VideoService.java               # Video, High-concurrency Likes, AI moderation logic
│       │   │       ├── VideoFileService.java           # File storage, ffprobe detection, covers/PM media
│       │   │       ├── UserInformationService.java     # Register/Login, Prohibited word cleansing
│       │   │       ├── DynamicService.java             # Feed business
│       │   │       ├── PrivateMessageService.java      # PM/Group flow, Owner transfer/dissolution
│       │   │       └── DeepSeekTest.java               # Spring AI low-level call encapsulation
│       │   └── resources/
│       │       └── application.properties              # Global config (Database/Redis/AI/Video Path)
│       └── test/                                         # Test code
│
└── frontend/                       # Vite Frontend (Native HTML/CSS/JS Multi-page)
    ├── package.json                # Frontend dependencies and dev/build/preview scripts
    ├── vite.config.js              # Multi-page entries + Dev proxy (/api, /captcha, /checkCaptcha, /videos)
    ├── .env.development            # Backend address VITE_BACKEND (Proxy target)
    ├── nginx.conf.example          # Production deployment reference (Static hosting + Reverse proxy, same-origin)
    ├── src/
    │   └── vite-plugin-absolute-assets.js  # Build-time plugin: Rewrite relative asset references to absolute paths
    ├── public/                     # Static resources, hosted as-is at site root
    │   ├── css/                    # Stylesheets
    │   │   ├── vars.css            # Light theme variables
    │   │   ├── dark.css            # Dark mode overrides
    │   │   ├── style.css           # Global common styles (Top nav, player, comments)
    │   │   ├── channel.css         # Channel page styles
    │   │   ├── pm.css              # Private message/Group chat styles
    │   │   ├── register.css        # Login/Register page styles
    │   │   └── shorts.css          # Short video sliding stream styles
    │   ├── js/                     # Logic scripts (Global IIFE, load order: theme.js → common.js → page scripts)
    │   │   ├── common.js           # Global request wrapper, Nav/Sidebar rendering, Notification polling
    │   │   ├── theme.js            # Dark/Light theme toggle memory
    │   │   ├── home.js             # Homepage video stream rendering + Floating AI Assistant
    │   │   ├── watch.js            # Playback page, Nested comments, Likes, AI Summary
    │   │   ├── shorts.js           # Short video sliding, IntersectionObserver preloading
    │   │   ├── message.js          # Private message/Group chat, Polling, AI thinking bubble
    │   │   ├── profile.js          # Channel page, Playlists, Following & Followers
    │   │   ├── upload.js           # Chunked upload, Browser-side fallback duration detection
    │   │   ├── dynamic.js          # Feed publishing and local mirroring
    │   │   ├── history.js          # Watch history list
    │   │   ├── login.js            # Login and Captcha
    │   │   ├── register.js         # Register
    │   │   └── comment.js          # Comment component (Legacy)
    │   ├── emoji/                  # PM emoji images
    │   ├── images/                 # Page illustrations
    │   └── *.png                   # logo and other image assets
    └── *.html                      # Multi-page entries (Vite registers them as build entries one by one)
        ├── index.html              # Homepage (Video Stream)
        ├── watch.html              # Playback page
        ├── shorts.html             # Short video stream
        ├── message.html            # Private message & Group chat
        ├── profile.html            # Personal/Others' Channel page
        ├── dynamic.html            # Feed square
        ├── upload.html             # Video upload
        ├── history.html            # Watch history
        ├── login.html              # Login
        └── register.html           # Register
```

## 🗄 Database Tables Overview

| Table | Purpose | Key Design |
|---|---|---|
| `user_information` | Users | user_id 13-char random PK, username unique |
| `prohibit_words` | Prohibited Words | Stores pornographic, violent words for nickname/message interception |
| `video` | Videos | Auto-increment PK, includes `is_short`, `duration_sec`, `cover_path` |
| `video_like` | Video Likes | Composite PK (video_id, user_id) |
| `video_comment` | Video Comments | parent_id self-reference for nested replies |
| `comment_like` | Comment Likes | Composite PK (user_id, comment_id) |
| `dynamic` | Feeds | - |
| `content_comments` | Feed Comments | Independent from video comments |
| `private_message` | Private Messages | is_read flag + soft delete/recall flags |
| `chat_group` | Group Chats | Records group owner, creation time |
| `group_member` | Group Members | Links groups and users |
| `group_message` | Group Messages | Supports text/image/video/emoji |
| `subscription` | Follow Relations | Composite PK (fan_id, up_id) |
| `playlist` | Playlists | uk_playlist_name prevents duplicate names per user |
| `playlist_video` | Playlist Contents | Composite PK (playlist_id, video_id) |
| `notification` | Notifications | is_read flag + index optimization |
| `watch_history` | Watch History | Composite PK (user_id, video_id) |
| `emoji_item` | Emojis | Records emoji file paths and names |

## 📡 API Overview

> **Global Conventions:**
> 1. Unified response body is `Result{code, success, message, data}`.
> 2. Unless otherwise specified, all endpoints accept parameters via `@RequestParam`. The frontend submits directly using **Query String** (GET/DELETE) or **application/x-www-form-urlencoded** (POST).
> 3. File upload endpoints use `multipart/form-data`.
> 4. Endpoints marked as **(Streaming)** return `Flux<String>`. The frontend must use `ReadableStream` to handle the streaming output.

---

### 🤖 AI Chat & Intelligent Analysis `/api/deepseek`
*Deeply integrated with Spring AI, converting database content into context fed to the LLM (NL2SQL logic).*

| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| GET | `/stream` | `question` | Standard AI streaming Q&A (Typewriter effect) **(Streaming)** |
| GET | `/ask/deepseek` | `question` | Standard AI blocking Q&A |
| GET | `/analyze/likes` | `question` | Feed all site like records to AI for summary or querying **(Streaming)** |
| GET | `/analyze/user` | `question` | Feed all site user info to AI, supports conditional retrieval **(Streaming)** |
| GET | `/analyze/dynamic/comments` | `question` | Feed feed comments to AI for analysis **(Streaming)** |
| GET | `/analyze/private/message/emoji` | `question` | Feed emoji database to AI for querying **(Streaming)** |
| GET | `/analyze/video/comments` | `vid`, `question` | Extract all comments under a video and let AI summarize them **(Streaming)** |
| GET | `/analyze/private/message/member` | `groupId`, `question` | Feed group member info to AI for querying **(Streaming)** |

---

### 👤 User Module `/api/user`

| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| POST | `/create/user/account` | `username`, `password`, `nickname`, `email`, `phone` | Register account (Auto-generates 13-char userId) |
| POST | `/login` | `username`, `password`, `captcha` | Login (Mandatorily checks Captcha in Session) |
| GET | `/select/me/follow` | `me` | Query who I follow (Returns list) |
| GET | `/select/me/fans` | `me` | Query who follows me (Returns list) |
| POST | `/follow` | `me`, `upId` | Follow someone (Automatically intercepts duplicate follows) |
| POST | `/unfollow` | `me`, `upId` | Unfollow someone (Returns 0 rows if not followed, not an error) |
| GET | `/check/nickname` | `nickname`, `userId` | Pre-check if nickname contains prohibited words before reg/edit |
| POST | `/edit/nickname` | `newNickname`, `userId` | User actively modifies nickname |
| POST | `/edit/prohibited/nickname`| `userId` | Force cleanse a violating user's nickname (Reset to random ID) |
| GET | `/clean/all/prohibited` | None | **[Admin]** Full database scan and reset violating nicknames |

---

### 🎬 Video & Like Module `/api/video`

#### Video Upload & Query
| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| POST | `/upload/file` | `userId`, `title`, `file`(Multipart), `clientDurationSec`, `clientVertical` | **Preferred**: Real file upload to disk (Supports frontend duration fallback) |
| POST | `/upload` | `userId`, `title`, `videoPath` | Fallback: Just register a video path string on the server |
| GET | `/select/videos/upinfor` | None | Query all site videos (Joins UP nickname, avatar, like count) |
| GET | `/select/video/single/infor`| `id` | Query single video details by ID |
| GET | `/select/like` | `keyword` | Fuzzy search video title (Built-in Sleep anti-spam mechanism) |
| POST | `/edit/title` | `newTitle`, `id`, `userId` | Modify own video title |
| DELETE | `/delete/videos` | `id`, `userId` | Delete own video |
| POST | `/upload/cover` | `videoId`, `userId`, `file`(Multipart) | Upload/Change video cover |
| POST | `/check/video/title` | `videoId` | Independently trigger prohibited word check on video title |

#### Playback & Likes
| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| POST | `/add/view` | `id` | Video view count +1 (Returns the real view count after reading) |
| GET | `/select/like/count` | `id`, `userId` | Query video like count and whether current user liked it |
| POST | `/add/like` | `id`, `userId` | Like (MySQL as primary, Redis intercepts high-concurrency duplicate clicks) |
| POST | `/cancel/like` | `id`, `userId` | Unlike (Directly resets Redis count to latest MySQL value) |

#### Comments & Nested Replies
| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| GET | `/get/all/comments` | `videoId`, `userId`(opt) | Query all video comments (With like count and if current user liked) |
| POST | `/add/my/comments` | `commentId`, `videoId`, `userId`, `content`, `parentId`(opt) | Post comment (`parentId` value indicates nested reply) |
| POST | `/add/comment/like` | `me`, `commentId` | Like/Unlike a comment (Toggle logic) |
| DELETE | `/delete/my/comments` | `myUserId`, `videoId`, `commentId` | Delete own comment |
| POST | `/edit/my/comments` | `newContent`, `commentId`, `myUserId` | Edit own comment |

#### Others (History, Shorts, AI Moderation)
| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| GET | `/select/short` | `size`, `offset` | Get short video stream (Sorted by heat `views*0.3+likes*0.7`) |
| GET | `/select/history` | `userId` | Query watch history (Limit 200) |
| POST | `/insert/history` | `userId`, `videoId` | Insert watch history (`ON DUPLICATE KEY UPDATE` refreshes time) |
| POST | `/delete/auto/prohibited/comment` | `videoId` | Trigger DeepSeek silent review and auto-delete violating comments |

---

### 📁 Playlists & Notifications `/api/video`

| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| POST | `/create/like/format` | `pList`, `userId`, `name`, `description`, `isPublic` | Create new playlist |
| POST | `/add/to/like` | `pList`, `videoId` | Add video to playlist |
| GET | `/select/like/format` | `owner`, `viewer`, `videoId` | Query someone's playlists (With video count and if video is in it) |
| GET | `/select/like/format/videos`| `pList` | Query all videos in a playlist |
| POST | `/edit/like/format/public` | `pList`, `userId`, `isPublic` | Modify playlist public/private status |
| DELETE | `/remove/from/like` | `pList`, `videoId` | Remove a single video from playlist |
| DELETE | `/delete/like` | `pList`, `userId` | Delete entire playlist |
| GET | `/notify` | `me`, `size`, `offset` | Fetch notification list (likes, comments, follows, etc.) |
| POST | `/notify/read/all` | `me` | Mark all unread notifications sent to me as read |

---

### 💬 Private Messaging & Group Chat `/api/private_message`

#### Private Messaging Basics
| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| GET | `/select/message` | `a`, `b` | Load full bidirectional chat history between two users |
| GET | `/select/inbox` | `me` | Load inbox (Last message + unread count per conversation, Window function)|
| GET | `/count/unread` | `me` | Query total unread messages sent to me by others |
| POST | `/send` | `PrivateMessage` entity | Send text PM (`fromUser`, `toUser`, `contents`) |
| POST | `/upload/media` | `file`(Multipart) | Upload PM image/video to disk, returns `mediaPath` |
| POST | `/send/picture/video` | `PrivateMessage` entity | Send image/video PM (Carries `mediaPath` from previous step) |
| POST | `/send/emoji` | `PrivateMessage` entity | Send emoji PM (Carries `mediaPath`) |
| GET | `/emoji/list` | None | Get available emoji list |
| POST | `/withdraw/private/message` | `msgId`, `userId`, `timeWithdraw` | Recall PM (Frontend usually passes within 120s) |
| POST | `/delete/private/message` | `msgId`, `userId` | Unilateral soft delete PM (Does not affect the other party) |

#### Group Chats & AI Assistant
| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| POST | `/establish/group` | `groupName`, `ownerId` | Create group (Backend auto-generates `groupId`) |
| POST | `/add/member` | `groupId`, `userId`, `fromUser` | Invite member (Auto-sends notification to invitee) |
| POST | `/remove/member` | `groupId`, `userId`, `groupOwner` | Group owner kicks member |
| GET | `/select/my/groups` | `me` | Query groups I've joined |
| GET | `/select/group/message` | `groupId` | Query group chat history |
| POST | `/add/group/message` | `msgId`(opt), `groupId`, `fromUser`, `contents`, `msgType`, `mediaPath` | Send group message (Text/Image/Emoji) |
| POST | `/exit/group` | `groupId`, `userId` | Leave group (Owner leaving triggers random transfer or auto-dissolution) |
| GET | `/select/group/member` | `groupId` | Query group member list |
| GET | `/select/group/message/deepseek` | `question`, `groupId` | **Core AI**: DeepSeek reads group chat context and streams an answer **(Streaming)** |

---

### 🧩 Other Auxiliary Endpoints

| Method | Path | Params | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/dynamic/dynamic/select/all` | `id`, `content`, `createTime` | Exact match query for feeds |
| POST | `/api/dynamic/dynamic/write` | `content`, `id`, `userId` | Publish feed |
| DELETE | `/api/dynamic/dynamic/delete` | `id`, `createTime` | Delete feed |
| GET | `/captcha` | None | Generate 4-character image captcha (Stored in Session) |
| GET | `/checkCaptcha` | `inputCode` | Validate if captcha is correct |
| GET | `/api/redis/get` | None | Redis connectivity test |

---

### 💡 Core Response Example

**1. Video Like Successful (POST `/api/video/add/like`)**
```json
{
  "code": 200,
  "success": true,
  "message": "Liked successfully",
  "data": {
    "like_count": 128,
    "liked": true
  }
}
```

## 🧠 Troubleshooting & Pitfalls Guide

During development, we summarized a wealth of troubleshooting experience for complex full-stack scenarios (details in `Skill.txt`):
1. **AI Streaming Output Debounce**: Do not use characteristic text (like "Thinking...") as a state carrier. Use a `msgType='ai_thinking'` flag and filter it during rendering. The frontend must add an `aiLock` state lock to prevent polling and streaming requests from flooding the main thread.
2. **Exception Fallback**: If a click has no response, press `F12` and check Network for a screen full of red 500 errors. Spring AI's `.stream()` call must catch exceptions to prevent underlying 500 stack traces from being thrown directly to the frontend.
3. **Foreign Keys & Dirty Data**: When creating a group and inviting members, if the frontend silently swallows the backend `message`, it leads to "fake success". Errors should be explicitly exposed via `alert`, and the backend should use `@Transactional` to ensure consistency.
4. **SSE Endpoint 400 Troubleshooting**: Encountering `WebClientResponseException: 400 Bad Request` is highly likely due to the context fed to the AI being too long (`num_ctx` overflow), or the model not supporting Tool Calling.
5. **String Matching & Null Traps**: When writing the full database cleansing logic for prohibited words, be sure to prevent NullPointerExceptions from `Map.of()` caused by empty `nickname`. Also, the cleansing endpoint's `Controller` must perform exact matching on the `message` string returned by the `Service` (e.g., containing "has been reset"), otherwise "database modified but page stats still 0" false impressions will occur.

## 📄 License

This project is open-sourced under the [MIT License](LICENSE). You are free to use, modify, and distribute it, provided the copyright notice is retained.
