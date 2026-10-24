/* 私信页 + 群聊（前端兜底版）
 * 约束：后端代码不许动。
 * 由于后端无“发群消息”和“查询我的群”接口，群聊列表使用 localStorage，群聊输入框自动锁定。
 */

// 获取群聊已读时间戳
const getGroupReadTime = (groupId) => {
    return Number(localStorage.getItem('yt_group_read_' + me.userId + '_' + groupId) || 0);
};
// 更新群聊已读时间戳为当前时间
const setGroupReadTime = (groupId) => {
    localStorage.setItem('yt_group_read_' + me.userId + '_' + groupId, Date.now());
    // 已读后清除未读数
    localStorage.removeItem('yt_group_unread_' + me.userId + '_' + groupId);
};
// 获取群聊未读数
const getGroupUnread = (groupId) => {
    return Number(localStorage.getItem('yt_group_unread_' + me.userId + '_' + groupId) || 0);
};
// 设置群聊未读数
const setGroupUnread = (groupId, count) => {
    localStorage.setItem('yt_group_unread_' + me.userId + '_' + groupId, count);
};

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
    const emojiBtn = $('#pm-emoji-btn'), emojiPanel = $('#pm-emoji-panel');
    const groupsBox = $('#pm-groups'); // 建群后左侧显示群列表的容器

    // ---------- 本地镜像 ----------
    const peerKey = 'yt_pm_peers_' + me.userId;
    const hiddenKey = 'yt_pm_hidden_' + me.userId;
    const groupKey = 'yt_my_groups_' + me.userId;

    const getPeers = () => JSON.parse(localStorage.getItem(peerKey) || '[]');
    const setPeers = arr => localStorage.setItem(peerKey, JSON.stringify(arr.slice(0, 100)));
    const getHidden = () => JSON.parse(localStorage.getItem(hiddenKey) || '[]');
    const setHidden = arr => localStorage.setItem(hiddenKey, JSON.stringify(arr));
    const getMyGroups = () => JSON.parse(localStorage.getItem(groupKey) || '[]');
    const setMyGroups = arr => localStorage.setItem(groupKey, JSON.stringify(arr));

    // ---------- 聊天状态 ----------
    let current = null;       // 私聊状态 { userId, name }
    let currentGroup = null;  // 群聊状态 { groupId, groupName }
    let loading = false;
    const WITHDRAW_LIMIT_S = 120;
    let curList = [];

    function localNow() {
        const d = new Date(), p = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

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
        setHidden(getHidden().filter(x => x !== userId));
        renderPeers();
    }

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
            renderMsgs(curList, false); // 私聊的定时刷新
            if (!atBottom) msgs.scrollTop = keepTop;
        }, next - now + 500);
    }

    // ---------- 渲染 UI ----------
    function renderPeers() {
        const hidden = getHidden();
        const arr = getPeers().filter(p => !hidden.includes(p.userId));
        if (!arr.length) {
            peersBox.innerHTML = '<div class="pm-empty-peers">暂无私信会话<br>收到私信后会显示在这里</div>';
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
                <button class="p-del" title="从列表隐藏" data-remove="${YT.esc(p.userId)}">&#10005;</button>
            </div>`).join('');
    }

    function renderMyGroups() {
        if (!groupsBox) return;
        const arr = getMyGroups();
        if (!arr.length) {
            groupsBox.innerHTML = '';
            return;
        }
        groupsBox.innerHTML = arr.map(g => `
            <div class="pm-peer ${currentGroup && currentGroup.groupId === g.groupId ? 'active' : ''}" 
                 data-group="${YT.esc(g.groupId)}" data-gname="${YT.esc(g.groupName)}" style="border-left: 3px solid var(--link);">
                <span class="avatar" style="background:var(--link);color:#fff;border-radius:8px;">群</span>
                <div class="p-txt">
                    <div class="p-name">${YT.esc(g.groupName)}</div>
                    <div class="p-sub">群号: ${YT.esc(g.groupId)}</div>
                </div>
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

    function msgHtml(m, isGroup = false) {
        const mine = String(m.fromUser) === me.userId;
        const withdrawn = Number(m.isWithdrawn || 0) === 1;
        const msgId = String(m.msgId || '');
        const time = YT.fmtFull(m.createTime);
        const who = isGroup ? (m.senderName || '群友') : (mine ? '我' : (current ? (current.name || current.userId) : ''));

        if (withdrawn) {
            return `
            <div class="pm-msg withdrawn ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                <div class="bubble">${mine ? '你撤回了一条消息' : '对方撤回了一条消息'}</div>
                ${mine && !isGroup ? `<div class="m-ops"><button class="m-op" data-del="${YT.esc(msgId)}">删除</button></div>` : ''}
            </div>`;
        }

        let ops = '';
        if (mine && !isGroup) {
            const created = new Date(String(m.createTime).replace(' ', 'T')).getTime();
            const fresh = !isNaN(created) && (Date.now() - created) / 1000 <= WITHDRAW_LIMIT_S;
            ops = '<div class="m-ops">'
                + (fresh ? `<button class="m-op" data-withdraw="${YT.esc(msgId)}">撤回</button>` : '')
                + `<button class="m-op" data-del="${YT.esc(msgId)}">删除</button>`
                + '</div>';
        }
        let bodyHtml;
        const mtype = String(m.msgType || 'text').toLowerCase();
        const mediaFile = String(m.mediaPath || '');
        if (mtype === 'emoji' && mediaFile) {
            bodyHtml = `<div class="bubble emoji"><img src="${emojiSrc(mediaFile)}" alt="" loading="lazy"></div>`;
        } else if (mtype === 'image' && mediaFile) {
            bodyHtml = `<div class="bubble media"><img src="${YT.mediaUrl(mediaFile)}" alt="" loading="lazy"></div>`;
        } else if (mtype === 'video' && mediaFile) {
            bodyHtml = `<div class="bubble media"><video controls preload="metadata" playsinline src="${YT.mediaUrl(mediaFile)}"></video></div>`;
        } else {
            bodyHtml = `<div class="bubble">${YT.esc(m.contents)}</div>`;
        }

        // 撤回/删除操作
        let ops = '';
        if (mine && !isGroup && !withdrawn) {
            const created = new Date(String(m.createTime).replace(' ', 'T')).getTime();
            const fresh = !isNaN(created) && (Date.now() - created) / 1000 <= WITHDRAW_LIMIT_S;
            ops = '<div class="m-ops">'
                + (fresh ? `<button class="m-op" data-withdraw="${YT.esc(msgId)}">撤回</button>` : '')
                + `<button class="m-op" data-del="${YT.esc(msgId)}">删除</button>`
                + '</div>';
        }

        // ==========================================
        // 群聊样式（带头像和名字）
        // ==========================================
        if (isGroup) {
            const avatarHtml = `<div class="pm-group-avatar" onclick="location.href='profile.html?userId=${YT.esc(m.fromUser)}&name=${encodeURIComponent(who)}'" title="查看 ${YT.esc(who)} 的主页">
                <span class="avatar">${YT.esc(who.slice(0, 1).toUpperCase())}</span>
            </div>`;

            return `
            <div class="pm-group-msg-wrap ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                ${avatarHtml}
                <div class="pm-group-msg-body">
                    <span class="pm-group-name">${YT.esc(who)}</span>
                    <div class="pm-msg ${mine ? 'me' : ''}" style="align-self: auto;">
                        ${bodyHtml}
                        <span class="m-time">${YT.esc(time)}</span>
                    </div>
                </div>
            </div>`;
        }

        // ==========================================
        // 私聊样式（保持原样）
        // ==========================================
        if (withdrawn) {
            return `
            <div class="pm-msg withdrawn ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                <div class="bubble">${mine ? '你撤回了一条消息' : '对方撤回了一条消息'}</div>
                ${mine ? `<div class="m-ops"><button class="m-op" data-del="${YT.esc(msgId)}">删除</button></div>` : ''}
            </div>`;
        }

        return `
            <div class="pm-msg ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                ${bodyHtml}
                <span class="m-time">${YT.esc(who)} · ${YT.esc(time)}</span>
                ${ops}
            </div>`;
    }

    function emojiSrc(fileName) {
        return 'emoji/' + encodeURIComponent(String(fileName));
    }

    function renderMsgs(list, isGroup = false) {
        curList = list;
        if (!list.length) {
            msgs.innerHTML = '<div class="empty">还没有消息，发第一条吧</div>';
            return;
        }
        let html = '', lastDay = '';
        for (const m of list) {
            const day = dayTag(m.createTime);
            if (day && day !== lastDay) { html += `<div class="pm-day">${day}</div>`; lastDay = day; }
            html += msgHtml(m, isGroup);
        }
        msgs.innerHTML = html;
        msgs.scrollTop = msgs.scrollHeight;
        if (!isGroup) scheduleWithdrawRefresh(list);
    }

    function renderHead() {
        if (currentGroup) {
            head.innerHTML = `
                <span class="avatar" style="background:var(--link);color:#fff;border-radius:8px;">群</span>
                <b>${YT.esc(currentGroup.groupName)}</b>
                <span class="w-stats">群号: ${YT.esc(currentGroup.groupId)}</span>`;
            return;
        }
        if (!current) {
            head.textContent = '选择左侧会话开始聊天';
            return;
        }
        head.innerHTML = `
            <span class="avatar">${YT.esc((current.name || current.userId).slice(0, 1).toUpperCase())}</span>
            <b>${YT.esc(current.name || '对方')}</b>
            <span class="w-stats">ID: ${YT.esc(current.userId)}</span>`;
    }

    function previewOf(m) {
        if (Number(m.isWithdrawn || 0) === 1) return '[已撤回]';
        const t = String(m.msgType || 'text').toLowerCase();
        if (t === 'image') return '[图片]';
        if (t === 'video') return '[视频]';
        if (t === 'emoji') return '[表情]';
        return String(m.contents || '').slice(0, 30);
    }

    // ---------- 服务器通信与轮询 ----------
    const POLL_MS = 1000;
    let pollTimer = null, pollBusy = false;
    let lastInboxSig = '', lastChatSig = '', lastUnread = -1;

    function inboxSig(rows) {
        return rows.map(r => [
            YT.pick(r, 'peerId', 'peer_id'), YT.pick(r, 'unread'),
            YT.pick(r, 'lastTime', 'last_time'), YT.pick(r, 'lastMsg', 'last_msg'),
        ].join('|')).join(';');
    }

    function chatSig(list) {
        const last = list[list.length - 1];
        let w = 0;
        for (const m of list) { if (Number(m.isWithdrawn || 0) === 1) w++; }
        return list.length + '|' + w + '|' + (last ? (last.msgId || last.createTime) : '');
    }

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
            const note = old && old.name ? old.name : '';
            return { ...p, name: note || p.name };
        });
        const extra = local.filter(x => !server.some(p => p.userId === x.userId));
        setPeers([...extra, ...merged]);
        setHidden(getHidden().filter(id => {
            const p = merged.find(x => x.userId === id);
            return !(p && p.unread > 0);
        }));
        renderPeers();
    }

    async function loadInbox() {
        try {
            const r = await YT.api.get('/api/private_message/select/inbox', { me: me.userId });
            const rows = Array.isArray(r.data) ? r.data : [];
            lastInboxSig = inboxSig(rows);
            applyInboxRows(rows);
        } catch (e) { renderPeers(); }
    }

    async function refreshUnread() {
        if (!sideHead) return;
        try {
            const r = await YT.api.get('/api/private_message/count/unread', { me: me.userId });
            const n = Number((r.data && r.data.count) || 0);
            if (n === lastUnread) return;
            lastUnread = n;

            // 👇 修复：不要覆盖整个 innerHTML，而是只更新 span 标签的内容
            let titleSpan = sideHead.querySelector('span');
            if (titleSpan) {
                titleSpan.textContent = n > 0 ? `私信 · 未读 ${n}` : '私信';
            }
        } catch (e) { }
    }

    // ---------- 私聊逻辑 ----------
    async function openChat(userId, name) {
        if (!userId || userId.length !== 13) { YT.toast('用户ID应为13位'); return; }
        if (userId === me.userId) { YT.toast('不能和自己聊天'); return; }

        // 退出群聊状态，恢复私聊输入区
        currentGroup = null;
        ta.disabled = false;
        ta.placeholder = '写私信…（Enter 发送，Shift+Enter 换行）';
        sendBtn.disabled = false;
        emojiBtn.disabled = false;
        picBtn.disabled = false;
        videoBtn.disabled = false;

        current = { userId, name: name || '' };
        renderHead();
        renderPeers();
        renderMyGroups();

        msgs.innerHTML = '<div class="empty">加载对话…</div>';
        loading = true;
        try {
            const r = await YT.api.get('/api/private_message/select/message', { a: me.userId, b: userId });
            const list = Array.isArray(r.data) ? r.data : [];
            lastChatSig = chatSig(list);
            const last = list[list.length - 1];
            const lastPreview = last ? previewOf(last) : undefined;
            touchPeer(userId, name, lastPreview, last ? last.createTime : '', 0);
            renderMsgs(list, false);
            try { await YT.api.post('/api/private_message/read', { me: me.userId, other: userId }); } catch (e) { }
            refreshUnread();
        } catch (e) {
            msgs.innerHTML = `<div class="empty">加载失败：${YT.esc(e.message)}</div>`;
        } finally {
            loading = false;
        }
    }

    async function doSend() {
        // ==========================================
        //  群聊发送逻辑（分流处理）
        // ==========================================
        if (currentGroup) {
            const content = ta.value.trim();
            if (!content) { YT.toast('消息不能为空'); return; }
            if (loading) return;

            sendBtn.disabled = true;
            loading = true;
            try {
                // 调用你后端写好的群聊发送接口
                const r = await YT.api.post('/api/private_message/add/group/message', {
                    groupId: currentGroup.groupId,
                    fromUser: me.userId,
                    contents: content,
                    msgType: 'text'
                });

                if (!r.success) {
                    YT.toast(r.message || '发送失败');
                    return;
                }

                ta.value = '';
                const sentMsgId = String((r.data && r.data.msgId) || '');
                const nowMsg = {
                    msgId: sentMsgId,
                    fromUser: me.userId,
                    toUser: currentGroup.groupId,
                    contents: content,
                    msgType: 'text',
                    createTime: localNow(),
                    senderName: me.nickname
                };

                // 乐观上屏（立刻显示在屏幕上）
                curList = [...curList, nowMsg];
                msgs.insertAdjacentHTML('beforeend', msgHtml(nowMsg, true));
                msgs.scrollTop = msgs.scrollHeight;
                //自己发完消息也算已读
                setGroupReadTime(currentGroup.groupId);
                renderMyGroups();
            } catch (e) {
                YT.toast('发送失败：' + e.message);
            } finally {
                loading = false;
                sendBtn.disabled = false;
                ta.focus();
            }
            return; // 群聊发送完毕，拦截后续私聊逻辑
        }

        // ==========================================
        //   私聊发送逻辑（原本的代码）
        // ==========================================
        if (!current) { YT.toast('请先选择聊天对象'); return; }
        const content = ta.value.trim();
        if (!content) { YT.toast('消息不能为空'); return; }
        if (loading) return;
        sendBtn.disabled = true;
        loading = true;
        try {
            const r = await YT.api.post('/api/private_message/send', {
                fromUser: me.userId, toUser: current.userId, contents: content,
            });
            if (!r.success) { YT.toast(r.message || '发送失败'); return; }
            ta.value = '';
            const sentMsgId = String((r.data && r.data.msgId) || '');
            const nowMsg = {
                msgId: sentMsgId, fromUser: me.userId, toUser: current.userId,
                contents: content, createTime: localNow(),
            };
            curList = [...curList, nowMsg];
            msgs.insertAdjacentHTML('beforeend', msgHtml(nowMsg, false));
            msgs.scrollTop = msgs.scrollHeight;
            scheduleWithdrawRefresh(curList);
            touchPeer(current.userId, current.name, content.slice(0, 30), nowMsg.createTime);

            try {
                const chk = await YT.api.get('/api/private_message/select/message', { a: me.userId, b: current.userId });
                const list = Array.isArray(chk.data) ? chk.data : [];
                const lastItem = list[list.length - 1];
                lastChatSig = chatSig(list);
                if (list.length && !(sentMsgId && String(lastItem.msgId) === sentMsgId)) {
                    renderMsgs(list, false);
                    msgs.scrollTop = msgs.scrollHeight;
                }
            } catch (e) { }
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
    async function sendMedia(file) {
        if (currentGroup) return;
        if (!current) { YT.toast('请先选择聊天对象'); return; }
        if (loading) return;
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        const limitMb = isImage ? 20 : 100;
        if (file.size > limitMb * 1024 * 1024) { YT.toast(`文件超过 ${limitMb}MB 上限`); return; }

        loading = true;
        picBtn.disabled = true; videoBtn.disabled = true;
        try {
            const fd = new FormData();
            fd.append('file', file);
            const upRes = await fetch('/api/private_message/upload/media', { method: 'POST', body: fd });
            const up = await upRes.json();
            if (!up.success) { YT.toast(up.message || '上传失败'); return; }
            const mediaPath = String(up.data && up.data.mediaPath || '');
            if (!mediaPath) { YT.toast('上传异常：未拿到文件名'); return; }

            const r = await YT.api.post('/api/private_message/send/picture/video', {
                fromUser: me.userId, toUser: current.userId, mediaPath,
            });
            if (!r.success) { YT.toast(r.message || '发送失败'); return; }

            const sentMsgId = String((r.data && r.data.msgId) || '');
            const nowMsg = {
                msgId: sentMsgId, fromUser: me.userId, toUser: current.userId,
                contents: '', msgType: isImage ? 'image' : 'video',
                mediaPath, createTime: localNow(),
            };
            curList = [...curList, nowMsg];
            msgs.insertAdjacentHTML('beforeend', msgHtml(nowMsg, false));
            msgs.scrollTop = msgs.scrollHeight;
            scheduleWithdrawRefresh(curList);
            touchPeer(current.userId, current.name, previewOf(nowMsg), nowMsg.createTime);

            try {
                const chk = await YT.api.get('/api/private_message/select/message', { a: me.userId, b: current.userId });
                const list = Array.isArray(chk.data) ? chk.data : [];
                const lastItem = list[list.length - 1];
                lastChatSig = chatSig(list);
                if (list.length && !(sentMsgId && String(lastItem.msgId) === sentMsgId)) {
                    renderMsgs(list, false);
                    msgs.scrollTop = msgs.scrollHeight;
                }
            } catch (e) { }
            loadInbox();
        } catch (e) {
            YT.toast('发送失败：' + e.message);
        } finally {
            loading = false;
            picBtn.disabled = false; videoBtn.disabled = false;
            ta.focus();
        }
    }

    // ---------- 表情包 ----------
    let emojiCache = null;
    let emojiLoading = false;

    async function loadEmojiPanel() {
        if (emojiLoading) return;
        if (!emojiCache) {
            emojiLoading = true;
            try {
                const r = await YT.api.get('/api/private_message/emoji/list');
                emojiCache = Array.isArray(r.data) ? r.data : [];
            } catch (e) {
                emojiPanel.innerHTML = '<div class="pm-empty-emoji">表情加载失败，点击重试</div>';
                emojiLoading = false;
                return;
            }
            emojiLoading = false;
        }
        if (!emojiCache.length) {
            emojiPanel.innerHTML = '<div class="pm-empty-emoji">暂无可用表情</div>';
            return;
        }
        const cells = emojiCache
            .map(e => ({
                file: String(YT.pick(e, 'fileName', 'file_name') || ''),
                name: String(YT.pick(e, 'name') || ''),
            }))
            .filter(it => it.file)
            .map(it => `
            <button class="pm-emoji" data-emoji="${YT.esc(it.file)}" title="${YT.esc(it.name || it.file)}">
                <img src="${emojiSrc(it.file)}" alt="${YT.esc(it.name || it.file)}" loading="lazy">
            </button>`)
            .join('');
        emojiPanel.innerHTML = `<div class="pm-emoji-cells">${cells}</div>`;
    }

    function toggleEmojiPanel(forceHide) {
        if (currentGroup) return; // 群聊禁用
        const show = !forceHide && emojiPanel.hidden;
        emojiPanel.hidden = !show;
        emojiBtn.classList.toggle('on', show);
        if (show) loadEmojiPanel();
    }

    async function doSendEmoji(fileName) {
        if (currentGroup) return;
        if (!current) { YT.toast('请先选择聊天对象'); return; }
        if (loading) return;
        loading = true;
        emojiBtn.disabled = true;
        try {
            const r = await YT.api.post('/api/private_message/send/emoji', {
                fromUser: me.userId, toUser: current.userId, mediaPath: fileName,
            });
            if (!r.success) { YT.toast(r.message || '发送失败'); return; }

            toggleEmojiPanel(true);
            const sentMsgId = String((r.data && r.data.msgId) || '');
            const nowMsg = {
                msgId: sentMsgId, fromUser: me.userId, toUser: current.userId,
                contents: '', msgType: 'emoji', mediaPath: fileName, createTime: localNow(),
            };
            curList = [...curList, nowMsg];
            msgs.insertAdjacentHTML('beforeend', msgHtml(nowMsg, false));
            msgs.scrollTop = msgs.scrollHeight;
            scheduleWithdrawRefresh(curList);
            touchPeer(current.userId, current.name, previewOf(nowMsg), nowMsg.createTime);
            loadInbox();
        } catch (e) {
            YT.toast('发送失败：' + e.message);
        } finally {
            loading = false;
            emojiBtn.disabled = false;
            ta.focus();
        }
    }

    // ---------- 群聊逻辑 ----------
    async function openGroupChat(groupId, groupName) {
        // 退出私聊状态
        current = null;
        currentGroup = { groupId, groupName };
        
        //解锁输入区
        ta.disabled = false;
        ta.placeholder = '发送群消息…（Enter 发送）';
        sendBtn.disabled = false;
        emojiBtn.disabled = false;
        picBtn.disabled = false;
        videoBtn.disabled = false;

        toggleEmojiPanel(true); // 强制收起表情面板

        renderHead();
        renderPeers();
        renderMyGroups();

        msgs.innerHTML = '<div class="empty">加载群聊消息…</div>';
        try {
            const r = await YT.api.get('/api/private_message/select/group/message', { groupId });
            const list = Array.isArray(r.data) ? r.data : [];
            const normList = list.map(m => ({
                msgId: YT.pick(m, 'msg_id'),
                fromUser: YT.pick(m, 'from_user'),
                toUser: groupId,
                contents: YT.pick(m, 'contents'),
                msgType: YT.pick(m, 'msg_type') || 'text',
                mediaPath: YT.pick(m, 'media_path'),
                createTime: YT.pick(m, 'create_time'),
                senderName: YT.pick(m, 'senderName', 'sender_name')
            }));

            //进群了，标记为已读（把最新一条的时间存为已读时间）
            setGroupReadTime(groupId);
            renderMyGroups(); // 刷新左侧红点
            if (!normList.length) msgs.innerHTML = '';
            renderMsgs(normList, true);
        } catch (e) {
            msgs.innerHTML = `<div class="empty">群聊加载失败：${YT.esc(e.message)}</div>`;
        }
    }

    // ---------- 轮询 ----------
    async function pollOnce() {
        if (loading) return;
        if (currentGroup) return; // 群聊模式下跳过私信轮询

        const peerId = current ? current.userId : null;
        const [inboxR, unreadR, chatR] = await Promise.all([
            YT.api.get('/api/private_message/select/inbox', { me: me.userId }).catch(() => null),
            YT.api.get('/api/private_message/count/unread', { me: me.userId }).catch(() => null),
            peerId ? YT.api.get('/api/private_message/select/message', { a: me.userId, b: peerId }).catch(() => null) : Promise.resolve(null),
        ]);

        let didMarkRead = false;
        if (chatR && peerId && current && current.userId === peerId) {
            const list = Array.isArray(chatR.data) ? chatR.data : [];
            const sig = chatSig(list);
            if (sig !== lastChatSig) {
                lastChatSig = sig;
                const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
                const keepTop = msgs.scrollTop;
                renderMsgs(list, false);
                if (!atBottom) msgs.scrollTop = keepTop;
                try { await YT.api.post('/api/private_message/read', { me: me.userId, other: peerId }); didMarkRead = true; } catch (e) { }
            }
        }

        if (inboxR) {
            const rows = Array.isArray(inboxR.data) ? inboxR.data : [];
            if (didMarkRead && peerId) {
                rows.forEach(r => { if (String(YT.pick(r, 'peerId', 'peer_id')) === peerId) r.unread = 0; });
            }
            const sig = inboxSig(rows);
            if (sig !== lastInboxSig) {
                lastInboxSig = sig;
                applyInboxRows(rows);
            }
        }

        if (didMarkRead) {
            refreshUnread();
        } else if (unreadR) {
            const n = Number((unreadR.data && unreadR.data.count) || 0);
            if (n !== lastUnread) {
                lastUnread = n;
                // 👇 修复：这里千万别用 textContent，要用 querySelector 找 span
                if (sideHead) {
                    let titleSpan = sideHead.querySelector('span');
                    if (titleSpan) {
                        titleSpan.textContent = n > 0 ? `私信 · 未读 ${n}` : '私信';
                    }
                }
            }
        }
    }

    function schedulePoll() {
        if (document.hidden) { pollTimer = null; return; }
        pollTimer = setTimeout(async () => {
            if (!pollBusy && !document.hidden) {
                pollBusy = true;
                try { await pollOnce(); }
                catch (e) { }
                finally { pollBusy = false; }
            }
            schedulePoll();
        }, POLL_MS);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
        } else if (!pollTimer) {
            pollOnce().catch(() => { });
            schedulePoll();
        }
    });

    // ---------- 撤回 / 单方面删除 ----------
    async function doWithdraw(msgId, node) {
        if (loading) return;
        try {
            const r = await YT.api.post('/api/private_message/withdraw/private/message', {
                msgId, userId: me.userId, timeWithdraw: WITHDRAW_LIMIT_S,
            });
            if (!r.success) { YT.toast(r.message || '撤回失败'); return; }
            const m = curList.find(x => String(x.msgId) === msgId);
            if (m) m.isWithdrawn = 1;
            if (node && m) node.outerHTML = msgHtml({ ...m, contents: '' }, false);
            lastChatSig = chatSig(curList);
            YT.toast(r.message || '已撤回');
            loadInbox();
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
            loadInbox();
        } catch (e) {
            YT.toast('删除失败：' + e.message);
        }
    }

    // ---------- 事件绑定 ----------
    msgs.addEventListener('click', e => {
        const w = e.target.closest('[data-withdraw]');
        if (w) { doWithdraw(w.dataset.withdraw, w.closest('.pm-msg')); return; }
        const d = e.target.closest('[data-del]');
        if (d) { doDeleteFromMySide(d.dataset.del, d.closest('.pm-msg')); }
    });

    ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    sendBtn.addEventListener('click', doSend);

    picBtn.addEventListener('click', () => { if(currentGroup) return; picInput.value = ''; picInput.click(); });
    videoBtn.addEventListener('click', () => { if(currentGroup) return; videoInput.value = ''; videoInput.click(); });
    picInput.addEventListener('change', () => { const f = picInput.files[0]; picInput.value = ''; if (f) sendMedia(f); });
    videoInput.addEventListener('change', () => { const f = videoInput.files[0]; videoInput.value = ''; if (f) sendMedia(f); });

    emojiBtn.addEventListener('click', () => { if(currentGroup) return; toggleEmojiPanel(); });
    emojiPanel.addEventListener('click', e => {
        if (e.target.closest('.pm-empty-emoji')) { loadEmojiPanel(); return; }
        const cell = e.target.closest('[data-emoji]');
        if (cell) doSendEmoji(cell.dataset.emoji);
    });
    document.addEventListener('click', e => {
        if (emojiPanel.hidden) return;
        if (!emojiPanel.contains(e.target) && !emojiBtn.contains(e.target)) toggleEmojiPanel(true);
    });

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

    if (groupsBox) {
        groupsBox.addEventListener('click', e => {
            const row = e.target.closest('[data-group]');
            if (row) openGroupChat(row.dataset.group, row.dataset.gname);
        });
    }

    // ---------- 建群弹窗 ----------
    (function initGroupChat() {
        document.addEventListener('DOMContentLoaded', () => {
            const btnOpen = document.getElementById('btn-create-group');
            const modal = document.getElementById('group-modal');
            const btnCancel = document.getElementById('cancel-group');
            const btnSubmit = document.getElementById('submit-group');

            if (!btnOpen || !modal) return;

            btnOpen.addEventListener('click', () => { modal.style.display = 'flex'; });
            btnCancel.addEventListener('click', () => { modal.style.display = 'none'; });

            btnSubmit.addEventListener('click', async () => {
                const groupNameInput = document.getElementById('new-group-name');
                const membersInput = document.getElementById('new-group-members');
                const groupName = groupNameInput.value.trim();
                const raw = membersInput.value.split(',').map(s => s.trim()).filter(Boolean);

                if (!groupName) return YT.toast('请输入群名称');
                if (raw.length < 2) return YT.toast('至少需要拉 2 个好友才能建群');

                const ids = [...new Set(raw)].filter(id => {
                    if (id.length !== 13) { YT.toast(`用户ID「${id}」应为13位`); return false; }
                    if (id === me.userId) { YT.toast('不能把自己作为成员填入'); return false; }
                    return true;
                });
                if (ids.length < 2) return YT.toast('有效成员不足 2 人');

                btnSubmit.disabled = true;
                btnSubmit.innerText = '创建中...';

                const groupId = YT.randId();
                let groupCreated = false;
                const addedMembers = [];

                try {
                    const r1 = await YT.api.post('/api/private_message/establish/group', {
                        groupId, groupName, ownerId: me.userId
                    });
                    if (!r1.success) throw new Error(r1.message || '建群失败');
                    groupCreated = true;

                    for (let uid of ids) {
                        const r2 = await YT.api.post('/api/private_message/add/member', { groupId, userId: uid });
                        if (r2.success) addedMembers.push(uid);
                    }

                    if (addedMembers.length < 2) throw new Error('有效拉入人数不足 2 人');

                    const groups = getMyGroups();
                    groups.unshift({ groupId, groupName, createTime: localNow() });
                    setMyGroups(groups);
                    renderMyGroups();

                    YT.toast('建群成功！');
                    modal.style.display = 'none';
                    groupNameInput.value = '';
                    membersInput.value = '';
                } catch (err) {
                    YT.toast('建群失败：' + err.message);
                    if (groupCreated) console.warn('群已建但未满人，群号：', groupId);
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.innerText = '创建';
                }
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        });
    })();

    // ---------- 群聊辅助函数（请确保放在文件靠前的位置，和 getMyGroups 放一起） ----------
    const getGroupReadTime = (groupId) => Number(localStorage.getItem('yt_group_read_' + me.userId + '_' + groupId) || 0);
    const setGroupReadTime = (groupId) => {
        localStorage.setItem('yt_group_read_' + me.userId + '_' + groupId, Date.now());
        localStorage.removeItem('yt_group_unread_' + me.userId + '_' + groupId);
    };
    const getGroupUnread = (groupId) => Number(localStorage.getItem('yt_group_unread_' + me.userId + '_' + groupId) || 0);
    const setGroupUnread = (groupId, count) => {
        localStorage.setItem('yt_group_unread_' + me.userId + '_' + groupId, count);
    };

    // ---------- 群聊新消息静默检测 ----------
    let groupPollTimer = null;
    async function pollGroupUnread() {
        if (document.hidden || !me) return;

        const myGroups = getMyGroups();
        if (!myGroups.length) return;

        let hasNewUnread = false;
        let newMsgSender = '';

        // 注意：为了减少请求，这里按顺序拉取，实际项目建议改成 Promise.all
        for (const g of myGroups) {
            try {
                const r = await YT.api.get('/api/private_message/select/group/message', { groupId: g.groupId });
                const list = Array.isArray(r.data) ? r.data : [];
                if (!list.length) continue;

                const lastMsg = list[list.length - 1];
                if (String(lastMsg.from_user) !== me.userId) {
                    const lastMsgTime = new Date(String(YT.pick(lastMsg, 'create_time')).replace(' ', 'T')).getTime();
                    const readTime = getGroupReadTime(g.groupId);

                    if (lastMsgTime > readTime) {
                        // 如果当前正好打开的是这个群，直接自动已读，不提示
                        if (currentGroup && currentGroup.groupId === g.groupId) {
                            setGroupReadTime(g.groupId);
                        } else {
                            setGroupUnread(g.groupId, 1); // 为了简单，这里未读数固定设为 1
                            hasNewUnread = true;
                            newMsgSender = YT.pick(lastMsg, 'senderName', 'sender_name') || '有人';
                        }
                    }
                }
            } catch (e) { /* 忽略单个群的请求失败 */ }
        }

        if (hasNewUnread) {
            renderMyGroups(); // 刷新左侧红点
            YT.toast(`群聊有新消息：${newMsgSender} 发来一条消息`);
        }
    }

    function scheduleGroupPoll() {
        if (groupPollTimer) clearInterval(groupPollTimer);
        groupPollTimer = setInterval(() => {
            if (!document.hidden) pollGroupUnread();
        }, 5000);
    }

    // ---------- 启动 ----------
    renderPeers();
    renderMyGroups();

    (async () => {
        await Promise.all([loadInbox(), refreshUnread()]);
        const qs = new URLSearchParams(location.search);
        if (qs.get('peer')) {
            await openChat(qs.get('peer'), qs.get('name') || '');
        }
        schedulePoll();
    })();
})();