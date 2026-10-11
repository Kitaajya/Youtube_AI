/* 私信页
 * GET  /api/private_message/select/message?a=我&b=对方   双向完整对话（Result<List<PrivateMessage>>）
 * POST /api/private_message/send  (fromUser,toUser,contents)  发送（msgId 由后端生成，前端不传）
 * 后端没有"我的会话列表"接口，peer 列表用 localStorage 镜像（与动态页同款套路）
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
    const peersBox = $('#pm-peers'), msgs = $('#pm-msgs'), head = $('#pm-chat-head');
    const ta = $('#pm-content'), sendBtn = $('#pm-send');

    // ---------- 会话镜像（localStorage）----------
    const peerKey = 'yt_pm_peers_' + me.userId;
    const getPeers = () => JSON.parse(localStorage.getItem(peerKey) || '[]');
    const setPeers = arr => localStorage.setItem(peerKey, JSON.stringify(arr.slice(0, 100)));

    function touchPeer(userId, name, lastMsg, lastTime) {
        const arr = getPeers();
        const i = arr.findIndex(p => p.userId === userId);
        if (i >= 0) arr.splice(i, 1);
        arr.unshift({ userId, name: name || '', lastMsg: lastMsg || '', lastTime: lastTime || '' });
        setPeers(arr);
        renderPeers();
    }

    // ---------- 聊天状态 ----------
    let current = null;      // { userId, name }
    let loading = false;

    // ---------- 渲染 ----------
    function renderPeers() {
        const arr = getPeers();
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
                <button class="p-del" title="从列表移除（不删除消息）" data-remove="${YT.esc(p.userId)}">&#10005;</button>
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
            // 用最后一条消息 + 对方昵称回写镜像
            const last = list[list.length - 1];
            touchPeer(userId, name, last ? String(last.contents).slice(0, 30) : '', last ? last.createTime : '');
            renderMsgs(list);
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
            // 本地先上屏（避免等一次刷新），再异步对账
            msgs.innerHTML += `
                <div class="pm-msg me">
                    <div class="bubble">${YT.esc(content)}</div>
                    <span class="m-time">我 · 刚刚</span>
                </div>`;
            msgs.scrollTop = msgs.scrollHeight;
            touchPeer(current.userId, current.name, content.slice(0, 30), new Date().toISOString().replace('T', ' ').slice(0, 19));
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
            const arr = getPeers().filter(p => p.userId !== rm.dataset.remove);
            setPeers(arr);
            if (current && current.userId === rm.dataset.remove) { current = null; renderHead(); msgs.innerHTML = '<div class="empty">还没有打开任何对话</div>'; }
            renderPeers();
            return;
        }
        const row = e.target.closest('[data-peer]');
        if (row) {
            const p = getPeers().find(x => x.userId === row.dataset.peer);
            openChat(row.dataset.peer, p ? p.name : '');
        }
    });

    renderPeers();

    // 支持从播放页"发私信"跳转：message.html?peer=xxx&name=yyy
    const qs = new URLSearchParams(location.search);
    if (qs.get('peer')) {
        openChat(qs.get('peer'), qs.get('name') || '');
    }
})();
