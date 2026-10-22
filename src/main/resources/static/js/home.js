/* 首页：视频流 + 搜索（游客模式：未登录也能浏览与搜索） */
(async function () {
    const u = YT.user();
    const welcome = document.getElementById('welcome');
    const feed = document.getElementById('feed');

    // 游客欢迎条：本次会话关闭后不再显示
    let welcomeClosed = false;
    try { welcomeClosed = sessionStorage.getItem('yt_welcome_closed') === '1'; } catch (e) { /* 隐私模式忽略 */ }
    if (u || welcomeClosed) {
        welcome.style.display = 'none';
    } else {
        welcome.style.display = 'block';
        document.getElementById('welcome-login').onclick = () => {
            try { sessionStorage.setItem('yt_from', YT.currentPath()); } catch (e) { /* 忽略 */ }
        };
        document.getElementById('welcome-close').onclick = () => {
            welcome.style.display = 'none';
            try { sessionStorage.setItem('yt_welcome_closed', '1'); } catch (e) { /* 忽略 */ }
        };
    }
    feed.style.display = 'block';

    const grid = document.getElementById('grid');
    const empty = document.getElementById('empty');
    const chips = document.getElementById('chips');
    const q = new URLSearchParams(location.search).get('q');

    function renderChips(cats) {
        chips.innerHTML = '';
        const lbl = document.createElement('span');
        lbl.className = 'chip-lbl';
        lbl.textContent = '热门标签（按标题关键词搜索）';
        chips.appendChild(lbl);
        ['全部视频', ...cats].forEach((c, i) => {
            const b = document.createElement('button');
            b.className = 'chip' + (i === 0 ? ' active' : '');
            b.textContent = c;
            b.onclick = () => {
                chips.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                load(c === '全部视频' ? null : c);
            };
            chips.appendChild(b);
        });
    }

    function card(v) {
        const id = YT.pick(v, 'id');
        const title = YT.pick(v, 'title');
        const up = YT.pick(v, 'uploader', 'user_id') || '未知UP主';
        const views = YT.pick(v, 'view_count');
        const time = YT.pick(v, 'create_time');
        return `
        <div class="card" onclick="location.href='watch.html?id=${encodeURIComponent(id)}'">
            ${YT.thumb(v)}
            <div class="meta">
                <span class="avatar" title="${YT.esc(YT.pick(v, 'uploader_avatar'))}">${YT.esc(String(up).slice(0, 1).toUpperCase())}</span>
                <div class="txt">
                    <div class="title">${YT.esc(title)}</div>
                    <div class="sub">${YT.esc(up)}</div>
                    <div class="sub">${YT.fmtNum(views)} 次观看 · ${YT.timeAgo(time)}</div>
                </div>
            </div>
        </div>`;
    }

    async function load(kw) {
        empty.style.display = 'none';
        grid.innerHTML = '<div class="empty">加载中…</div>';
        try {
            let res;
            if (kw) {
                res = await YT.api.get('/api/video/select/like', { keyword: kw });
            } else {
                res = await YT.api.get('/api/video/select/videos/upinfor');
            }
            const list = Array.isArray(res.data) ? res.data : [];
            if (!list.length) {
                grid.innerHTML = '';
                if (kw) {
                    empty.textContent = `没有找到与「${kw}」相关的视频`;
                } else {
                    empty.innerHTML = '<div class="start-card">'
                        + '<div class="sc-t">试试搜索，开始使用</div>'
                        + '<div class="sc-s">' + (u ? '观看视频，帮助我们为你推荐喜欢的内容。' : '登录后可点赞、评论和订阅。') + '</div></div>';
                }
                empty.style.display = 'block';
                return;
            }
            grid.innerHTML = list.map(card).join('');
        } catch (e) {
            grid.innerHTML = '';
            empty.textContent = '加载失败：' + e.message;
            empty.style.display = 'block';
        }
    }

    const cats = ['音乐', '游戏', '科技', '美食', '旅行','猎奇','恐怖','电影','军事','全球'];
    renderChips(cats);
    // 分类标签只是前端展示（后端无分类字段），点击分类按关键字搜索
    load(q || null);
})();


