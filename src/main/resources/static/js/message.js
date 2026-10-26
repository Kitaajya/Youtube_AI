/* 私信页 + 群聊（可直接覆盖版本） */
(async function () {
    const me = YT.user();
    if (!me) {
        try { sessionStorage.setItem('yt_from', 'message.html'); } catch (e) {}
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
    const groupsBox = $('#pm-groups');

    // ---------- 本地镜像 ----------
    const peerKey = 'yt_pm_peers_' + me.userId;
    const hiddenKey = 'yt_pm_hidden_' + me.userId;
    //const groupKey = 'yt_my_groups_' + me.userId;
    //const groupIdsKey = 'yt_my_group_ids_' + me.userId;
//
    const getPeers = () => {
        try { return JSON.parse(localStorage.getItem(peerKey) || '[]'); } catch { return []; }
    };
    const setPeers = arr => localStorage.setItem(peerKey, JSON.stringify(arr.slice(0, 100)));
    const getHidden = () => {
        try { return JSON.parse(localStorage.getItem(hiddenKey) || '[]'); } catch { return []; }
    };
    const setHidden = arr => localStorage.setItem(hiddenKey, JSON.stringify(arr));
    // 只保留这几个缓存键
    const groupKey = 'yt_my_groups_' + me.userId;
    const groupIdsKey = 'yt_my_group_ids_' + me.userId;

    const getMyGroups = () => {
        try { return JSON.parse(localStorage.getItem(groupKey) || '[]'); } catch { return []; }
    };
    const setMyGroups = arr => localStorage.setItem(groupKey, JSON.stringify(arr));
    const getStoredGroupIds = () => {
        try { return JSON.parse(localStorage.getItem(groupIdsKey) || '[]'); } catch { return []; }
    };
    const setStoredGroupIds = ids => localStorage.setItem(groupIdsKey, JSON.stringify(ids));
    // ---------- 群聊辅助函数 ----------
    const getGroupReadTime = (groupId) => Number(localStorage.getItem('yt_group_read_' + me.userId + '_' + groupId) || 0);
    const setGroupReadTime = (groupId) => {
        localStorage.setItem('yt_group_read_' + me.userId + '_' + groupId, Date.now());
        localStorage.removeItem('yt_group_unread_' + me.userId + '_' + groupId);
    };
    const getGroupUnread = (groupId) => Number(localStorage.getItem('yt_group_unread_' + me.userId + '_' + groupId) || 0);
    const setGroupUnread = (groupId, count) => {
        localStorage.setItem('yt_group_unread_' + me.userId + '_' + groupId, count);
    };

    // ---------- 聊天状态 ----------
    let current = null;
    let currentGroup = null;
    let loading = false;
    let aiLock = false;
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
            renderMsgs(curList, false);
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
        groupsBox.innerHTML = arr.map(g => {
            const unreadCount = getGroupUnread(g.groupId);
            return `
            <div class="pm-peer ${currentGroup && currentGroup.groupId === g.groupId ? 'active' : ''}" 
                 data-group="${YT.esc(g.groupId)}" data-gname="${YT.esc(g.groupName)}" style="border-left: 3px solid var(--link);">
                <span class="avatar" style="background:var(--link);color:#fff;border-radius:8px;">群</span>
                <div class="p-txt">
                    <div class="p-name">${YT.esc(g.groupName)}</div>
                    <div class="p-sub">群号: ${YT.esc(g.groupId)}</div>
                </div>
                ${unreadCount > 0 ? `<span class="p-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
            </div>`;
        }).join('');
    }

    function emojiSrc(fileName) {
        return 'emoji/' + encodeURIComponent(String(fileName));
    }

    function msgHtml(m, isGroup = false) {
        if (String(m.contents || '').includes('正在阅读群聊并思考')) return '';

        const mine = String(m.fromUser) === me.userId;
        const withdrawn = Number(m.isWithdrawn || 0) === 1;
        const msgId = String(m.msgId || '');
        const time = YT.fmtFull(m.createTime);
        const who = isGroup ? (m.senderName || '群友') : (mine ? '我' : (current ? (current.name || current.userId) : ''));

        let bodyHtml;
        const mtype = String(m.msgType || 'text').toLowerCase();
        const mediaFile = String(m.mediaPath || '');
        if (withdrawn) {
            bodyHtml = `<div class="bubble">${mine ? '你撤回了一条消息' : '对方撤回了一条消息'}</div>`;
        } else if (mtype === 'emoji' && mediaFile) {
            bodyHtml = `<div class="bubble emoji"><img src="${emojiSrc(mediaFile)}" alt="" loading="lazy"></div>`;
        } else if (mtype === 'image' && mediaFile) {
            bodyHtml = `<div class="bubble media"><img src="${YT.mediaUrl(mediaFile)}" alt="" loading="lazy"></div>`;
        } else if (mtype === 'video' && mediaFile) {
            bodyHtml = `<div class="bubble media"><video controls preload="metadata" playsinline src="${YT.mediaUrl(mediaFile)}"></video></div>`;
        } else {
            bodyHtml = `<div class="bubble">${YT.esc(String(m.contents || ''))}</div>`;
        }

        let ops = '';
        if (mine && !isGroup && !withdrawn) {
            const created = new Date(String(m.createTime).replace(' ', 'T')).getTime();
            const fresh = !isNaN(created) && (Date.now() - created) / 1000 <= WITHDRAW_LIMIT_S;
            ops = '<div class="m-ops">'
                + (fresh ? `<button class="m-op" data-withdraw="${YT.esc(msgId)}">撤回</button>` : '')
                + `<button class="m-op" data-del="${YT.esc(msgId)}">删除</button>`
                + '</div>';
        }

        if (isGroup) {
            const avatarHtml = `<div class="pm-group-avatar" onclick="location.href='profile.html?userId=${YT.esc(m.fromUser)}&name=${encodeURIComponent(who)}'" title="查看 ${YT.esc(who)} 的资料">
                <span class="avatar">${YT.esc(who.slice(0, 1).toUpperCase())}</span>
            </div>`;
            return `
            <div class="pm-group-msg-wrap ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                ${avatarHtml}
                <div class="pm-group-msg-body">
                    <span class="pm-group-name">${YT.esc(who)}</span>
                    <div class="pm-msg ${mine ? 'me' : ''}">
                        ${bodyHtml}
                    </div>
                </div>
            </div>`;
        }

        return `
            <div class="pm-msg ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                ${bodyHtml}
                <span class="m-time">${YT.esc(who)} · ${YT.esc(time)}</span>
                ${ops}
            </div>`;
    }

    function renderMsgs(list, isGroup = false) {
        curList = list;
        if (!list.length) {
            msgs.innerHTML = '<div class="empty">还没有消息，发第一条吧</div>';
            return;
        }
        let html = '', lastMsgTime = 0;
        for (const m of list) {
            let currentMsgTime = new Date(String(m.createTime || '').replace(' ', 'T')).getTime();
            if (isNaN(currentMsgTime)) currentMsgTime = Date.now();

            if (lastMsgTime === 0 || (currentMsgTime - lastMsgTime) > 5 * 60 * 1000) {
                const d = new Date(currentMsgTime);
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                html += `<div class="pm-day">${timeStr}</div>`;
            }
            html += msgHtml(m, isGroup);
            lastMsgTime = currentMsgTime;
        }
        msgs.innerHTML = html;
        msgs.scrollTop = msgs.scrollHeight;
        if (!isGroup) scheduleWithdrawRefresh(list);
    }

    function appendMsgs(newMsgs, isGroup = false) {
        if (!newMsgs || !newMsgs.length) return;
        let html = '';
        for (const m of newMsgs) {
            html += msgHtml(m, isGroup);
        }
        msgs.insertAdjacentHTML('beforeend', html);
        msgs.scrollTop = msgs.scrollHeight;
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
    let lastGroupChatSig = '';

    function inboxSig(rows) {
        return rows.map(r => [
            YT.pick(r, 'peerId', 'peer_id'), YT.pick(r, 'unread'),
            YT.pick(r, 'lastTime', 'last_time'), YT.pick(r, 'lastMsg', 'last_msg'),
        ].join('|')).join(';');
    }

    function chatSig(list) {
        const last = list[list.length - 1];
        return list.length + '|' + (last ? (last.msgId || last.createTime) : '');
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

    async function syncMyGroups() {
        try {
            const r = await YT.api.get('/api/private_message/select/my/groups', { me: me.userId });
            if (!r || !r.data) return;

            const serverGroups = Array.isArray(r.data) ? r.data : [];
            const myGroups = serverGroups.map(g => ({
                groupId: String(YT.pick(g, 'groupId', 'group_id')),
                groupName: String(YT.pick(g, 'groupName', 'group_name')),
                ownerId: String(YT.pick(g, 'ownerId', 'owner_id')),
                createTime: String(YT.pick(g, 'createTime', 'create_time'))
            }));

            const oldIds = new Set(getStoredGroupIds());
            const newIds = myGroups.map(g => g.groupId);
            const addedIds = newIds.filter(id => !oldIds.has(id));

            if (addedIds.length > 0) {
                console.log('发现新群：', addedIds);
                for (const gid of addedIds) {
                    const g = myGroups.find(x => x.groupId === gid);
                    YT.toast('🔔 你已被拉入新的群聊：' + (g ? g.groupName : '群聊'));
                }
            }

            setStoredGroupIds(newIds);
            setMyGroups(myGroups);
            renderMyGroups();

            if (addedIds.length > 0 && !currentGroup) {
                const firstNew = myGroups.find(g => addedIds.includes(g.groupId));
                if (firstNew) {
                    openGroupChat(firstNew.groupId, firstNew.groupName);
                }
            }

        } catch (e) {
            console.error("同步群列表失败", e);
            YT.toast('同步群列表失败：' + (e && e.message ? e.message : '未知错误'));
        }
    }
    async function refreshUnread() {
        if (!sideHead) return;
        try {
            const r = await YT.api.get('/api/private_message/count/unread', { me: me.userId });
            const n = Number((r.data && r.data.count) || 0);
            if (n === lastUnread) return;
            lastUnread = n;
            let titleSpan = sideHead.querySelector('span');
            if (titleSpan) { titleSpan.textContent = n > 0 ? `私信 · 未读 ${n}` : '私信'; }
        } catch (e) { }
    }

    async function openChat(userId, name) {
        if (!userId || userId.length !== 13) { YT.toast('用户ID应为13位'); return; }
        if (userId === me.userId) { YT.toast('不能和自己聊天'); return; }

        currentGroup = null;
        ta.disabled = false;
        ta.placeholder = '写私信…（Enter 发送，Shift+Enter 换行）';
        sendBtn.disabled = false;
        emojiBtn.disabled = false;
        picBtn.disabled = false;
        videoBtn.disabled = false;

        current = { userId, name: name || '' };
        renderHead(); renderPeers(); renderMyGroups();

        msgs.innerHTML = '<div class="empty">加载对话…</div>';
        loading = true;
        try {
            const r = await YT.api.get('/api/private_message/select/message', { a: me.userId, b: userId });
            const list = Array.isArray(r.data) ? r.data : [];
            curList = list;
            lastChatSig = chatSig(list);

            const last = list[list.length - 1];
            touchPeer(userId, name, last ? previewOf(last) : undefined, last ? last.createTime : '', 0);

            msgs.innerHTML = '';
            if (!list.length) msgs.innerHTML = '<div class="empty">还没有消息，发第一条吧</div>';
            else appendMsgs(list, false);

            try { await YT.api.post('/api/private_message/read', { me: me.userId, other: userId }); } catch (e) { }
            refreshUnread();
        } catch (e) { msgs.innerHTML = `<div class="empty">加载失败：${YT.esc(e.message)}</div>`; } finally { loading = false; }
    }

    async function openGroupChat(groupId, groupName) {
        current = null;
        currentGroup = { groupId, groupName };
        ta.disabled = false;
        ta.placeholder = '发送群消息…（Enter 发送）';
        sendBtn.disabled = false;
        emojiBtn.disabled = false;
        picBtn.disabled = false;
        videoBtn.disabled = false;
        toggleEmojiPanel(true);
        renderHead(); renderPeers(); renderMyGroups();

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
                senderName: YT.pick(m, 'senderName', 'sender_name') || (YT.pick(m, 'from_user') === 'AI_BOT' ? 'DeepSeek 助手' : '群友')
            }));

            curList = normList;
            setGroupReadTime(groupId);
            renderMyGroups();

            msgs.innerHTML = '';
            if (!normList.length) msgs.innerHTML = '';
            else appendMsgs(normList, true);

            lastGroupChatSig = chatSig(normList);
        } catch (e) {
            msgs.innerHTML = `<div class="empty">群聊加载失败：${YT.esc(e.message)}</div>`;
        }
    }

    // ---------- 表情包 ----------
    let emojiCache = null, emojiLoading = false;
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
        const cells = emojiCache.map(e => ({
            file: String(YT.pick(e, 'fileName', 'file_name') || ''),
            name: String(YT.pick(e, 'name') || '')
        })).filter(it => it.file).map(it => `
            <button class="pm-emoji" data-emoji="${YT.esc(it.file)}" title="${YT.esc(it.name || it.file)}">
                <img src="${emojiSrc(it.file)}" alt="${YT.esc(it.name || it.file)}" loading="lazy">
            </button>
        `).join('');
        emojiPanel.innerHTML = `<div class="pm-emoji-cells">${cells}</div>`;
    }

    function toggleEmojiPanel(forceHide) {
        const show = !forceHide && emojiPanel.hidden;
        emojiPanel.hidden = !show;
        emojiBtn.classList.toggle('on', show);
        if (show) loadEmojiPanel();
    }

    // ---------- 媒体发送 ----------
    async function sendMedia(file) {
        if (!file) return;
        if (loading) return;

        loading = true;
        try {
            const form = new FormData();
            form.append('file', file);

            // 🟢 修改这里：直接传 form，不要加第三个参数
            const r = await YT.api.post('/api/private_message/upload/media', form);

            if (!r || !r.success || !r.data || !r.data.mediaPath) {
                YT.toast(r && r.message ? r.message : '上传失败');
                return;
            }

            const mediaPath = r.data.mediaPath;

            // 判断是图片还是视频（根据文件扩展名）
            const ext = file.name.split('.').pop().toLowerCase();
            const isVideo = ['mp4', 'webm', 'mov', 'm4v'].includes(ext);
            const msgType = isVideo ? 'video' : 'image';

            // 这里发送入库的请求，也可以用 FormData 直接发给后端 @ModelAttribute
            const targetForm = new FormData();
            targetForm.append('fromUser', me.userId);
            if (currentGroup) {
                targetForm.append('groupId', currentGroup.groupId);
                targetForm.append('contents', '');
                targetForm.append('msgType', msgType);
                targetForm.append('mediaPath', mediaPath);
            } else {
                targetForm.append('toUser', current.userId);
                targetForm.append('mediaPath', mediaPath);
            }

            // 🟢 入库接口：群聊用 add/group/message，私聊用 send/picture/video
            const res = currentGroup
                ? await YT.api.post('/api/private_message/add/group/message', targetForm)
                : await YT.api.post('/api/private_message/send/picture/video', targetForm);

            if (!res.success) {
                YT.toast(res.message || '发送失败');
                return;
            }

            const nowMsg = {
                msgId: String((res.data && res.data.msgId) || YT.randId()),
                fromUser: me.userId,
                toUser: currentGroup ? currentGroup.groupId : current.userId,
                contents: '',
                msgType: msgType,
                mediaPath,
                createTime: localNow(),
                senderName: me.nickname || me.userId
            };

            curList.push(nowMsg);
            appendMsgs([nowMsg], !!currentGroup);

            if (currentGroup) {
                setGroupReadTime(currentGroup.groupId);
                renderMyGroups();
            } else {
                touchPeer(current.userId, current.name, previewOf(nowMsg), nowMsg.createTime);
                loadInbox();
            }

        } catch (e) {
            YT.toast('发送失败：' + e.message);
        } finally {
            loading = false;
            ta.focus();
        }
    }
    async function doSendEmoji(fileName) {
        if (!current && !currentGroup) { YT.toast('请先选择聊天对象或群聊'); return; }
        if (loading) return;
        loading = true; emojiBtn.disabled = true;
        try {
            let r;
            if (currentGroup) {
                r = await YT.api.post('/api/private_message/add/group/message', {
                    groupId: currentGroup.groupId,
                    fromUser: me.userId,
                    contents: '',
                    msgType: 'emoji',
                    mediaPath: fileName
                });
            } else {
                r = await YT.api.post('/api/private_message/send/emoji', {
                    fromUser: me.userId,
                    toUser: current.userId,
                    mediaPath: fileName
                });
            }
            if (!r.success) { YT.toast(r.message || '发送失败'); return; }

            toggleEmojiPanel(true);

            const nowMsg = {
                msgId: String((r.data && r.data.msgId) || ''),
                fromUser: me.userId,
                toUser: currentGroup ? currentGroup.groupId : current.userId,
                contents: '',
                msgType: 'emoji',
                mediaPath: fileName,
                createTime: localNow(),
                senderName: me.nickname || me.userId
            };

            curList.push(nowMsg);
            appendMsgs([nowMsg], !!currentGroup);

            if (currentGroup) {
                setGroupReadTime(currentGroup.groupId);
                renderMyGroups();
            } else {
                scheduleWithdrawRefresh(curList);
                touchPeer(current.userId, current.name, previewOf(nowMsg), nowMsg.createTime);
                loadInbox();
            }
        } catch (e) {
            YT.toast('发送失败：' + e.message);
        } finally {
            loading = false;
            emojiBtn.disabled = false;
            ta.focus();
        }
    }

    async function doSend() {
        if (currentGroup) {
            const content = ta.value.trim();
            if (!content) { YT.toast('消息不能为空'); return; }
            if (loading) return;

            sendBtn.disabled = true; loading = true;
            try {
                const r = await YT.api.post('/api/private_message/add/group/message', {
                    groupId: currentGroup.groupId,
                    fromUser: me.userId,
                    contents: content,
                    msgType: 'text'
                });
                if (!r.success) { YT.toast(r.message || '发送失败'); return; }

                ta.value = '';
                const nowMsg = {
                    msgId: String((r.data && r.data.msgId) || ''),
                    fromUser: me.userId,
                    toUser: currentGroup.groupId,
                    contents: content,
                    msgType: 'text',
                    createTime: localNow(),
                    senderName: me.nickname || me.userId
                };

                curList.push(nowMsg);
                appendMsgs([nowMsg], true);
                setGroupReadTime(currentGroup.groupId);
                renderMyGroups();

                if (content.includes('问问DeepSeek') || content.includes('问问AI') ||
                    content.includes('问问人工智能') || content.includes('DeepSeek') || content.includes('deepseek')) {
                    if (!document.getElementById('typing-ai-bubble')) {
                        aiLock = true;
                        const thinkingMsgId = YT.randId();

                        msgs.insertAdjacentHTML('beforeend', `
                        <div class="pm-group-msg-wrap" id="typing-ai-bubble">
                            <div class="pm-group-avatar"><span class="avatar" style="background:#3ea6ff; color:#fff;">AI</span></div>
                            <div class="pm-group-msg-body">
                                <span class="pm-group-name">DeepSeek 助手</span>
                                <div class="pm-msg"><div class="bubble" style="background:var(--surface-2); border: 1px dashed var(--link); color:var(--text-primary);" id="typing-ai-bubble-content">正在阅读群聊并思考...</div></div>
                            </div>
                        </div>`);
                        msgs.scrollTop = msgs.scrollHeight;

                        YT.api.post('/api/private_message/add/group/message', {
                            msgId: thinkingMsgId,
                            groupId: currentGroup.groupId,
                            fromUser: 'AI_BOT',
                            contents: '正在阅读群聊并思考...',
                            msgType: 'text'
                        }).then(() => {
                            triggerGroupAi(nowMsg, thinkingMsgId);
                        });
                    }
                }
            } catch (e) { YT.toast('发送失败：' + e.message); } finally { loading = false; sendBtn.disabled = false; ta.focus(); }
            return;
        }

        if (!current) { YT.toast('请先选择聊天对象'); return; }
        const content = ta.value.trim();
        if (!content) { YT.toast('消息不能为空'); return; }
        if (loading) return;

        sendBtn.disabled = true; loading = true;
        try {
            const r = await YT.api.post('/api/private_message/send', { fromUser: me.userId, toUser: current.userId, contents: content });
            if (!r.success) { YT.toast(r.message || '发送失败'); return; }
            ta.value = '';
            const sentMsgId = String((r.data && r.data.msgId) || '');
            const nowMsg = { msgId: sentMsgId, fromUser: me.userId, toUser: current.userId, contents: content, createTime: localNow() };
            curList.push(nowMsg);
            appendMsgs([nowMsg], false);
            touchPeer(current.userId, current.name, content.slice(0, 30), nowMsg.createTime);
            loadInbox();
        } catch (e) { YT.toast('发送失败：' + e.message); } finally { loading = false; sendBtn.disabled = false; ta.focus(); }
    }

    // ---------- 撤回 / 删除 ----------
    async function doWithdraw(msgId, node) {
        try {
            const r = await YT.api.post('/api/private_message/withdraw/private/message', {
                msgId,
                userId: me.userId,
                timeWithdraw: WITHDRAW_LIMIT_S
            });
            if (!r.success) { YT.toast(r.message || '撤回失败'); return; }

            const idx = curList.findIndex(x => String(x.msgId) === String(msgId));
            if (idx >= 0) curList[idx].isWithdrawn = 1;
            if (node) {
                const bubble = node.querySelector('.bubble');
                if (bubble) bubble.innerHTML = '<span style=\"opacity:.8;\">消息已撤回</span>';
            }
            renderMsgs(curList, !!currentGroup);
        } catch (e) {
            YT.toast('撤回失败：' + e.message);
        }
    }

    async function doDeleteFromMySide(msgId, node) {
        try {
            const r = await YT.api.post('/api/private_message/delete/private/message', {
                msgId,
                userId: me.userId
            });
            if (!r.success) { YT.toast(r.message || '删除失败'); return; }

            const idx = curList.findIndex(x => String(x.msgId) === String(msgId));
            if (idx >= 0) curList.splice(idx, 1);
            if (node) node.remove();
            if (!curList.length) {
                msgs.innerHTML = '<div class="empty">还没有消息，发第一条吧</div>';
            }
        } catch (e) {
            YT.toast('删除失败：' + e.message);
        }
    }

    // ---------- AI 自动回复 ----------
    const processedAiMsgIds = new Set();

    async function triggerGroupAi(triggerMsg, thinkingMsgId) {
        if (processedAiMsgIds.has(triggerMsg.msgId)) return;
        processedAiMsgIds.add(triggerMsg.msgId);
        aiLock = true;

        const question = `${triggerMsg.senderName} 说：“${triggerMsg.contents}”。请给出你的回答。`;
        let bubble = document.getElementById('typing-ai-bubble-content');
        let fullText = '';

        try {
            const response = await fetch(`/api/private_message/select/group/message/deepseek?groupId=${currentGroup.groupId}&question=${encodeURIComponent(question)}`);
            if (!response.ok) throw new Error('网络请求失败');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                if (isFirstChunk) {
                    if (bubble) bubble.innerText = '';
                    isFirstChunk = false;
                }
                fullText += chunk;
                if (bubble) bubble.innerText = fullText;
                msgs.scrollTop = msgs.scrollHeight;
            }

            if (fullText.trim()) {
                const aiReplyMsgId = YT.randId();

                const r = await YT.api.post('/api/private_message/add/group/message', {
                    msgId: aiReplyMsgId,
                    groupId: currentGroup.groupId,
                    fromUser: 'AI_BOT',
                    contents: fullText.trim(),
                    msgType: 'text'
                });

                if (r.success) {
                    const tempNode = document.getElementById('typing-ai-bubble');
                    if (tempNode) tempNode.remove();

                    if (thinkingMsgId) {
                        YT.api.post('/api/private_message/delete/private/message', { msgId: thinkingMsgId, userId: me.userId }).catch(() => {});
                    }

                    const aiMsg = {
                        msgId: aiReplyMsgId,
                        fromUser: 'AI_BOT',
                        toUser: currentGroup.groupId,
                        contents: fullText.trim(),
                        msgType: 'text',
                        createTime: localNow(),
                        senderName: 'DeepSeek 助手'
                    };

                    curList = curList.filter(m => m.msgId !== thinkingMsgId);
                    curList = curList.filter(m => m.msgId !== aiReplyMsgId);
                    curList.push(aiMsg);

                    appendMsgs([aiMsg], true);
                    lastGroupChatSig = chatSig(curList);
                } else {
                    YT.toast('AI 消息入库失败: ' + (r.message || '未知错误'));
                }
            }
        } catch (e) {
            console.error('AI 回复出错', e);
            if (bubble) bubble.innerText = 'AI 出错了：' + e.message;
        } finally {
            aiLock = false;
            const ghost = document.getElementById('typing-ai-bubble');
            if (ghost) ghost.remove();
        }
    }

    // ---------- 轮询 ----------
    async function pollOnce() {
        if (loading || aiLock) return;

        syncMyGroups();

        if (currentGroup) {
            try {


                // 在 pollOnce 内部处理群消息时：
                const lastMsg = normList[normList.length - 1];
                if (lastMsg && String(lastMsg.fromUser) !== me.userId) {
                    // 如果当前没有打开这个群，增加未读数
                    const readTime = getGroupReadTime(peerId); // 上次已读时间
                    const lastTimeStr = lastMsg.createTime.replace(' ', 'T');
                    const lastTime = new Date(lastTimeStr).getTime();

                    if (lastTime > readTime) {
                        const currentUnread = getGroupUnread(peerId);
                        setGroupUnread(peerId, currentUnread + 1);
                        renderMyGroups(); // 重新渲染左侧列表显示红点
                    }
                }


                const peerId = currentGroup.groupId;
                const r = await YT.api.get('/api/private_message/select/group/message', { groupId: peerId });
                const list = Array.isArray(r.data) ? r.data : [];
                const normList = list.map(m => ({
                    msgId: YT.pick(m, 'msg_id'), fromUser: YT.pick(m, 'from_user'), toUser: peerId,
                    contents: YT.pick(m, 'contents'), msgType: YT.pick(m, 'msg_type') || 'text',
                    mediaPath: YT.pick(m, 'media_path'), createTime: YT.pick(m, 'create_time'),
                    senderName: YT.pick(m, 'senderName', 'sender_name') || (YT.pick(m, 'from_user') === 'AI_BOT' ? 'DeepSeek 助手' : '群友')
                }));

                const sig = normList.length + '|' + (normList.length ? normList[normList.length - 1].msgId : '');

                if (sig !== lastGroupChatSig) {
                    const existingIds = new Set(curList.map(x => x.msgId));
                    const newMsgs = normList.filter(m => !existingIds.has(m.msgId));

                    if (newMsgs.length > 0) {
                        newMsgs.forEach(m => {
                            if (String(m.fromUser) === 'AI_BOT' && String(m.contents).includes('正在阅读群聊并思考')) {
                                if (!document.getElementById('typing-ai-bubble')) {
                                    msgs.insertAdjacentHTML('beforeend', `
                                    <div class="pm-group-msg-wrap" id="typing-ai-bubble">
                                        <div class="pm-group-avatar"><span class="avatar" style="background:#3ea6ff; color:#fff;">AI</span></div>
                                        <div class="pm-group-msg-body">
                                            <span class="pm-group-name">DeepSeek 助手</span>
                                            <div class="pm-msg"><div class="bubble" style="background:var(--surface-2); border: 1px dashed var(--link); color:var(--text-primary);" id="typing-ai-bubble-content">正在阅读群聊并思考...</div></div>
                                        </div>
                                    </div>`);
                                    msgs.scrollTop = msgs.scrollHeight;
                                }
                            } else {
                                appendMsgs([m], true);
                            }
                        });

                        curList.push(...newMsgs);
                    }

                    lastGroupChatSig = sig;
                    setGroupReadTime(peerId);
                    renderMyGroups();

                    const lastMsg = normList[normList.length - 1];
                    if (lastMsg && String(lastMsg.fromUser) === 'AI_BOT' && !String(lastMsg.contents).includes('正在阅读群聊并思考')) {
                        const ghost = document.getElementById('typing-ai-bubble');
                        if (ghost) ghost.remove();
                        if (aiLock) aiLock = false;
                    }
                }
            } catch (e) { console.error("群聊轮询失败", e); }
            return;
        }

        const peerId = current ? current.userId : null;
        if (!peerId) return;

        const [inboxR, unreadR, chatR] = await Promise.all([
            YT.api.get('/api/private_message/select/inbox', { me: me.userId }).catch(() => null),
            YT.api.get('/api/private_message/count/unread', { me: me.userId }).catch(() => null),
            YT.api.get('/api/private_message/select/message', { a: me.userId, b: peerId }).catch(() => null),
        ]);

        if (chatR) {
            const list = Array.isArray(chatR.data) ? chatR.data : [];
            const sig = list.length + '|' + (list.length ? (list[list.length - 1].msg_id || list[list.length - 1].msgId) : '');
            if (sig !== lastChatSig) {
                const existingIds = new Set(curList.map(x => String(x.msgId)));
                const newMsgs = list.filter(m => !existingIds.has(String(YT.pick(m, 'msg_id', 'msgId'))));
                if (newMsgs.length > 0) {
                    appendMsgs(newMsgs, false);
                    curList.push(...newMsgs);
                }
                lastChatSig = sig;
                try { await YT.api.post('/api/private_message/read', { me: me.userId, other: peerId }); } catch (e) { }
            }
        }

        if (inboxR) {
            const rows = Array.isArray(inboxR.data) ? inboxR.data : [];
            const sig = inboxSig(rows);
            if (sig !== lastInboxSig) {
                lastInboxSig = sig;
                applyInboxRows(rows);
            }
        }

        if (unreadR) {
            const n = Number((unreadR.data && unreadR.data.count) || 0);
            if (n !== lastUnread) {
                lastUnread = n;
                if (sideHead) {
                    const titleSpan = sideHead.querySelector('span');
                    if (titleSpan) titleSpan.textContent = n > 0 ? `私信 · 未读 ${n}` : '私信';
                }
            }
        }
    }

    function schedulePoll() {
        if (document.hidden) { pollTimer = null; return; }
        pollTimer = setTimeout(async () => {
            if (!pollBusy && !document.hidden) {
                pollBusy = true; try { await pollOnce(); } catch (e) {} finally { pollBusy = false; }
            }
            schedulePoll();
        }, POLL_MS);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
        } else if (!pollTimer) {
            pollOnce().catch(() => {});
            schedulePoll();
        }
    });

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

    picBtn.addEventListener('click', () => { picInput.value = ''; picInput.click(); });
    videoBtn.addEventListener('click', () => { videoInput.value = ''; videoInput.click(); });

    picInput.addEventListener('change', () => {
        const f = picInput.files[0];
        picInput.value = '';
        if (f) sendMedia(f);
    });
    videoInput.addEventListener('change', () => {
        const f = videoInput.files[0];
        videoInput.value = '';
        if (f) sendMedia(f);
    });

    emojiBtn.addEventListener('click', () => { toggleEmojiPanel(); });
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
            if (current && current.userId === id) {
                current = null;
                renderHead();
                msgs.innerHTML = '<div class="empty">还没有打开任何对话</div>';
            }
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

    // ---------- 建群逻辑 ----------
    const btnCreateGroup = document.getElementById('btn-create-group');
    if (btnCreateGroup) {
        btnCreateGroup.onclick = function (e) {
            e.preventDefault();
            const modal = document.getElementById('group-modal');
            if (modal) {
                modal.style.display = 'flex';
                document.getElementById('new-group-name').value = '';
                document.getElementById('new-group-members').value = '';
            }
        };
    }

    const btnCancelGroup = document.getElementById('cancel-group');
    if (btnCancelGroup) {
        btnCancelGroup.onclick = function (e) {
            e.preventDefault();
            const modal = document.getElementById('group-modal');
            if (modal) modal.style.display = 'none';
        };
    }

    const btnSubmitGroup = document.getElementById('submit-group');
    if (btnSubmitGroup) {
        btnSubmitGroup.onclick = async function (e) {
            e.preventDefault();
            const groupName = document.getElementById('new-group-name').value.trim();
            const membersStr = document.getElementById('new-group-members').value.trim();

            if (!groupName) {
                return YT.toast('请输入群名称');
            }

            btnSubmitGroup.disabled = true;
            btnSubmitGroup.textContent = '创建中...';

            try {
                const r = await YT.api.post('/api/private_message/establish/group', {
                    groupName: groupName,
                    ownerId: me.userId
                });

                if (r.success && r.data && r.data.groupId) {
                    const newGroupId = r.data.groupId;

                    if (membersStr) {
                        const memberIds = membersStr.split(',').map(s => s.trim()).filter(s => s);
                        for (const uid of memberIds) {
                            try {
                                const addRes = await YT.api.post('/api/private_message/add/member', {
                                    groupId: newGroupId,
                                    userId: uid,
                                    fromUser: me.userId
                                });
                                if (!addRes.success) {
                                    alert("拉 " + uid + " 失败: " + (addRes.message || "未知错误"));
                                } else {
                                    console.log("拉人成功: " + uid);
                                }
                            } catch (err) {
                                alert("网络错误，拉 " + uid + " 失败");
                            }
                        }
                    }

                    YT.toast('群聊创建成功！');
                    document.getElementById('group-modal').style.display = 'none';

                    await syncMyGroups();
                    openGroupChat(newGroupId, groupName);
                } else {
                    YT.toast(r.message || '创建群聊失败');
                }
            } catch (err) {
                YT.toast('请求失败：' + err.message);
            } finally {
                btnSubmitGroup.disabled = false;
                btnSubmitGroup.textContent = '创建';
            }
        };
    }


    //这两行用于测试清理缓存
    //localStorage.removeItem('yt_my_groups_' + me.userId);
    //localStorage.removeItem('yt_my_group_ids_' + me.userId);
    //强制重新刷新前端
    //async function forceSyncGroups() {
    //    try {
    //        const r = await YT.api.get('/api/private_message/select/my/groups', { me: me.userId });
    //        console.log('真实群列表', r);
    //        const serverGroups = Array.isArray(r.data) ? r.data : [];
    //        const myGroups = serverGroups.map(g => ({
    //            groupId: String(YT.pick(g, 'groupId', 'group_id')),
    //            groupName: String(YT.pick(g, 'groupName', 'group_name')),
    //            ownerId: String(YT.pick(g, 'ownerId', 'owner_id')),
    //            createTime: String(YT.pick(g, 'createTime', 'create_time'))
    //        }));
    //        localStorage.setItem('yt_my_groups_' + me.userId, JSON.stringify(myGroups));
    //        localStorage.setItem('yt_my_group_ids_' + me.userId, JSON.stringify(myGroups.map(g => g.groupId)));
    //        renderMyGroups();
    //    } catch (e) {
    //        console.error('强制同步群失败', e);
    //    }
    //}













    renderPeers();
    renderMyGroups();

    (async () => {
        await Promise.all([loadInbox(), refreshUnread(), syncMyGroups()]);
        schedulePoll();
    })();
})();