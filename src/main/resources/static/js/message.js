/* 私信页
 * GET  /api/private_message/select/message?a=我&b=对方      双向完整对话（Result<List<PrivateMessage>>）
 * GET  /api/private_message/select/inbox?me=我              服务器会话列表：每个对话最后一句 + 未读数 + 对方昵称
 * GET  /api/private_message/count/unread?me=我              未读总数（Result<Map{count}>）
 * POST /api/private_message/read (me,other)                 打开对话时，把对方发给我的消息标记已读
 * POST /api/private_message/send (fromUser,toUser,contents) 发送（msgId 由后端生成，前端不传）
 * 会话列表以服务器 inbox 为准——消息都落在 private_message 表里，对方一进私信页就能看到；
 * localStorage 只做三件事：本地备注名、后端不可用时的兜底缓存、本地隐藏名单。
 */
(async function () {
    const me = YT.user();
    if (!me) {
        try { sessionStorage.setItem('yt_from', 'message.html'); } catch (e) { /* 忽略 */ }
        YT.toast('登录后即可使用私信');
        setTimeout(() => { location.href = 'login.html'; }, 600);
        return;
    }

    const $ = s => document.querySelector(s);
    const peersBox = $('#pm-peers'), msgs = $('#pm-msgs'), head = $('#pm-chat-head'), sideHead = $('#pm-side-head');
    const ta = $('#pm-content'), sendBtn = $('#pm-send');
    const picBtn = $('#pm-pic-btn'), videoBtn = $('#pm-video-btn');
    const picInput = $('#pm-pic-input'), videoInput = $('#pm-video-input');

    // ---------- 本地镜像：会话缓存（含备注名）+ 隐藏名单 ----------
    const peerKey = 'yt_pm_peers_' + me.userId;
    const hiddenKey = 'yt_pm_hidden_' + me.userId;
    const getPeers = () => JSON.parse(localStorage.getItem(peerKey) || '[]');
    const setPeers = arr => localStorage.setItem(peerKey, JSON.stringify(arr.slice(0, 100)));
    const getHidden = () => JSON.parse(localStorage.getItem(hiddenKey) || '[]');
    const setHidden = arr => localStorage.setItem(hiddenKey, JSON.stringify(arr));

    // 更新/新建一个会话项；lastMsg、unread 传 undefined 时保留旧值
    function touchPeer(userId, name, lastMsg, lastTime, unread) {
        const arr = getPeers();
        const i = arr.findIndex(p => p.userId === userId);
        const old = i >= 0 ? arr[i] : null;
        if (i >= 0) arr.splice(i, 1);
        arr.unshift({
            userId,
            name: name || (old && old.name) || '',
            lastMsg: lastMsg !== undefined ? String(lastMsg || '') : (old && old.lastMsg) || '',
            lastTime: lastTime || (old && old.lastTime) || '',
            unread: unread !== undefined ? Number(unread) || 0 : (old && old.unread) || 0,
        });
        setPeers(arr);
        setHidden(getHidden().filter(x => x !== userId));   // 会话有动静就解除隐藏
        renderPeers();
    }

    // ---------- 聊天状态 ----------
    let current = null;      // { userId, name }
    let loading = false;
    const WITHDRAW_LIMIT_S = 120;   // 可撤回时限（秒），与后端 withdraw 接口的 timeWithdraw 保持一致
    let curList = [];               // 当前打开的对话列表（撤回/删除操作以此为本地数据源重绘）

    // 与服务器 NOW() 同口径的本地时间串（MySQL DATETIME 格式，不用 toISOString 的 UTC）
    function localNow() {
        const d = new Date(), p = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    // 撤回时限到点后主动重绘一次，让"撤回"按钮自动消失（否则要等下一次数据变化才收掉）
    let withdrawRefreshTimer = null;
    function scheduleWithdrawRefresh(list) {
        if (withdrawRefreshTimer) { clearTimeout(withdrawRefreshTimer); withdrawRefreshTimer = null; }
        let next = Infinity;
        const now = Date.now();
        for (const m of list) {
            if (String(m.fromUser) !== me.userId || Number(m.isWithdrawn || 0) === 1) continue;
            const created = new Date(String(m.createTime).replace(' ', 'T')).getTime();
            if (isNaN(created)) continue;
            const end = created + WITHDRAW_LIMIT_S * 1000;
            if (end > now && end < next) next = end;
        }
        if (next === Infinity) return;
        withdrawRefreshTimer = setTimeout(() => {
            withdrawRefreshTimer = null;
            const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
            const keepTop = msgs.scrollTop;
            renderMsgs(curList);
            if (!atBottom) msgs.scrollTop = keepTop;   // 用户在翻历史时不抢滚动位置
        }, next - now + 500);
    }

    // ---------- 渲染 ----------
    function renderPeers() {
        const hidden = getHidden();
        const arr = getPeers().filter(p => !hidden.includes(p.userId));
        if (!arr.length) {
            peersBox.innerHTML = '<div class="pm-empty-peers">暂无会话<br>收到私信后会显示在这里</div>';
            return;
        }
        peersBox.innerHTML = arr.map(p => `
            <div class="pm-peer ${current && current.userId === p.userId ? 'active' : ''}" data-peer="${YT.esc(p.userId)}">
                <span class="avatar">${YT.esc((p.name || p.userId).slice(0, 1).toUpperCase())}</span>
                <div class="p-txt">
                    <div class="p-name">${YT.esc(p.name || p.userId)}</div>
                    <div class="p-sub">${YT.esc(p.lastMsg || '（无消息）')} · ${YT.timeAgo(p.lastTime)}</div>
                </div>
                ${p.unread > 0 ? `<span class="p-badge">${p.unread > 99 ? '99+' : p.unread}</span>` : ''}
                <button class="p-del" title="从列表隐藏（对方再发消息会重新出现）" data-remove="${YT.esc(p.userId)}">&#10005;</button>
            </div>`).join('');
    }

    function dayTag(t) {
        if (!t) return '';
        const d = new Date(String(t).replace(' ', 'T'));
        if (isNaN(d)) return '';
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return '';
        const y = new Date(today); y.setDate(y.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return '昨天';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // 单条消息渲染：
    // - 已撤回：双方都显示灰色提示气泡（正文后端已清空），我发的可继续"删除"
    // - 我发出的正常消息：悬停出现操作按钮——时限内可"撤回"（双方同步消失），"删除"仅从我这边消失
    function msgHtml(m) {
        const mine = String(m.fromUser) === me.userId;
        const withdrawn = Number(m.isWithdrawn || 0) === 1;
        const msgId = String(m.msgId || '');
        const time = YT.fmtFull(m.createTime);
        const who = mine ? '我' : (current ? (current.name || current.userId) : '');
        if (withdrawn) {
            return `
            <div class="pm-msg withdrawn ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                <div class="bubble">${mine ? '你撤回了一条消息' : '对方撤回了一条消息'}</div>
                ${mine ? `<div class="m-ops"><button class="m-op" data-del="${YT.esc(msgId)}" title="仅从我的记录中删除">删除</button></div>` : ''}
            </div>`;
        }
        let ops = '';
        if (mine) {
            const created = new Date(String(m.createTime).replace(' ', 'T')).getTime();
            const fresh = !isNaN(created) && (Date.now() - created) / 1000 <= WITHDRAW_LIMIT_S;
            ops = '<div class="m-ops">'
                + (fresh ? `<button class="m-op" data-withdraw="${YT.esc(msgId)}" title="${WITHDRAW_LIMIT_S} 秒内可撤回，双方记录同步消失">撤回</button>` : '')
                + `<button class="m-op" data-del="${YT.esc(msgId)}" title="单方面删除：仅从我这里消失，对方仍可见">删除</button>`
                + '</div>';
        }
        let bodyHtml;
        const mtype = String(m.msgType || 'text').toLowerCase();
        const mediaFile = String(m.mediaPath || '');
        if (mtype === 'image' && mediaFile) {
            bodyHtml = `<div class="bubble media"><img src="${YT.mediaUrl(mediaFile)}" alt="" loading="lazy"></div>`;
        } else if (mtype === 'video' && mediaFile) {
            bodyHtml = `<div class="bubble media"><video controls preload="metadata" playsinline src="${YT.mediaUrl(mediaFile)}"></video></div>`;
        } else {
            bodyHtml = `<div class="bubble">${YT.esc(m.contents)}</div>`;
        }
        return `
            <div class="pm-msg ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                ${bodyHtml}
                <span class="m-time">${YT.esc(who)} · ${YT.esc(time)}</span>
                ${ops}
            </div>`;
    }

    function renderMsgs(list) {
        curList = list;
        if (!list.length) {
            msgs.innerHTML = '<div class="empty">还没有消息，发第一条吧</div>';
            return;
        }
        let html = '', lastDay = '';
        for (const m of list) {
            const day = dayTag(m.createTime);
            if (day && day !== lastDay) { html += `<div class="pm-day">${day}</div>`; lastDay = day; }
            html += msgHtml(m);
        }
        msgs.innerHTML = html;
        msgs.scrollTop = msgs.scrollHeight;
        scheduleWithdrawRefresh(list);   // 有消息快到撤回时限就登记一次到期重绘
    }

    function renderHead() {
        if (!current) {
            head.textContent = '选择左侧会话开始聊天';
            return;
        }
        head.innerHTML = `
            <span class="avatar">${YT.esc((current.name || current.userId).slice(0, 1).toUpperCase())}</span>
            <b>${YT.esc(current.name || '对方')}</b>
            <span class="w-stats">ID: ${YT.esc(current.userId)}</span>`;
    }

    // 会话列表一行预览文字：撤回/图片/视频各有占位，文字取前 30 字
    function previewOf(m) {
        if (Number(m.isWithdrawn || 0) === 1) return '[已撤回]';
        const t = String(m.msgType || 'text').toLowerCase();
        if (t === 'image') return '[图片]';
        if (t === 'video') return '[视频]';
        return String(m.contents || '').slice(0, 30);
    }

    // ---------- 服务器数据 ----------
    // 收件箱：会话列表来自 private_message 表，不再依赖各自浏览器的 localStorage，
    // 所以"我发给对方的消息"在对方那一侧也能看到

    // ===== 静默轮询状态（1 秒）=====
    // 原则：只有数据"真的变了"才碰 DOM，没变化时一个字都不写，界面零动作。
    const POLL_MS = 1000;
    let pollTimer = null;
    let pollBusy = false;      // 单飞闸门：上一轮没结束就不发下一轮，避免请求堆积
    let lastInboxSig = '';     // 会话列表指纹
    let lastChatSig = '';      // 当前对话指纹
    let lastUnread = -1;       // 未读总数（-1 = 尚未取过，保证首次一定会写一次）

    // 会话列表指纹：只取影响展示的原始字段。
    // 刻意不用 timeAgo 的渲染结果，否则"刚刚 → 1 分钟前"会让指纹每秒都变、造成无谓重绘。
    function inboxSig(rows) {
        return rows.map(r => [
            YT.pick(r, 'peerId', 'peer_id'),
            YT.pick(r, 'unread'),
            YT.pick(r, 'lastTime', 'last_time'),
            YT.pick(r, 'lastMsg', 'last_msg'),
        ].join('|')).join(';');
    }

    // 当前对话指纹：条数 + 已撤回条数 + 最后一条标识。
    // 必须带上撤回计数：撤回不改变条数、也不改变最后一条 msgId，
    // 否则对方撤回后我这边指纹不变，1 秒轮询会认为"没变化"而不重绘。
    function chatSig(list) {
        const last = list[list.length - 1];
        let w = 0;
        for (const m of list) { if (Number(m.isWithdrawn || 0) === 1) w++; }
        return list.length + '|' + w + '|' + (last ? (last.msgId || last.createTime) : '');
    }

    // 用已取到的服务器会话数据做合并与渲染（首次加载与轮询共用，避免重复请求）
    function applyInboxRows(rows) {
        const server = rows.map(row => ({
            userId: String(YT.pick(row, 'peerId', 'peer_id') || ''),
            name: String(YT.pick(row, 'peerName', 'peer_name') || ''),
            lastMsg: String(YT.pick(row, 'lastMsg', 'last_msg') || '').slice(0, 30),
            lastTime: String(YT.pick(row, 'lastTime', 'last_time') || ''),
            unread: Number(YT.pick(row, 'unread') || 0),
        })).filter(p => p.userId);
        const local = getPeers();
        const merged = server.map(p => {
            const old = local.find(x => x.userId === p.userId);
            const note = old && old.name ? old.name : '';   // 本地备注名优先于对方昵称
            return { ...p, name: note || p.name };
        });
        // 本地刚手动打开、服务器上还没有消息的会话，保留在最前
        const extra = local.filter(x => !server.some(p => p.userId === x.userId));
        setPeers([...extra, ...merged]);
        // 有未读数的会话自动解除隐藏
        setHidden(getHidden().filter(id => !(merged.find(x => x.userId === id) || {}).unread));
        renderPeers();
    }

    async function loadInbox() {
        try {
            const r = await YT.api.get('/api/private_message/select/inbox', { me: me.userId });
            const rows = Array.isArray(r.data) ? r.data : [];
            lastInboxSig = inboxSig(rows);   // 记下基线，免得紧接着的轮询又重绘一次
            applyInboxRows(rows);
        } catch (e) {
            // 后端不可用时沿用本地缓存，不打断使用
            renderPeers();
        }
    }

    // 未读总数显示在左栏标题（数字没变就完全不碰 DOM）
    async function refreshUnread() {
        if (!sideHead) return;
        try {
            const r = await YT.api.get('/api/private_message/count/unread', { me: me.userId });
            const n = Number((r.data && r.data.count) || 0);
            if (n === lastUnread) return;      // 与上次一致 → 静默跳过
            lastUnread = n;
            sideHead.textContent = n > 0 ? `私信 · 未读 ${n}` : '私信';
        } catch (e) { /* 保持默认文案 */ }
    }

    // ---------- 数据 ----------
    async function openChat(userId, name) {
        if (!userId || userId.length !== 13) { YT.toast('用户ID应为13位'); return; }
        if (userId === me.userId) { YT.toast('不能和自己聊天'); return; }
        current = { userId, name: name || '' };
        renderHead();
        renderPeers();
        msgs.innerHTML = '<div class="empty">加载对话…</div>';
        loading = true;
        try {
            const r = await YT.api.get('/api/private_message/select/message', { a: me.userId, b: userId });
            const list = Array.isArray(r.data) ? r.data : [];
            lastChatSig = chatSig(list);   // 记下基线：轮询发现同样内容时不再重绘
            // 用最后一条消息 + 对方昵称回写镜像；刚打开视为已读，未读清零
            const last = list[list.length - 1];
            const lastPreview = last ? previewOf(last) : undefined;
            touchPeer(userId, name,
                lastPreview,
                last ? last.createTime : '', 0);
            renderMsgs(list);
            // 把对方发给我的消息标记已读（没有未读时 UPDATE 影响 0 行，无副作用）
            try { await YT.api.post('/api/private_message/read', { me: me.userId, other: userId }); } catch (e) { /* 忽略 */ }
            refreshUnread();
        } catch (e) {
            msgs.innerHTML = `<div class="empty">加载失败：${YT.esc(e.message)}</div>`;
        } finally {
            loading = false;
        }
    }

    async function doSend() {
        if (!current) { YT.toast('请先选择聊天对象'); return; }
        const content = ta.value.trim();
        if (!content) { YT.toast('消息不能为空'); return; }
        if (loading) return;
        sendBtn.disabled = true;
        // 置 loading 让轮询本轮让路：否则"服务器已落库、前端还没乐观上屏"这个窗口里，
        // 轮询会先渲染出真实消息，紧接着乐观上屏再追加一条 → 同一条消息重复显示
        loading = true;
        try {
            const r = await YT.api.post('/api/private_message/send', {
                fromUser: me.userId, toUser: current.userId, contents: content,
            });
            if (!r.success) { YT.toast(r.message || '发送失败'); return; }
            ta.value = '';
            const sentMsgId = String((r.data && r.data.msgId) || '');
            // 乐观上屏：带上真实 msgId 与时间，保证刚发出的消息能立即撤回/删除。
            // 必须用本地时间格式：toISOString() 是 UTC，与服务器时间差 8 小时，
            // 会让刚发出的消息被误判为"早已超出撤回时限"，撤回按钮永远不出现。
            const nowMsg = {
                msgId: sentMsgId, fromUser: me.userId, toUser: current.userId,
                contents: content, createTime: localNow(),
            };
            curList = [...curList, nowMsg];
            msgs.insertAdjacentHTML('beforeend', msgHtml(nowMsg));
            msgs.scrollTop = msgs.scrollHeight;
            scheduleWithdrawRefresh(curList);   // 刚发的这条 2 分钟后到期，登记收起撤回按钮
            touchPeer(current.userId, current.name, content.slice(0, 30), nowMsg.createTime);

            // 把 lastChatSig 对齐到"已乐观上屏"的内容，否则 1 秒后轮询发现指纹是旧的，
            // 会整块重绘，把"我 · 刚刚"换成真实时间戳——那就是一次可见的界面动作。
            try {
                const chk = await YT.api.get('/api/private_message/select/message', { a: me.userId, b: current.userId });
                const list = Array.isArray(chk.data) ? chk.data : [];
                const lastItem = list[list.length - 1];
                lastChatSig = chatSig(list);
                // 最后一条不是我刚发的那条 = 期间对方也发了消息，重绘以显示新内容
                if (list.length && !(sentMsgId && String(lastItem.msgId) === sentMsgId)) {
                    renderMsgs(list);
                    msgs.scrollTop = msgs.scrollHeight;
                }
            } catch (e) { /* 拉取失败就交给轮询兜底 */ }

            loadInbox();
        } catch (e) {
            YT.toast('发送失败：' + e.message);
        } finally {
            loading = false;
            sendBtn.disabled = false;
            ta.focus();
        }
    }

    // ---------- 发送图片 / 视频 ----------
    // 两步：① multipart 上传文件 → 后端落盘返回 {mediaPath,url}；
    //       ② 表单调 /send/picture/video 入库（msgType 由后端按扩展名推导，前端不传）。
    // 上传接口要发 FormData，YT.api 只会 urlencoded，所以 fetch 手写第一步。
    async function sendMedia(file) {
        if (!current) { YT.toast('请先选择聊天对象'); return; }
        if (loading) return;
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        const limitMb = isImage ? 20 : 100;
        if (file.size > limitMb * 1024 * 1024) { YT.toast(`文件超过 ${limitMb}MB 上限`); return; }

        loading = true;
        picBtn.disabled = true; videoBtn.disabled = true;
        try {
            // ① 上传文件本体
            const fd = new FormData();
            fd.append('file', file);
            const upRes = await fetch('/api/private_message/upload/media', { method: 'POST', body: fd });
            const up = await upRes.json();
            if (!up.success) { YT.toast(up.message || '上传失败'); return; }
            const mediaPath = String(up.data && up.data.mediaPath || '');
            if (!mediaPath) { YT.toast('上传异常：未拿到文件名'); return; }

            // ② 登记为一条私信消息
            const r = await YT.api.post('/api/private_message/send/picture/video', {
                fromUser: me.userId, toUser: current.userId, mediaPath,
            });
            if (!r.success) { YT.toast(r.message || '发送失败'); return; }

            // ③ 乐观上屏 + 会话预览（和文字发送同一套路，防止轮询抢先重绘重复显示）
            const sentMsgId = String((r.data && r.data.msgId) || '');
            const nowMsg = {
                msgId: sentMsgId, fromUser: me.userId, toUser: current.userId,
                contents: '', msgType: isImage ? 'image' : 'video',
                mediaPath, createTime: localNow(),
            };
            curList = [...curList, nowMsg];
            msgs.insertAdjacentHTML('beforeend', msgHtml(nowMsg));
            msgs.scrollTop = msgs.scrollHeight;
            scheduleWithdrawRefresh(curList);
            touchPeer(current.userId, current.name, previewOf(nowMsg), nowMsg.createTime);

            try {
                const chk = await YT.api.get('/api/private_message/select/message', { a: me.userId, b: current.userId });
                const list = Array.isArray(chk.data) ? chk.data : [];
                const lastItem = list[list.length - 1];
                lastChatSig = chatSig(list);
                if (list.length && !(sentMsgId && String(lastItem.msgId) === sentMsgId)) {
                    renderMsgs(list);
                    msgs.scrollTop = msgs.scrollHeight;
                }
            } catch (e) { /* 拉取失败就交给轮询兜底 */ }

            loadInbox();
        } catch (e) {
            YT.toast('发送失败：' + e.message);
        } finally {
            loading = false;
            picBtn.disabled = false; videoBtn.disabled = false;
            ta.focus();
        }
    }

    // ---------- 静默轮询（1 秒）----------
    // 用 setTimeout 链而非 setInterval：某轮请求慢于 1 秒时不会堆积并发请求。
    // 三道闸门共同保证"数据没变 → 界面零动作"：
    //   1) pollBusy 单飞：上一轮没跑完就跳过本轮
    //   2) 指纹比对：inbox/chat/unread 三者各自与上次一致时，完全不碰 DOM
    //   3) 页面不可见（切到后台标签）时整条链暂停，回前台再恢复
    async function pollOnce() {
        if (loading) return;                       // 正在打开对话/发消息，本轮让路，避免和 loading、乐观上屏打架
        const peerId = current ? current.userId : null;

        // 三个请求并行发；任一失败返回 null，不影响其余两个
        const [inboxR, unreadR, chatR] = await Promise.all([
            YT.api.get('/api/private_message/select/inbox', { me: me.userId }).catch(() => null),
            YT.api.get('/api/private_message/count/unread', { me: me.userId }).catch(() => null),
            peerId
                ? YT.api.get('/api/private_message/select/message', { a: me.userId, b: peerId }).catch(() => null)
                : Promise.resolve(null),
        ]);

        // --- 当前打开的对话：只有真来了新消息才重绘 ---
        let didMarkRead = false;
        if (chatR && peerId && current && current.userId === peerId) {
            const list = Array.isArray(chatR.data) ? chatR.data : [];
            const sig = chatSig(list);
            if (sig !== lastChatSig) {
                lastChatSig = sig;
                // 用户正在往上翻历史时不抢滚动条，只有贴着底部才跟随最新消息
                const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
                const keepTop = msgs.scrollTop;
                renderMsgs(list);
                if (!atBottom) msgs.scrollTop = keepTop;
                // 新消息属于"正在看"的会话，顺手标已读，免得未读数残留
                try { await YT.api.post('/api/private_message/read', { me: me.userId, other: peerId }); didMarkRead = true; } catch (e) { /* 忽略 */ }
            }
        }

        // --- 会话列表：指纹没变就一个 DOM 都不碰 ---
        if (inboxR) {
            const rows = Array.isArray(inboxR.data) ? inboxR.data : [];
            // 刚把当前会话标成已读，服务器这份快照还是旧的未读数，先就地归零再渲染，避免红点闪一下
            if (didMarkRead && peerId) {
                rows.forEach(r => { if (String(YT.pick(r, 'peerId', 'peer_id')) === peerId) r.unread = 0; });
            }
            const sig = inboxSig(rows);
            if (sig !== lastInboxSig) {
                lastInboxSig = sig;
                applyInboxRows(rows);
            }
        }

        // --- 未读总数：标过已读就重新取一次准确值，否则用本轮快照 ---
        if (didMarkRead) {
            refreshUnread();
        } else if (unreadR) {
            const n = Number((unreadR.data && unreadR.data.count) || 0);
            if (n !== lastUnread) {
                lastUnread = n;
                if (sideHead) sideHead.textContent = n > 0 ? `私信 · 未读 ${n}` : '私信';
            }
        }
    }

    function schedulePoll() {
        if (document.hidden) { pollTimer = null; return; }   // 后台不排下一轮，等 visibilitychange 恢复
        pollTimer = setTimeout(async () => {
            if (!pollBusy && !document.hidden) {
                pollBusy = true;
                try { await pollOnce(); }
                catch (e) { /* 单轮失败不中断轮询，下一轮继续 */ }
                finally { pollBusy = false; }
            }
            schedulePoll();
        }, POLL_MS);
    }

    // 切到后台标签停轮询；回到前台先补一次再恢复节奏
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
        } else if (!pollTimer) {
            pollOnce().catch(() => { /* 忽略 */ });
            schedulePoll();
        }
    });

    // ---------- 撤回 / 单方面删除 ----------
    // 撤回：仅我发出的、发送 WITHDRAW_LIMIT_S 秒内有效，成功后双方记录都变成"已撤回"提示。
    // 删除：仅从我这里消失（后端软删 from_deleted），对方仍能看到原文，所以不发撤回提示。
    // 两者都在请求成功后就地更新本地列表与 DOM，避免等 1 秒轮询造成闪动。
    async function doWithdraw(msgId, node) {
        if (loading) return;
        try {
            const r = await YT.api.post('/api/private_message/withdraw/private/message', {
                msgId, userId: me.userId, timeWithdraw: WITHDRAW_LIMIT_S,
            });
            if (!r.success) { YT.toast(r.message || '撤回失败'); return; }
            const m = curList.find(x => String(x.msgId) === msgId);
            if (m) m.isWithdrawn = 1;
            if (node && m) node.outerHTML = msgHtml({ ...m, contents: '' });
            lastChatSig = chatSig(curList);   // 本地已与服务器一致，对齐指纹免得轮询再重绘一次
            YT.toast(r.message || '已撤回');
            loadInbox();   // 会话列表预览要同步成"[已撤回]"
        } catch (e) {
            YT.toast('撤回失败：' + e.message);
        }
    }

    async function doDeleteFromMySide(msgId, node) {
        if (loading) return;
        try {
            const r = await YT.api.post('/api/private_message/delete/private/message', {
                msgId, userId: me.userId,
            });
            if (!r.success) { YT.toast(r.message || '删除失败'); return; }
            curList = curList.filter(x => String(x.msgId) !== msgId);
            if (node) node.remove();
            if (!curList.length) msgs.innerHTML = '<div class="empty">还没有消息，发第一条吧</div>';
            YT.toast(r.message || '已从我这边删除（对方仍可见）');
            loadInbox();   // 最后一条被删时，会话列表预览要换上一条
        } catch (e) {
            YT.toast('删除失败：' + e.message);
        }
    }

    msgs.addEventListener('click', e => {
        const w = e.target.closest('[data-withdraw]');
        if (w) { doWithdraw(w.dataset.withdraw, w.closest('.pm-msg')); return; }
        const d = e.target.closest('[data-del]');
        if (d) { doDeleteFromMySide(d.dataset.del, d.closest('.pm-msg')); }
    });

    // ---------- 事件 ----------
    ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    sendBtn.addEventListener('click', doSend);

    // 图片/视频：按钮只做"打开文件选择器"，真正发送在 change 里；
    // 每次选完把 value 清空，保证连续选同一个文件也能再次触发 change
    picBtn.addEventListener('click', () => { picInput.value = ''; picInput.click(); });
    videoBtn.addEventListener('click', () => { videoInput.value = ''; videoInput.click(); });
    picInput.addEventListener('change', () => { const f = picInput.files[0]; picInput.value = ''; if (f) sendMedia(f); });
    videoInput.addEventListener('change', () => { const f = videoInput.files[0]; videoInput.value = ''; if (f) sendMedia(f); });

    peersBox.addEventListener('click', e => {
        const rm = e.target.closest('[data-remove]');
        if (rm) {
            e.stopPropagation();
            const id = rm.dataset.remove;
            const arr = getHidden();
            if (!arr.includes(id)) { arr.push(id); setHidden(arr); }
            if (current && current.userId === id) { current = null; renderHead(); msgs.innerHTML = '<div class="empty">还没有打开任何对话</div>'; }
            renderPeers();
            return;
        }
        const row = e.target.closest('[data-peer]');
        if (row) {
            const p = getPeers().find(x => x.userId === row.dataset.peer);
            openChat(row.dataset.peer, p ? p.name : '');
        }
    });

    // 先用本地缓存秒开，再拉服务器收件箱对账
    renderPeers();
    // 串行启动：基线加载 → 打开跳转对话 → 启动轮询。
    // 顺序很关键：loadInbox/openChat 会写下 lastInboxSig、lastChatSig、lastUnread 基线，
    // 基线就位后再轮询，首轮就是纯比对，不会重复渲染或与首次加载抢请求。
    (async () => {
        await Promise.all([loadInbox(), refreshUnread()]);

        // 支持从播放页"发私信"跳转：message.html?peer=xxx&name=yyy
        const qs = new URLSearchParams(location.search);
        if (qs.get('peer')) {
            await openChat(qs.get('peer'), qs.get('name') || '');
        }

        schedulePoll();
    })();
})();
