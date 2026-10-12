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

    // ---------- 渲染 ----------
    function renderPeers() {
        const hidden = getHidden();
        const arr = getPeers().filter(p => !hidden.includes(p.userId));
        if (!arr.length) {
            peersBox.innerHTML = '<div class="pm-empty-peers">暂无会话<br>输入对方用户ID开始聊天</div>';
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

    function renderMsgs(list) {
        if (!list.length) {
            msgs.innerHTML = '<div class="empty">还没有消息，发第一条吧</div>';
            return;
        }
        let html = '', lastDay = '';
        for (const m of list) {
            const day = dayTag(m.createTime);
            if (day && day !== lastDay) { html += `<div class="pm-day">${day}</div>`; lastDay = day; }
            const mine = String(m.fromUser) === me.userId;
            html += `
            <div class="pm-msg ${mine ? 'me' : ''}">
                <div class="bubble">${YT.esc(m.contents)}</div>
                <span class="m-time">${YT.esc(mine ? '我' : (current.name || current.userId))} · ${YT.fmtFull(m.createTime)}</span>
            </div>`;
        }
        msgs.innerHTML = html;
        msgs.scrollTop = msgs.scrollHeight;
    }

    function renderHead() {
        if (!current) {
            head.textContent = '选择左侧会话，或输入对方用户ID开始聊天';
            return;
        }
        head.innerHTML = `
            <span class="avatar">${YT.esc((current.name || current.userId).slice(0, 1).toUpperCase())}</span>
            <b>${YT.esc(current.name || '对方')}</b>
            <span class="w-stats">ID: ${YT.esc(current.userId)}</span>`;
    }

    // ---------- 服务器数据 ----------
    // 收件箱：会话列表来自 private_message 表，不再依赖各自浏览器的 localStorage，
    // 所以"我发给对方的消息"在对方那一侧也能看到
    async function loadInbox() {
        try {
            const r = await YT.api.get('/api/private_message/select/inbox', { me: me.userId });
            const rows = Array.isArray(r.data) ? r.data : [];
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
        } catch (e) { /* 后端不可用时沿用本地缓存，不打断使用 */ }
        renderPeers();
    }

    // 未读总数显示在左栏标题
    async function refreshUnread() {
        if (!sideHead) return;
        try {
            const r = await YT.api.get('/api/private_message/count/unread', { me: me.userId });
            const n = Number((r.data && r.data.count) || 0);
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
            // 用最后一条消息 + 对方昵称回写镜像；刚打开视为已读，未读清零
            const last = list[list.length - 1];
            touchPeer(userId, name,
                last ? String(last.contents).slice(0, 30) : undefined,
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
        try {
            const r = await YT.api.post('/api/private_message/send', {
                fromUser: me.userId, toUser: current.userId, contents: content,
            });
            if (!r.success) { YT.toast(r.message || '发送失败'); return; }
            ta.value = '';
            // 本地先上屏（避免等一次刷新），再异步和服务器收件箱对账
            msgs.innerHTML += `
                <div class="pm-msg me">
                    <div class="bubble">${YT.esc(content)}</div>
                    <span class="m-time">我 · 刚刚</span>
                </div>`;
            msgs.scrollTop = msgs.scrollHeight;
            touchPeer(current.userId, current.name, content.slice(0, 30), new Date().toISOString().replace('T', ' ').slice(0, 19));
            loadInbox();
        } catch (e) {
            YT.toast('发送失败：' + e.message);
        } finally {
            sendBtn.disabled = false;
            ta.focus();
        }
    }

    // ---------- 事件 ----------
    $('#pm-open').addEventListener('click', () => {
        openChat($('#pm-peer-id').value.trim(), $('#pm-peer-name').value.trim());
    });
    $('#pm-peer-id').addEventListener('keydown', e => {
        if (e.key === 'Enter') $('#pm-open').click();
    });
    ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    sendBtn.addEventListener('click', doSend);

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
    loadInbox();
    refreshUnread();

    // 支持从播放页"发私信"跳转：message.html?peer=xxx&name=yyy
    const qs = new URLSearchParams(location.search);
    if (qs.get('peer')) {
        openChat(qs.get('peer'), qs.get('name') || '');
    }
})();