// =========================================================
// ====== AI 聊天窗逻辑（含数据库智能路由） ======
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('ai-toggle-btn');
    const closeBtn = document.getElementById('ai-close-btn');
    const panel = document.getElementById('ai-chat-panel');
    const container = document.getElementById('ai-chat-container');
    const input = document.getElementById('ai-question');
    const sendBtn = document.getElementById('ai-send-btn');

    if (!toggleBtn) return;

    const STORAGE_KEY = 'yt_ai_chat_history';

    // 🟢 1. 从 sessionStorage 加载历史记录
    function loadHistory() {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) {
                const history = JSON.parse(saved);
                // 清空默认的欢迎语
                container.innerHTML = '';
                history.forEach(msg => {
                    renderDOM(msg.role, msg.content);
                });
            }
        } catch (e) { console.warn('读取聊天记录失败', e); }
    }

    // 🔴 2. 将 DOM 里的消息保存到 sessionStorage
    function saveHistory() {
        try {
            const msgs = [];
            container.querySelectorAll('.ai-message').forEach(node => {
                const role = node.querySelector('.role').innerText;
                const content = node.querySelector('.content').innerText;
                // 忽略“思考中...”这种临时状态
                if (content !== '思考中...') {
                    msgs.push({ role, content });
                }
            });
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
        } catch (e) { console.warn('保存聊天记录失败', e); }
    }

    // 渲染单条消息 DOM
    function renderDOM(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message ${role === '你' ? 'user-msg' : 'ai-msg'}`;

        const roleDiv = document.createElement('div');
        roleDiv.className = 'role';
        roleDiv.innerText = role;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.innerText = text;

        msgDiv.appendChild(roleDiv);
        msgDiv.appendChild(contentDiv);
        container.appendChild(msgDiv);

        container.scrollTop = container.scrollHeight;
        return contentDiv;
    }

    // 初始化时加载历史
    loadHistory();

    // 开关面板
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) input.focus();
    });
    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    // 输入框自动撑高
    input.addEventListener('input', function() {
        this.style.height = '40px';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // 发送消息
    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    sendBtn.addEventListener('click', sendMessage);

    // 渲染消息 DOM
    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message ${role === '你' ? 'user-msg' : 'ai-msg'}`;

        const roleDiv = document.createElement('div');
        roleDiv.className = 'role';
        roleDiv.innerText = role;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.innerText = text;

        msgDiv.appendChild(roleDiv);
        msgDiv.appendChild(contentDiv);
        container.appendChild(msgDiv);

        container.scrollTop = container.scrollHeight;
        return contentDiv;
    }

    async function sendMessage() {
        const question = input.value.trim();
        if (!question) return;

        appendMessage('你', question);
        input.value = '';
        input.style.height = '40px';
        sendBtn.disabled = true;

        const aiContentDiv = appendMessage('AI', '思考中...');

        try {
            let apiUrl = '';

            // 🧠 智能路由：根据关键词决定调用哪个后端接口
            if (question.includes('用户') || question.includes('账号') || question.includes('注册') ||
                question.includes('电话') || question.includes('站长') || question.includes('密码')) {
                // 包含用户相关词，走查用户数据库接口
                apiUrl = `/api/deepseek/analyze/user?question=${encodeURIComponent(question)}`;
            } else if (question.includes('点赞') || question.includes('赞') || question.includes('评论')) {
                // 包含点赞相关词，走查点赞数据库接口
                apiUrl = `/api/deepseek/analyze/likes?question=${encodeURIComponent(question)}`;
            } else {
                // 否则走普通的流式聊天接口（比如问数学题、写代码等）
                apiUrl = `/api/deepseek/stream?question=${encodeURIComponent(question)}`;
            }

            // 发起流式请求
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('网络请求失败');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                if (isFirstChunk) {
                    aiContentDiv.innerText = ''; // 收到第一块数据，清除“思考中”
                    isFirstChunk = false;
                }
                aiContentDiv.innerText += chunk;
                container.scrollTop = container.scrollHeight;
            }
        } catch (error) {
            aiContentDiv.innerText = '哎呀，出错了：' + error.message;
        } finally {
            sendBtn.disabled = false;
            input.focus();
        }
    }
});