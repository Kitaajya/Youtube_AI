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
    const voiceBtn = $('#pm-voice-btn');
    const bdayBar = $('#pm-bday-bar'), bdayBtn = $('#pm-bday-btn');
    const groupsBox = $('#pm-groups');
    // 屏蔽私信按钮：必须先取到元素再使用。
    // 之前只写了 if (btnBlockUser) 却没声明这个变量，浏览器会抛
    // ReferenceError: btnBlockUser is not defined，整个脚本从这里中断。
    const btnBlockUser = document.getElementById('btn-block-user');

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

    // ---------- 私信屏蔽名单 ----------
    // 以前这个 Set 定义在 renderPeers() 里面（const），函数外根本访问不到：
    // renderHead() 一读 blockedPeers 就 ReferenceError，会话/群聊点了没反应。
    // 现在改成模块级变量，谁都能用。
    const blockedKey = 'yt_pm_blocked_' + me.userId;
    let blockedPeers = (() => {
        try { return new Set(JSON.parse(localStorage.getItem(blockedKey) || '[]')); } catch (e) { return new Set(); }
    })();
    const saveBlockedPeers = () => {
        try { localStorage.setItem(blockedKey, JSON.stringify(Array.from(blockedPeers))); } catch (e) { }
    };
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

    function touchPeer(userId, name, lastMsg, lastTime, unread, avatar) {
        const arr = getPeers();
        const i = arr.findIndex(p => p.userId === userId);
        const old = i >= 0 ? arr[i] : null;
        if (i >= 0) arr.splice(i, 1);
        arr.unshift({
            userId,
            name: name || (old && old.name) || '',
            avatar: avatar || (old && old.avatar) || '',
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

        // 屏蔽名单现在在模块级（blockedPeers），这里只负责显示状态
        peersBox.innerHTML = arr.map(p => {
            const isBlocked = blockedPeers.has(p.userId); // 👈 新增：判断是否被屏蔽
            return `
            <div class="pm-peer ${current && current.userId === p.userId ? 'active' : ''} ${isBlocked ? 'blocked' : ''}" data-peer="${YT.esc(p.userId)}">
                ${YT.avatarHtml(p.name || p.userId, p.avatar)}
                <div class="p-txt">
                    <div class="p-name">${YT.esc(p.name || p.userId)}</div>
                    <div class="p-sub">${YT.esc(p.lastMsg || '（无消息）')} · ${YT.timeAgo(p.lastTime)}</div>
                </div>
                ${p.unread > 0 ? `<span class="p-badge">${p.unread > 99 ? '99+' : p.unread}</span>` : ''}
                <button class="p-del" title="从列表隐藏" data-remove="${YT.esc(p.userId)}">&#10005;</button>
            </div>`;
        }).join('');
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

    // ---------- 生日祝福消息 ----------
    const BDAY_CAKE_SVG = `<svg class="bday-cake" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2.2c1.3 1.2 1.8 2.1 1.8 2.8a1.8 1.8 0 0 1-3.6 0c0-.7.5-1.6 1.8-2.8z" fill="currentColor" stroke="none"/>
        <path d="M12 6.7v4.5"/>
        <path d="M4 11.2a2 2 0 0 1 4 0 2 2 0 0 1 4 0 2 2 0 0 1 4 0 2 2 0 0 1 4 0"/>
        <path d="M4 11.2v5.6c0 1 .8 1.8 1.8 1.8h12.4c1 0 1.8-.8 1.8-1.8v-5.6"/>
        <path d="M2.6 20.4h18.8"/>
    </svg>`;

    function bdayBubbleHtml() {
        return `<div class="bubble bday-bubble">${BDAY_CAKE_SVG}
            <div class="bday-title">生日快乐</div>
            <div class="bday-sub">祝你今天开心一整天</div>
        </div>`;
    }

    function confettiBurst() {
        const colors = ['#ff4d4f', '#ffd666', '#52c41a', '#40a9ff', '#b37feb', '#ff85c0'];
        const box = document.createElement('div');
        box.className = 'pm-confetti';
        for (let i = 0; i < 26; i++) {
            const s = document.createElement('i');
            s.style.left = (3 + Math.random() * 94).toFixed(2) + '%';
            s.style.background = colors[i % colors.length];
            s.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's';
            box.appendChild(s);
        }
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 2400);
    }

    // ---------- 生日祝福：互关 + 对方今天生日才显示按钮 ----------
    function followedIds(r) {
        const rows = r && Array.isArray(r.data) ? r.data : [];
        return rows.map(x => String(YT.pick(x, 'userId', 'user_id') || '')).filter(Boolean);
    }

    async function isMutualFollow(a, b) {
        try {
            const [following, fans] = await Promise.all([
                YT.api.get('/api/user/select/me/follow', { me: a }),
                YT.api.get('/api/user/select/me/fans', { me: a })
            ]);
            return followedIds(following).includes(b) && followedIds(fans).includes(b);
        } catch (e) {
            return false;
        }
    }

    async function refreshBdayBtn() {
        if (!bdayBar) return;
        bdayBar.style.display = 'none';
        if (!current || !current.userId) return;

        const uid = current.userId;
        const sentKey = 'yt-bday-sent-' + me.userId + '-' + uid + '-' + YT.todayMD();
        try { if (localStorage.getItem(sentKey)) return; } catch (e) { }
        try {
            const [bday, mutual] = await Promise.all([YT.birthdayOf(uid), isMutualFollow(me.userId, uid)]);
            if (!current || current.userId !== uid) return;   // 期间切换了会话
            if (mutual && YT.isBirthdayToday(bday)) bdayBar.style.display = '';
        } catch (e) { /* 查询失败就不显示按钮 */ }
    }

    async function sendBirthday() {
        if (!current || loading) return;
        const toUser = current.userId;
        const peerName = current.name || '';

        loading = true;
        if (bdayBtn) bdayBtn.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        try {
            const r = await YT.api.post('/api/private_message/send', {
                fromUser: me.userId,
                toUser,
                contents: '生日快乐！',
                msgType: 'birthday'
            });
            if (!r || !r.success) { YT.toast((r && r.message) || '发送失败'); return; }

            const nowMsg = {
                msgId: String((r.data && r.data.msgId) || ''),
                fromUser: me.userId,
                toUser,
                contents: '生日快乐！',
                msgType: 'birthday',
                createTime: localNow()
            };
            curList.push(nowMsg);
            appendMsgs([nowMsg], false);
            lastChatSig = chatSig(curList);
            touchPeer(toUser, peerName, '[生日祝福]', nowMsg.createTime);
            confettiBurst();
            try { localStorage.setItem('yt-bday-sent-' + me.userId + '-' + toUser + '-' + YT.todayMD(), '1'); } catch (e) { }
            if (bdayBar) bdayBar.style.display = 'none';   // 已经送过，收起来
            loadInbox();
        } catch (e) {
            YT.toast('发送失败：' + (e.message || '网络错误'));
        } finally {
            loading = false;
            if (bdayBtn) bdayBtn.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            ta.focus();
        }
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
        } else if (mtype === 'voice' && mediaFile) {
            bodyHtml = `<div class="bubble media">
                <audio controls src="${YT.mediaUrl(mediaFile)}" style="height: 40px; max-width: 220px;"></audio>
            </div>`;
        }

        else if (mtype === 'birthday') {
            bodyHtml = bdayBubbleHtml();
        } else {
            // bodyHtml = `<div class="bubble">${YT.esc(String(m.contents || ''))}</div>`;
            const rawText = String(m.contents || '');
            // 把文本用 marked 解析成 HTML
            const parsedHtml = window.marked ? window.marked.parse(rawText) : YT.esc(rawText);
            bodyHtml = `<div class="bubble markdown-body">${parsedHtml}</div>`;
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
            // 群消息左侧头像：有头像就显示图片（SQL 已经带了 senderAvatar），没有才用首字母
            const avBlock = `<div class="pm-group-avatar" onclick="location.href='profile.html?userId=${YT.esc(m.fromUser)}&name=${encodeURIComponent(who)}'" title="查看 ${YT.esc(who)} 的资料">
                ${YT.avatarHtml(who, m.senderAvatar)}
            </div>`;
            return `
            <div class="pm-group-msg-wrap ${mine ? 'me' : ''}" data-msg-id="${YT.esc(msgId)}">
                ${avBlock}
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

        // 加上这 3 行
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([msgs]).catch(err => console.log('MathJax渲染失败', err));
        }
    }
    function appendMsgs(newMsgs, isGroup = false) {
        if (!newMsgs || !newMsgs.length) return;
        let html = '';
        for (const m of newMsgs) {
            html += msgHtml(m, isGroup);
        }
        msgs.insertAdjacentHTML('beforeend', html);
        msgs.scrollTop = msgs.scrollHeight;

        //核心新增：通知 MathJax 渲染新插入的消息（比如历史记录、最终落定在屏幕上的 AI 回复）
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([msgs]).catch(err => console.log('MathJax渲染失败', err));
        }
    }

    function renderHead() {
        const titleSpan = document.getElementById('pm-chat-title');
        const exitBtn = document.getElementById('btn-exit-group');
        const viewBtn = document.getElementById('btn-view-members');

        if (currentGroup) {
            // 群聊：标题显示群名，右侧显示「成员列表 / 退出群聊」，屏蔽按钮不适用
            // （之前的屏蔽改动把这一段截断了，只留了一句隐藏按钮就 return，
            //  所以点群聊时头部完全没反应，看着就像"点不动"）
            if (btnBlockUser) btnBlockUser.style.display = 'none';
            if (titleSpan) {
                titleSpan.innerHTML = `
            <span class="avatar" style="background:var(--link);color:#fff;border-radius:8px;margin-right:8px;">群</span>
            <b>${YT.esc(currentGroup.groupName || '群聊')}</b>
            <span class="w-stats">群号: ${YT.esc(currentGroup.groupId)}</span>`;
            }
            if (exitBtn) exitBtn.style.display = 'block';
            if (viewBtn) viewBtn.style.display = 'block';
            return;
        }

        if (!current) {
            if (titleSpan) titleSpan.textContent = '选择左侧会话开始聊天';
            if (exitBtn) exitBtn.style.display = 'none';
            if (viewBtn) viewBtn.style.display = 'none';
            if (btnBlockUser) btnBlockUser.style.display = 'none'; // 没选人时隐藏
            return;
        }

        if (titleSpan) titleSpan.innerHTML = `
            <span style="margin-right:8px;display:inline-flex;">${YT.avatarHtml(current.name || current.userId, current.avatar)}</span>
            <b>${YT.esc(current.name || '对方')}</b>
            <span class="w-stats">ID: ${YT.esc(current.userId)}</span>`;
        if (exitBtn) exitBtn.style.display = 'none';
        if (viewBtn) viewBtn.style.display = 'none';

        // 私聊：显示屏蔽按钮并更新状态
        if (btnBlockUser) {
            btnBlockUser.style.display = '';
            const isBlocked = blockedPeers.has(current.userId);
            btnBlockUser.textContent = isBlocked ? '解除屏蔽' : '屏蔽此人';
            btnBlockUser.style.color = isBlocked ? 'var(--ok)' : 'var(--danger)';
        }
    }    function previewOf(m) {
        if (Number(m.isWithdrawn || 0) === 1) return '[已撤回]';
        const t = String(m.msgType || 'text').toLowerCase();
        if (t === 'image') return '[图片]';
        if (t === 'video') return '[视频]';
        if (t === 'voice') return '[语音]';
        if (t === 'emoji') return '[表情]';
        if (t === 'birthday') return '[生日祝福]';
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
            avatar: String(YT.pick(row, 'peerAvatar', 'peer_avatar') || ''),
            lastMsg: String(YT.pick(row, 'lastMsg', 'last_msg') || '').slice(0, 30),
            lastTime: String(YT.pick(row, 'lastTime', 'last_time') || ''),
            unread: Number(YT.pick(row, 'unread') || 0),
        })).filter(p => p.userId);

        const local = getPeers();
        const merged = server.map(p => {
            const old = local.find(x => x.userId === p.userId);
            const note = old && old.name ? old.name : '';
            // 服务端现在会返回真实昵称：以服务端为准；只有在它没昵称（等于 ID）时才用本地缓存的名字。
            // 头像同理：服务端没返回就用本地缓存的，别把人家的头像弄丢了。
            const name = (p.name && p.name !== p.userId) ? p.name : (note || p.name);
            return { ...p, name, avatar: p.avatar || (old && old.avatar) || '' };
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
            // 关键：请求失败（500/超时/返回的不是 Result）时 data 是 undefined，
            // 以前会当成"服务端没有会话"→ applyInboxRows([]) 把本地会话缓存清空，
            // 表现就是「私信列表突然变空」。这里只认真正的数组。
            if (!r || r.success === false || !Array.isArray(r.data)) { renderPeers(); return; }
            const rows = r.data;
            lastInboxSig = inboxSig(rows);
            applyInboxRows(rows);
        } catch (e) { renderPeers(); }
    }

    // 从服务端恢复屏蔽名单：本地 localStorage 只是缓存，
    // 换浏览器 / 清缓存后仍要能知道"我屏蔽过谁"，否则按钮会错显成"屏蔽此人"，
    // 再点一次后端会回"你已经禁止过这个用户私信了"。
    async function loadBlockedFromServer() {
        try {
            const r = await YT.api.get('/api/private_message/block/list', { upId: me.userId });
            // 接口不可用（表没建 / 500）时返回的不是 Result 结构，此时别清空本地缓存
            if (!r || r.success === false || !Array.isArray(r.data)) return;
            blockedPeers = new Set(r.data.map(x => String(x)));
            saveBlockedPeers();
            renderPeers();
            renderHead();
        } catch (e) { /* 静默失败，继续用本地缓存 */ }
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

    async function openChat(userId, name, avatar) {
        //if (!userId || userId.length !== 13) { YT.toast('用户ID应为13位'); return; }
        if (userId === me.userId) { YT.toast('不能和自己聊天'); return; }

        currentGroup = null;
        ta.disabled = false;
        ta.placeholder = '写私信…（Enter 发送，Shift+Enter 换行）';
        sendBtn.disabled = false;
        emojiBtn.disabled = false;
        picBtn.disabled = false;
        videoBtn.disabled = false;

        current = { userId, name: name || '', avatar: avatar || '' };
        if (bdayBar) bdayBar.style.display = 'none';
        renderHead(); renderPeers(); renderMyGroups();

        msgs.innerHTML = '<div class="empty">加载对话…</div>';
        loading = true;
        try {
            const r = await YT.api.get('/api/private_message/select/message', { a: me.userId, b: userId });
            const list = Array.isArray(r.data) ? r.data : [];
            curList = list;
            lastChatSig = chatSig(list);

            const last = list[list.length - 1];
            // 头像：优先用调用方传进来的，其次用本地缓存里已经有的
            const cachedPeer = getPeers().find(x => x.userId === userId);
            touchPeer(userId, name, last ? previewOf(last) : undefined, last ? last.createTime : '', 0,
                avatar || (cachedPeer && cachedPeer.avatar) || '');

            msgs.innerHTML = '';
            if (!list.length) msgs.innerHTML = '<div class="empty">还没有消息，发第一条吧</div>';
            else appendMsgs(list, false);

            try { await YT.api.post('/api/private_message/read', { me: me.userId, other: userId }); } catch (e) { }
            refreshUnread();
        } catch (e) { msgs.innerHTML = `<div class="empty">加载失败：${YT.esc(e.message)}</div>`; } finally { loading = false; refreshBdayBtn(); }
    }

    async function openGroupChat(groupId, groupName) {
        current = null;
        currentGroup = { groupId, groupName };
        if (bdayBar) bdayBar.style.display = 'none';
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
                senderName: YT.pick(m, 'senderName', 'sender_name') || (YT.pick(m, 'from_user') === 'AI_BOT' ? 'DeepSeek 助手' : '群友'),
                senderAvatar: YT.pick(m, 'senderAvatar', 'sender_avatar', 'avatar') || ''
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
    // forcedType：录音按钮会显式传 'voice'。
    // webm / ogg 既能装视频也能装语音，只靠扩展名判断必然误判，所以优先采信调用方给的类型。
    async function sendMedia(file, forcedType) {
        if (!file) return;
        if (loading) return;

        loading = true;
        try {
            const form = new FormData();
            form.append('file', file);

            const r = await YT.api.post('/api/private_message/upload/media', form);

            if (!r || !r.success || !r.data || !r.data.mediaPath) {
                YT.toast(r && r.message ? r.message : '上传失败');
                return;
            }

            const mediaPath = r.data.mediaPath;

            let msgType = forcedType || 'image';
            if (!forcedType) {
                const ext = file.name.split('.').pop().toLowerCase();
                if (['mp4', 'mov', 'm4v'].includes(ext)) {
                    msgType = 'video';
                } else if (['webm', 'mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
                    msgType = 'voice';
                }
            }

            const targetForm = new FormData();
            targetForm.append('fromUser', me.userId);
            targetForm.append('msgType', msgType); // 👈 补上这个

            if (currentGroup) {
                targetForm.append('groupId', currentGroup.groupId);
                targetForm.append('contents', '');
                targetForm.append('mediaPath', mediaPath);
            } else {
                targetForm.append('toUser', current.userId);
                targetForm.append('mediaPath', mediaPath);
            }

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

                // =========================================================
                // 核心修改：判断是否触发 AI，并根据关键词进行接口分流
                // =========================================================
                const isAiTrigger = content.includes('问问DeepSeek') || content.includes('问问AI') ||
                    content.includes('问问人工智能') || content.includes('DeepSeek') || content.includes('deepseek') ||
                    content.includes('群里都有谁') || content.includes('群成员') || content.includes('所有人');

                if (isAiTrigger) {
                    if (!document.getElementById('typing-ai-bubble')) {
                        aiLock = true;
                        const thinkingMsgId = YT.randId();

                        // 插入 UI 思考气泡
                        msgs.insertAdjacentHTML('beforeend', `
                        <div class="pm-group-msg-wrap" id="typing-ai-bubble">
                            <div class="pm-group-avatar"><span class="avatar" style="background:#3ea6ff; color:#fff;">AI</span></div>
                            <div class="pm-group-msg-body">
                                <span class="pm-group-name">DeepSeek 助手</span>
                                <div class="pm-msg"><div class="bubble" style="background:var(--surface-2); border: 1px dashed var(--link); color:var(--text-primary);" id="typing-ai-bubble-content">正在思考...</div></div>
                            </div>
                        </div>`);
                        msgs.scrollTop = msgs.scrollHeight;

                        // 将思考状态写入数据库
                        YT.api.post('/api/private_message/add/group/message', {
                            msgId: thinkingMsgId,
                            groupId: currentGroup.groupId,
                            fromUser: 'AI_BOT',
                            contents: '正在阅读群聊并思考...',
                            msgType: 'text'
                        }).then(() => {
                            // 👇 在这里进行路由分流
                            if (content.includes('群里都有谁') || content.includes('群成员') || content.includes('所有人')) {
                                // 如果问成员，走成员查询接口
                                triggerGroupMemberAi(nowMsg, thinkingMsgId);
                            } else {
                                // 否则，走普通聊天总结接口
                                triggerGroupAi(nowMsg, thinkingMsgId);
                            }
                        });
                    }
                }
            } catch (e) {
                YT.toast('发送失败：' + e.message);
            } finally {
                loading = false; sendBtn.disabled = false; ta.focus();
            }
            return;
        }

        // ---------------- 以下是私信（非群聊）的发送逻辑 ----------------
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
        } catch (e) {
            YT.toast('发送失败：' + e.message);
        } finally {
            loading = false; sendBtn.disabled = false; ta.focus();
        }
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

    // ---------- AI 自动回复（普通聊天总结） ----------
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
                    if (bubble) bubble.innerHTML = ''; // 清空“思考中”
                    isFirstChunk = false;
                }

                fullText += chunk;

                if (bubble) {
                    // 流式输出时用 Marked 解析 Markdown，用 MathJax 渲染公式
                    if (window.marked) {
                        bubble.innerHTML = window.marked.parse(fullText);
                    } else {
                        bubble.innerHTML = YT.esc(fullText).replace(/\n/g, '<br>');
                    }

                    if (window.MathJax && window.MathJax.typesetPromise) {
                        MathJax.typesetPromise([bubble]).catch(err => console.log('MathJax渲染失败', err));
                    }
                }
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
    }    // ---------- AI 查询群成员 ----------
    // ---------- AI 查询群成员 ----------
    async function triggerGroupMemberAi(triggerMsg, thinkingMsgId) {
        aiLock = true;
        const question = `${triggerMsg.senderName} 说：“${triggerMsg.contents}”。请回答。`;
        let bubble = document.getElementById('typing-ai-bubble-content');
        let fullText = '';

        try {
            const response = await fetch(`/api/private_message/analyze/private/message/member?groupId=${currentGroup.groupId}&question=${encodeURIComponent(question)}`);
            if (!response.ok) throw new Error('网络请求失败');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                if (isFirstChunk) {
                    if (bubble) bubble.innerHTML = ''; // 清空“思考中”
                    isFirstChunk = false;
                }

                fullText += chunk;

                if (bubble) {
                    // 流式输出时用 Marked 解析 Markdown，用 MathJax 渲染公式
                    if (window.marked) {
                        bubble.innerHTML = window.marked.parse(fullText);
                    } else {
                        bubble.innerHTML = YT.esc(fullText).replace(/\n/g, '<br>');
                    }

                    if (window.MathJax && window.MathJax.typesetPromise) {
                        MathJax.typesetPromise([bubble]).catch(err => console.log('MathJax渲染失败', err));
                    }
                }
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
                }
            }
        } catch (e) {
            console.error('AI 查询群成员出错', e);
            if (bubble) bubble.innerText = 'AI 出错了：' + e.message;
        } finally {
            aiLock = false;
            const ghost = document.getElementById('typing-ai-bubble');
            if (ghost) ghost.remove();
        }
    }    // ---------- 轮询 ----------
    // ---------- 轮询 ----------
    async function pollOnce() {
        if (loading || aiLock) return;

        // 1. 同步左侧群聊列表（获取最新加入的群）
        syncMyGroups();

        // ==================== 处理群聊消息轮询 ====================
        if (currentGroup) {
            try {
                const peerId = currentGroup.groupId;

                // 拉取当前打开的这个群的聊天记录
                const r = await YT.api.get('/api/private_message/select/group/message', { groupId: peerId });
                const list = Array.isArray(r.data) ? r.data : [];

                // 格式化数据
                const normList = list.map(m => ({
                    msgId: YT.pick(m, 'msg_id'),
                    fromUser: YT.pick(m, 'from_user'),
                    toUser: peerId,
                    contents: YT.pick(m, 'contents'),
                    msgType: YT.pick(m, 'msg_type') || 'text',
                    mediaPath: YT.pick(m, 'media_path'),
                    createTime: YT.pick(m, 'create_time'),
                    senderName: YT.pick(m, 'senderName', 'sender_name') || (YT.pick(m, 'from_user') === 'AI_BOT' ? 'DeepSeek 助手' : '群友'),
                    senderAvatar: YT.pick(m, 'senderAvatar', 'sender_avatar', 'avatar') || ''
                }));

                // 检查是否有新消息（通过比较最后一条消息的 ID）
                const sig = normList.length + '|' + (normList.length ? normList[normList.length - 1].msgId : '');

                if (sig !== lastGroupChatSig) {
                    const existingIds = new Set(curList.map(x => x.msgId));
                    const newMsgs = normList.filter(m => !existingIds.has(m.msgId));

                    if (newMsgs.length > 0) {
                        // 将新消息追加到界面
                        newMsgs.forEach(m => {
                            if (String(m.fromUser) === 'AI_BOT' && String(m.contents).includes('正在阅读群聊并思考')) {
                                // 处理 AI 思考气泡
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

                        // 更新本地缓存列表
                        curList.push(...newMsgs);
                    }

                    lastGroupChatSig = sig;

                    // 既然我正在看这个群，就把这个群标记为已读
                    setGroupReadTime(peerId);
                    renderMyGroups();

                    // 检查 AI 是否回复完毕，如果完毕就移除思考气泡并解锁
                    const lastMsg = normList[normList.length - 1];
                    if (lastMsg && String(lastMsg.fromUser) === 'AI_BOT' && !String(lastMsg.contents).includes('正在阅读群聊并思考')) {
                        const ghost = document.getElementById('typing-ai-bubble');
                        if (ghost) ghost.remove();
                        if (aiLock) aiLock = false;
                    }
                }
            } catch (e) {
                console.error("群聊轮询失败", e);
            }
            return; // 如果正在看群聊，就不需要执行下面的私信轮询了
        }

        // ==================== 处理私信消息轮询 ====================
        const peerId = current ? current.userId : null;
        if (!peerId) return;

        // 并发请求：获取收件箱、未读数、当前聊天的消息
        const [inboxR, unreadR, chatR] = await Promise.all([
            YT.api.get('/api/private_message/select/inbox', { me: me.userId }).catch(() => null),
            YT.api.get('/api/private_message/count/unread', { me: me.userId }).catch(() => null),
            YT.api.get('/api/private_message/select/message', { a: me.userId, b: peerId }).catch(() => null),
        ]);

        // 处理当前正在聊天的对象
        if (chatR) {
            const list = Array.isArray(chatR.data) ? chatR.data : [];
            const sig = list.length + '|' + (list.length ? (list[list.length - 1].msg_id || list[list.length - 1].msgId) : '');
            if (sig !== lastChatSig) {
                const existingIds = new Set(curList.map(x => String(x.msgId)));
                const newMsgs = list.filter(m => !existingIds.has(String(YT.pick(m, 'msg_id', 'msgId'))));

                if (newMsgs.length > 0) {
                    appendMsgs(newMsgs, false);
                    curList.push(...newMsgs);

                    // 检查是否有 AI_BOT 发来的生日祝福
                    const hasAiBday = newMsgs.some(m =>
                        String(m.fromUser) === 'AI_BOT' &&
                        (String(m.contents).includes('生日') || String(m.contents).includes('快乐'))
                    );
                    if (hasAiBday) {
                        confettiBurst(); // 撒彩带
                    }
                }
                lastChatSig = sig;
                // 标记已读
                try { await YT.api.post('/api/private_message/read', { me: me.userId, other: peerId }); } catch (e) { }
            }
        }

        // 处理左侧私信列表（收件箱）
        // 同样只认数组：轮询偶发拿到错误响应时，不能把本地会话列表刷没
        if (inboxR && Array.isArray(inboxR.data)) {
            const rows = inboxR.data;
            const sig = inboxSig(rows);
            if (sig !== lastInboxSig) {
                lastInboxSig = sig;
                applyInboxRows(rows);
            }
        }

        // 处理左侧标题栏的未读总数
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

    //    私信屏蔽


    // 屏蔽 / 解除屏蔽
    if (btnBlockUser) {
        btnBlockUser.onclick = async () => {
            if (!current) return;
            const peerId = current.userId;
            const peerName = current.name || peerId;
            const isBlocked = blockedPeers.has(peerId);
            const action = isBlocked ? '解除屏蔽' : '屏蔽';
            const url = isBlocked ? '/api/private_message/unblock/pm' : '/api/private_message/block/pm';

            if (!confirm(`确定要${action}【${peerName}】吗？\n${isBlocked ? '解除后对方可以继续给你发私信。' : '屏蔽后对方将无法给你发私信。'}`)) return;

            btnBlockUser.disabled = true;
            try {
                // 后端入参是 upId（屏蔽的人=我）和 userId（被屏蔽的人=对方）
                const r = await YT.api.post(url, { upId: me.userId, userId: peerId });
                if (r && r.success) {
                    if (isBlocked) {
                        blockedPeers.delete(peerId);
                        YT.toast('已解除屏蔽');
                    } else {
                        blockedPeers.add(peerId);
                        YT.toast('已屏蔽，对方无法再给你发私信');
                    }
                    saveBlockedPeers();   // 落 localStorage，刷新页面后状态不丢
                    renderHead();         // 刷新顶部按钮文字
                    renderPeers();        // 刷新左侧列表样式
                } else {
                    YT.toast((r && r.message) || '操作失败');
                }
            } catch (e) {
                YT.toast('网络错误：' + e.message);
            } finally {
                btnBlockUser.disabled = false;
            }
        };
    }


    // ---------- 语音消息：录音 + 发送 ----------
    // 之前按钮只是画在页面上，没有任何点击事件，所以点不动也发不出。
    // 这里用 MediaRecorder 实现：点一次开始录（需授权麦克风），再点一次结束并发送。
    let voiceRecorder = null, voiceChunks = [], voiceRecording = false, voiceStartTs = 0;

    function voiceExtFromMime(mime) {
        const m = String(mime || '').toLowerCase();
        if (m.includes('ogg')) return 'ogg';
        if (m.includes('mp4')) return 'm4a';
        if (m.includes('mpeg')) return 'mp3';
        if (m.includes('wav')) return 'wav';
        return 'webm';
    }

    function chooseVoiceMime() {
        const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus',
                      'audio/mp4', 'audio/x-m4a'];
        for (const m of list) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
        }
        return '';
    }

    function setVoiceBtnState(rec) {
        if (!voiceBtn) return;
        voiceBtn.classList.toggle('on', rec);
        voiceBtn.title = rec ? '停止并发送语音' : '发送语音';
    }

    function startVoiceRec() {
        if (voiceRecording) return;
        if (!window.MediaRecorder) { YT.toast('当前浏览器不支持录音，请改用 Chrome/Edge'); return; }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            YT.toast('浏览器未开放麦克风接口（需 http://localhost 或 https 访问）');
            return;
        }
        if (!(navigator.mediaDevices.getUserMedia && window.isSecureContext)) {
            YT.toast('非安全上下文无法调用麦克风，请通过 localhost 访问页面');
            return;
        }
        voiceBtn.disabled = true;
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            voiceBtn.disabled = false;
            if (voiceRecording) { stream.getTracks().forEach(t => t.stop()); return; }
            let rec;
            try {
                const mime = chooseVoiceMime();
                rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
            } catch (e) {
                stream.getTracks().forEach(t => t.stop());
                YT.toast('初始化录音器失败：' + e.message);
                return;
            }
            voiceChunks = [];
            rec.ondataavailable = e => { if (e.data && e.data.size) voiceChunks.push(e.data); };
            rec.onerror = () => {
                YT.toast('录音出错');
                stream.getTracks().forEach(t => t.stop());
                voiceRecording = false;
                setVoiceBtnState(false);
            };
            rec.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const dur = (Date.now() - voiceStartTs) / 1000;
                const blob = new Blob(voiceChunks, { type: rec.mimeType || 'audio/webm' });
                voiceRecording = false;
                setVoiceBtnState(false);
                if (dur < 0.5 || !blob.size) { YT.toast('录音太短，请按住说两句再发送'); return; }
                const ext = voiceExtFromMime(blob.type);
                // 带当前时间戳，重发不会覆盖旧文件
                const name = 'voice_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '.' + ext;
                const file = new File([blob], name, { type: blob.type || ('audio/' + ext), lastModified: Date.now() });
                sendMedia(file, 'voice');
            };
            voiceRecorder = rec;
            voiceRecording = true;
            voiceStartTs = Date.now();
            try { rec.start(); } catch (e) {
                voiceRecording = false;
                setVoiceBtnState(false);
                stream.getTracks().forEach(t => t.stop());
                YT.toast('开始录音失败：' + e.message);
                return;
            }
            setVoiceBtnState(true);
            YT.toast('正在录音…再次点击麦克风结束并发送');
        }).catch(err => {
            voiceBtn.disabled = false;
            const name = (err && err.name) || '';
            if (name === 'NotAllowedError' || name === 'SecurityError') {
                YT.toast('麦克风权限被拒绝，请在浏览器地址栏🔒里允许麦克风后重试');
            } else if (name === 'NotFoundError') {
                YT.toast('未检测到麦克风设备，请插入麦克风后重试');
            } else {
                YT.toast('无法打开麦克风：' + ((err && err.message) || name || '未知错误'));
            }
        });
    }

    function stopVoiceRec() {
        if (voiceRecorder && voiceRecording && voiceRecorder.state !== 'inactive') {
            try { voiceRecorder.stop(); } catch (e) {}
        }
    }

    if (voiceBtn) voiceBtn.addEventListener('click', () => {
        if (voiceRecording) stopVoiceRec();
        else if (!loading) startVoiceRec();
    });

    ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    sendBtn.addEventListener('click', doSend);
    if (bdayBtn) bdayBtn.addEventListener('click', sendBirthday);

    picBtn.addEventListener('click', () => { picInput.value = ''; picInput.click(); });
    videoBtn.addEventListener('click', () => { videoInput.value = ''; videoInput.click(); });

    picInput.addEventListener('change', () => {
        const f = picInput.files[0];
        picInput.value = '';
        if (f) sendMedia(f, 'image');
    });
    videoInput.addEventListener('change', () => {
        const f = videoInput.files[0];
        videoInput.value = '';
        if (f) sendMedia(f, 'video');
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
            openChat(row.dataset.peer, p ? p.name : '', p ? p.avatar : '');
        }
    });

    if (groupsBox) {
        groupsBox.addEventListener('click', e => {
            const row = e.target.closest('[data-group]');
            if (row) openGroupChat(row.dataset.group, row.dataset.gname);
        });
    }
    // ---------- 查看群成员逻辑 ----------
    const btnViewMembers = document.getElementById('btn-view-members');
    const membersModal = document.getElementById('members-modal');
    const membersListBox = document.getElementById('members-list-box');
    const btnCloseMembers = document.getElementById('close-members-modal');

    if (btnCloseMembers) {
        btnCloseMembers.onclick = () => membersModal.style.display = 'none';
    }
    // 点击遮罩层也可以关闭
    if (membersModal) {
        membersModal.onclick = (e) => {
            if (e.target === membersModal) membersModal.style.display = 'none';
        };
    }

    if (btnViewMembers) {
        btnViewMembers.onclick = async function () {
            if (!currentGroup) return;

            membersModal.style.display = 'flex';
            membersListBox.innerHTML = '<div class="empty" style="padding:10px;">加载中…</div>';

            try {
                // 调用你刚刚写好的后端接口
                const r = await YT.api.get('/api/private_message/select/group/member', {
                    groupId: currentGroup.groupId
                });

                if (r.success && Array.isArray(r.data)) {
                    const members = r.data;
                    if (!members.length) {
                        membersListBox.innerHTML = '<div class="empty" style="padding:10px;">群里空无一人</div>';
                        return;
                    }

                    // 渲染列表（这里用复用的 user-card 样式）
                    membersListBox.innerHTML = members.map(m => {
                        const uid = String(YT.pick(m, 'userId', 'user_id'));
                        const name = String(YT.pick(m, 'nickname', 'nick_name') || uid);
                        const avatar = String(YT.pick(m, 'avatar') || '');
                        const isAI = uid === 'AI_BOT';

                        // AI_BOT 给它一个特殊颜色
                        const avatarStyle = isAI ? 'background:#3ea6ff; color:#fff;' : '';
                        const aiTag = isAI ? ' <span style="font-size:10px; background:var(--link); color:#fff; padding:1px 4px; border-radius:4px; margin-left:4px;">AI</span>' : '';

                        return `
                        <div class="user-card" style="cursor:default;">
                            <span class="avatar" style="${avatarStyle}">
                                ${avatar ? `<img src="${YT.mediaUrl(avatar)}" alt="">` : YT.esc(name.slice(0, 1).toUpperCase())}
                            </span>
                            <div class="uc-txt">
                                <div class="uc-name">${YT.esc(name)}${aiTag}</div>
                                <div class="w-stats">ID: ${YT.esc(uid)}</div>
                            </div>
                        </div>`;
                    }).join('');
                } else {
                    membersListBox.innerHTML = '<div class="empty" style="padding:10px;">获取成员失败</div>';
                }
            } catch (e) {
                membersListBox.innerHTML = `<div class="empty" style="padding:10px;">网络错误：${YT.esc(e.message)}</div>`;
            }
        };
    }
    // ---------- 退出群聊逻辑 ----------
    const btnExitGroup = document.getElementById('btn-exit-group');
    if (btnExitGroup) {
        btnExitGroup.onclick = async function () {
            if (!currentGroup) return;

            if (!confirm(`确定要退出群聊「${currentGroup.groupName}」吗？`)) {
                return;
            }

            btnExitGroup.disabled = true;
            btnExitGroup.textContent = '处理中...';

            try {
                // 调用你刚刚写好的后端退群接口
                const r = await YT.api.post('/api/private_message/exit/group', {
                    groupId: currentGroup.groupId,
                    userId: me.userId
                });

                if (r.success) {
                    YT.toast(r.message || '已退出群聊');

                    // 1. 清理本地缓存中的群信息
                    const newGroups = getMyGroups().filter(g => g.groupId !== currentGroup.groupId);
                    setMyGroups(newGroups);

                    // 2. 清理已读/未读记录
                    localStorage.removeItem('yt_group_read_' + me.userId + '_' + currentGroup.groupId);
                    localStorage.removeItem('yt_group_unread_' + me.userId + '_' + currentGroup.groupId);

                    // 3. 重置当前聊天状态
                    currentGroup = null;
                    renderHead();
                    renderMyGroups();
                    renderPeers();

                    // 4. 清空右侧聊天框
                    msgs.innerHTML = '<div class="empty">你已退出该群聊</div>';
                    sendBtn.disabled = true;
                    ta.disabled = true;
                    ta.placeholder = '已退出群聊';
                } else {
                    YT.toast(r.message || '退群失败');
                }
            } catch (e) {
                YT.toast('网络错误：' + e.message);
            } finally {
                btnExitGroup.disabled = false;
                btnExitGroup.textContent = '退出群聊';
            }
        };
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

    renderPeers();
    renderMyGroups();

    (async () => {
        await Promise.all([loadInbox(), refreshUnread(), syncMyGroups(), loadBlockedFromServer()]);

        //新增：检查 URL 里是否带有 peer 参数（从主页或播放页跳转过来）
        const qs = new URLSearchParams(location.search);
        const peerId = qs.get('peer');
        const peerName = qs.get('name');

        if (peerId) {
            // 清空 URL 参数，防止刷新一直弹
            window.history.replaceState({}, '', 'message.html');
            // 自动打开与对方的聊天窗口
            openChat(peerId, peerName || '');
        }

        schedulePoll();
    })();
})();