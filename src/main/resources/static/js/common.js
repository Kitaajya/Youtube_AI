/* ===== YouTube 仿站 公共工具 =====
 * 后端约定：
 *  - 所有接口返回 Result{code,success,message,data}
 *  - 参数全部是 @RequestParam，因此用 urlencoded / query string 提交
 */
const YT = (() => {
    const KEY = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890';

    // 与后端 RandomlyCreateID 一致的 13 位随机 ID（评论ID、动态ID由前端生成）
    function randId(len = 13) {
        let s = '';
        for (let i = 0; i < len; i++) s += KEY[Math.floor(Math.random() * KEY.length)];
        return s;
    }

    async function request(method, path, params) {
        let url = path, opts = { method };
        if (method === 'GET' || method === 'DELETE') {
            if (params) {
                const q = new URLSearchParams();
                for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q.append(k, v);
                url = path + '?' + q.toString();
            }
        } else {
            const q = new URLSearchParams();
            for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null) q.append(k, String(v));
            opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
            opts.body = q.toString();
        }
        const res = await fetch(url, opts);
        if (!res.ok && res.status === 404) throw new Error('接口不存在(404)：' + url);
        return res.json();
    }

    const api = {
        get: (p, params) => request('GET', p, params),
        post: (p, params) => request('POST', p, params),
        del: (p, params) => request('DELETE', p, params),
    };

    // ---------- 登录态（localStorage，登录后由 login.js 写入） ----------
    function user() {
        const userId = localStorage.getItem('userId');
        if (!userId) return null;
        return { userId, nickname: localStorage.getItem('nickname') || userId };
    }
    // 游客被拦截时记录来源页（当前页路径+query），登录成功后回跳。
    // 用 sessionStorage：新标签页打不开旧来源，也不会在会话间残留。
    const FROM_KEY = 'yt_from';
    // 只接受站内相对路径：拒绝 //evil.com、/\evil.com、http(s)://、data:、javascript: 等形态
    function safeFrom(v) {
        if (typeof v !== 'string' || !v) return '';
        if (v.startsWith('//') || v.startsWith('/\\')) return '';
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return '';   // 任何 scheme（http/https/data/javascript…）
        if (!/^[^/\\]/.test(v)) return '';                     // 必须是 "xxx.html?..." 形式的相对路径
        if (v.startsWith('login') || v.startsWith('register')) return ''; // 来源不能是登录/注册页自身
        return v;
    }
    function currentPath() {
        return location.pathname.replace(/^.*\//, '') + location.search + location.hash;
    }
    function requireLogin(msg) {
        if (user()) return true;
        try { sessionStorage.setItem(FROM_KEY, currentPath()); } catch (e) { /* 隐私模式忽略 */ }
        toast(msg || '请先登录');
        setTimeout(() => { location.href = 'login.html'; }, 600);
        return false;
    }
    function logout() {
        localStorage.removeItem('userId');
        localStorage.removeItem('nickname');
        location.href = 'index.html';
    }

    // ---------- 小工具 ----------
    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    // Map 返回的列名可能是下划线或驼峰（取决于 MyBatis 配置），统一归一化后取值
    function norm(k) {
        return String(k).replace(/_([a-z0-9])/g, (m, c) => c.toUpperCase()).toLowerCase();
    }
    function pick(obj, ...keys) {
        if (!obj) return '';
        const map = {};
        for (const [k, v] of Object.entries(obj)) map[norm(k)] = v;
        for (const k of keys) {
            const v = map[norm(k)];
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return '';
    }
    // 把数据库里存的本地绝对路径转成可访问的播放 URL
    // 后端已把 /videos/** 映射到配置的视频目录，因此取文件名拼到该前缀下即可
    function mediaUrl(p) {
        p = String(p || '').trim();
        if (!p) return '';
        if (/^(https?:|blob:|data:|\/videos\/)/i.test(p)) return p;
        const name = p.split(/[\\/]/).pop().replace(/[?#].*$/, '');
        return name ? '/videos/' + encodeURIComponent(name) : '';
    }
    // 视频封面：能取到播放地址时用视频首帧，取不到时退回纯色占位
    // 视频封面：优先用 cover_path（用户选的帧），没有则回退到视频首帧
    //就这一个函数。 首页/侧栏/搜索的结果都会自动优先显示封面。
    function thumb(v, extraCls) {
        const cls = 'thumb ' + (extraCls || '');
        const ic = '<div class="play-ic"></div>';

        const cover = pick(v, 'cover_path', 'coverPath');
        if (cover) {
            return `<div class="${cls}"><img src="${mediaUrl(cover)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;">${ic}</div>`;
        }

        const url = mediaUrl(pick(v, 'video_path', 'videoPath'));
        return url
            ? `<div class="${cls}"><video muted preload="metadata" playsinline src="${url}#t=0.1"></video>${ic}</div>`
            : `<div class="${cls}">&#9654;${ic}</div>`;
    }

    function timeAgo(t) {
        if (!t) return '';
        const d = new Date(String(t).replace(' ', 'T'));
        if (isNaN(d)) return '';
        const s = (Date.now() - d.getTime()) / 1000;
        if (s < 60) return '刚刚';
        if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
        if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
        if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
        if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + ' 个月前';
        return Math.floor(s / (86400 * 365)) + ' 年前';
    }
    function fmtNum(n) {
        n = Number(n || 0);
        if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + ' 万';
        return String(n);
    }
    function fmtFull(t) {
        if (!t) return '';
        const d = new Date(String(t).replace(' ', 'T'));
        if (isNaN(d)) return String(t);
        const p = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    let toastTimer = null;
    function toast(msg) {
        let el = document.getElementById('yt-toast');
        if (!el) { el = document.createElement('div'); el.id = 'yt-toast'; document.body.appendChild(el); }
        el.textContent = msg;
        el.style.display = 'block';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.style.display = 'none', 2600);
    }

    // ---------- 左侧导航栏图标 ----------
    const IC = {
        menu: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
        home: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 3.2 3.5 10.5V21h6v-6h5v6h6V10.5z"/></svg>',
        shorts: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M10.2 2.2 4.6 13.4h4.3L7.6 21.8l8.6-11.6h-4.5l1.4-8z"/></svg>',
        subs: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M6 4h13a2 2 0 0 1 2 2"/><path d="M10.8 10.6v4.8l4.2-2.4z" fill="currentColor" stroke="none"/></svg>',
        you: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/></svg>',
        history: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v5l3.5 2"/><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3 8.5"/><path d="M3 3.5v5h5"/></svg>',
        music: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="7" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M10 18V5l11-2v13"/></svg>',
        live: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2"/></svg>',
        gaming: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 9h10a4 4 0 0 1 4 3.6l.5 4.2a2.2 2.2 0 0 1-3.9 1.6L15.9 16H8.1l-1.7 2.4a2.2 2.2 0 0 1-3.9-1.6L3 12.6A4 4 0 0 1 7 9z"/><path d="M7.5 12.5v2.5M6.25 13.75h2.5"/><circle cx="16" cy="13" r=".6" fill="currentColor"/><circle cx="18" cy="15" r=".6" fill="currentColor"/></svg>',
        chev: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M7.4 9.6 12 14.2l4.6-4.6L18 11l-6 6-6-6z"/></svg>',
        kids: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10.5 9.3v5.4l4.5-2.7z" fill="currentColor" stroke="none"/></svg>',
        flag: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h12.5l-2.6 4 2.6 4H5"/></svg>',
        grid: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
        search: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="M16 16l4.5 4.5"/></svg>',
        mic: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
        bell: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10a6 6 0 0 1 12 0c0 4.2 1.6 5.6 1.6 5.6H4.4S6 14.2 6 10"/><path d="M10.2 19h3.6"/></svg>',
        like:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19"/><path d="M4 10.5h3V19H4z"/></svg>',
        liked: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19" fill="none"/><path d="M4 10.5h3V19H4z"/></svg>',

        // 专属于通知的图标
        cmtLike: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--link);"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19"/><path d="M4 10.5h3V19H4z"/></svg>',
        vidLike: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--link);"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19"/><path d="M4 10.5h3V19H4z"/></svg>'
    };

    // ---------- 消息提醒（顶栏铃铛）----------
    const NT_PAGE_SIZE = 20;
    const NT_POLL_MS = 5000;
    const NT_TYPE = {
        like:           { icon: IC.vidLike, label: '赞了你的视频' },
        comment_like:   { icon: IC.cmtLike, label: '赞了你的评论' },
        comment:        { icon: '\u{1F4AC}', label: '评论了你的视频' },
        reply:          { icon: '\u21A9\uFE0F', label: '回复了你的评论' },
        favorite:       { icon: '\u{1F516}', label: '收藏了你的视频' },
        follow:         { icon: '\u{1F464}', label: '关注了你' },
    };
    let ntTimer = null, ntBusy = false, ntStarted = false, ntOpen = false, ntLastSig = '';

    async function ntFetch() {
        const u = user();
        if (!u) return [];
        const r = await api.get('/api/video/notify', { me: u.userId, size: NT_PAGE_SIZE, offset: 0 });
        const rows = (r && r.data) || [];
        return Array.isArray(rows) ? rows : [];
    }

    function ntSig(rows) {
        return rows.map(n => [pick(n, 'notify_id'), pick(n, 'is_read')].join('|')).join(';');
    }

    function ntRow(n) {
        const type = String(pick(n, 'type') || '');
        const t = NT_TYPE[type] || { icon: '\u{1F514}', label: '有一条新消息' };
        const who = String(pick(n, 'nickname') || pick(n, 'from_user') || '有人');
        const vid = pick(n, 'video_id', 'videoId');
        const fromId = String(pick(n, 'from_user') || '');

        let href = '';
        if (type === 'follow') {
            href = fromId ? 'profile.html?userId=' + encodeURIComponent(fromId) + '&name=' + encodeURIComponent(who) : '';
        } else if (vid) {
            href = 'watch.html?id=' + encodeURIComponent(vid);
        }

        const isAnon = (type === 'favorite');
        const whoHtml = isAnon ? '' : `<b>${esc(who)}</b> `;

        const unread = Number(pick(n, 'is_read') || 0) === 0;
        let text = String(pick(n, 'contents') || '').trim();

        // 去重：如果通知内容开头有 "@对方昵称 "，把它切掉
        if (text.startsWith('@' + who)) {
            text = text.substring(who.length + 1).trim();
        }

        return `
        <div class="nt-item ${unread ? 'unread' : ''}"${href ? ` data-href="${esc(href)}"` : ''}>
            <span class="nt-ic" style="display:flex; align-items:center; justify-content:center;">${t.icon}</span>
            <div class="nt-txt">
                <div class="nt-line">${whoHtml}${esc(text || t.label)}</div>
                <div class="nt-time">${esc(timeAgo(pick(n, 'create_time')) || '')}</div>
            </div>
        </div>`;
    }

    async function ntRefresh(force) {
        let rows;
        try { rows = await ntFetch(); } catch (e) { return; /* 后端不可用时保持现状 */ }
        const sig = ntSig(rows);
        if (!force && sig === ntLastSig) return;
        ntLastSig = sig;
        const unread = rows.filter(n => Number(pick(n, 'is_read') || 0) === 0).length;
        const badge = document.getElementById('nt-badge');
        if (badge) {
            badge.textContent = unread > 99 ? '99+' : String(unread);
            badge.style.display = unread > 0 ? '' : 'none';
        }
        // 面板没打开就不渲染列表，省掉无谓的 DOM 写入
        const list = document.getElementById('nt-list');
        if (list && ntOpen) {
            list.innerHTML = rows.length ? rows.map(ntRow).join('')
                : '<div class="nt-empty">暂无消息提醒</div>';
        }
    }

    function ntSchedule() {
        if (document.hidden) { ntTimer = null; return; }
        ntTimer = setTimeout(async () => {
            if (!ntBusy && !document.hidden) {
                ntBusy = true;
                try { await ntRefresh(false); } catch (e) { /* 单轮失败不中断轮询 */ }
                finally { ntBusy = false; }
            }
            ntSchedule();
        }, NT_POLL_MS);
    }

    function ntBind() {
        const btn = document.getElementById('nt-btn');
        const panel = document.getElementById('nt-panel');
        const list = document.getElementById('nt-list');
        if (!btn || !panel || !list) return;
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            ntOpen = !ntOpen;
            panel.classList.toggle('open', ntOpen);
            if (ntOpen) {
                list.innerHTML = '<div class="nt-empty">加载中…</div>';
                await ntRefresh(true);

                const u = user();
                if (u) {
                    try {
                        await api.post('/api/video/notify/read/all', { me: u.userId });
                    } catch (err) { /* 标记失败不影响查看 */ }

                    const badge = document.getElementById('nt-badge');
                    if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }

                    await ntRefresh(true);
                }
            }
        });
        panel.addEventListener('click', e => e.stopPropagation());
        list.addEventListener('click', e => {
            const item = e.target.closest('[data-href]');
            if (item) location.href = item.dataset.href;
        });
        if (!ntStarted) {
            ntStarted = true;
            document.addEventListener('click', () => {
                if (!ntOpen) return;
                ntOpen = false;
                const p = document.getElementById('nt-panel');
                if (p) p.classList.remove('open');
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (ntTimer) { clearTimeout(ntTimer); ntTimer = null; }
                } else if (!ntTimer) {
                    ntRefresh(false).catch(() => { /* 忽略 */ });
                    ntSchedule();
                }
            });
        }
        ntRefresh(false).catch(() => { /* 忽略 */ });
        if (!ntTimer) ntSchedule();
    }

    // 侧栏展开/收起状态（mini = 72px 图标窄栏，hide = 完全隐藏）
    function applySb(m) {
        document.documentElement.setAttribute('data-sb', m);
        try { localStorage.setItem('yt-sb', m); } catch (e) { /* 隐私模式忽略 */ }
    }
    try {
        const m0 = localStorage.getItem('yt-sb');
        const def = window.innerWidth <= 1100 ? 'hide' : 'full';
        document.documentElement.setAttribute('data-sb',
            (m0 === 'mini' || m0 === 'hide' || m0 === 'full') ? m0 : def);
    } catch (e) { document.documentElement.setAttribute('data-sb', 'full'); }

    // ---------- 侧栏 HTML ----------
    function sidebarHtml(u) {
        const page = (location.pathname.match(/[^/]+\.html/i) || ['index.html'])[0].toLowerCase();
        const isHome = page === 'index.html';
        const isYou = page === 'profile.html';
        const isHistory = page === 'history.html';
        const isShorts = page === 'shorts.html';
        const item = (icon, label, opts) => {
            opts = opts || {};
            let h = '<a class="sb-item' + (opts.active ? ' active' : '') + '"';
            if (opts.href) h += ' href="' + opts.href + '"';
            if (opts.toast) h += ' data-toast="' + esc(opts.toast) + '"';
            h += ' title="' + esc(label) + '">' + icon + '<span class="sb-lbl">' + esc(label) + '</span></a>';
            return h;
        };
        const rail = '<div class="sb-rail">'
            + item(IC.home, '首页', { href: 'index.html', active: isHome })
            + item(IC.shorts, 'Shorts', { href: 'shorts.html', active: isShorts })
            + item(IC.you, '你', { href: 'profile.html', active: isYou })
            + item(IC.history, '历史', { href: 'history.html', active: isHistory })
            + '</div>';
        const more = ['科技', '美食', '旅行', '电影', '军事'].map(c =>
            item(IC.grid, c, { href: 'index.html?q=' + encodeURIComponent(c) })).join('');
        return rail + '<div class="sb-hide">'
            + '<div class="sb-sec">'
            + item(IC.home, '首页', { href: 'index.html', active: isHome })
            + item(IC.shorts, 'Shorts', { href: 'shorts.html', active: isShorts })
            + item(IC.subs, '订阅', { href: 'profile.html' })
            + item(IC.you, '你', { href: 'profile.html', active: isYou })
            + item(IC.history, '历史', { href: 'history.html', active: isHistory })
            + '</div>'
            + (u ? '' : '<div class="sb-sec sb-guest">登录后可点赞、评论和订阅。<br><a href="login.html" class="btn sm sb-signin">' + IC.you + '登录</a></div>')
            + '<div class="sb-sec"><div class="sb-h">探索</div>'
            + item(IC.music, '音乐', { href: 'index.html?q=' + encodeURIComponent('音乐') })
            + item(IC.live, '直播', { href: 'index.html?q=' + encodeURIComponent('直播') })
            + item(IC.gaming, '游戏', { href: 'index.html?q=' + encodeURIComponent('游戏') })
            + '<a class="sb-item" id="yt-sb-more">' + IC.chev + '<span class="sb-lbl">显示更多</span></a>'
            + '<div class="sb-more-items" id="yt-sb-more-list">' + more + '</div>'
            + '</div>'
            + '<div class="sb-sec"><div class="sb-h">YouTube 的更多产品</div>'
            + item(IC.kids, 'YouTube Kids', { toast: 'YouTube Kids 暂未开放' })
            + '</div>'
            + '<div class="sb-sec">'
            + item(IC.flag, '举报历史', { toast: '举报历史暂未开放' })
            + '</div>'
            + '</div>';
    }

    // ---------- 侧栏挂载与交互 ----------
    function renderSidebar(u) {
        let nav = document.getElementById('app-sidebar');
        if (!nav) {
            nav = document.createElement('nav');
            nav.id = 'app-sidebar';
            nav.className = 'sb';
            document.body.prepend(nav);
        }
        nav.innerHTML = sidebarHtml(u);
        document.documentElement.classList.add('has-sb');

        // 未开放项：点击给提示，不跳页
        nav.querySelectorAll('[data-toast]').forEach(el => {
            el.addEventListener('click', e => { e.preventDefault(); toast(el.dataset.toast); });
        });
        const moreBtn = document.getElementById('yt-sb-more');
        const moreList = document.getElementById('yt-sb-more-list');
        if (moreBtn && moreList) {
            moreBtn.addEventListener('click', e => {
                e.preventDefault();
                const open = moreList.classList.toggle('open');
                moreBtn.querySelector('.sb-lbl').textContent = open ? '显示更少' : '显示更多';
                moreBtn.classList.toggle('up', open);
            });
        }
    }

    function bindSbToggle() {
        const btn = document.getElementById('yt-sb-btn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-sb');
            // full → mini → 隐藏 → full（窄屏下直接在展开/隐藏间切换）
            if (window.innerWidth <= 1100) {
                applySb(cur === 'hide' ? 'full' : 'hide');
            } else if (cur === 'mini') {
                applySb('hide');
            } else if (cur === 'hide') {
                applySb('full');
            } else {
                applySb('mini');
            }
        });
    }

    // ---------- 顶栏渲染 ----------
    function renderHeader() {
        const box = document.getElementById('app-header');
        if (!box) return;
        const u = user();
        const q = new URLSearchParams(location.search).get('q') || '';
        box.innerHTML = `
        <header class="hd">
            <button class="icon-btn" id="yt-sb-btn" type="button" title="菜单">${IC.menu}</button>
            <a class="logo" href="index.html">
                <svg viewBox="0 0 90 20" height="20"><path d="M27.97 3.12A3.51 3.51 0 0 0 25.5.64C23.27.07 14.6.07 14.6.07S5.93.07 3.7.64A3.51 3.51 0 0 0 1.23 3.12C.66 5.35.66 10 .66 10s0 4.65.57 6.88a3.51 3.51 0 0 0 2.47 2.48c2.23.57 10.9.57 10.9.57s8.67 0 10.9-.57a3.51 3.51 0 0 0 2.47-2.48c.57-2.23.57-6.88.57-6.88s0-4.65-.57-6.88z" fill="#FF0000"/><path d="M11.73 14.29L19.06 10l-7.33-4.29z" fill="#fff"/></svg>
                <span>YouTube</span><sup class="logo-cc">CN</sup>
            </a>
            <form class="search" id="yt-search">
                <input id="yt-search-input" placeholder="搜索" value="${esc(q)}">
                <button type="submit" title="搜索">${IC.search}</button>
            </form>
            <button class="icon-btn" id="yt-mic" type="button" title="语音搜索">${IC.mic}</button>
            <div class="hd-right">
                ${typeof YT_THEME !== 'undefined' ? YT_THEME.toggleHtml() : ''}
                ${u ? `
                    <a href="upload.html" class="icon-btn" title="上传视频">&#8679;</a>
                    <a href="dynamic.html" class="icon-btn" title="动态">&#9993;</a>
                    <div class="nt-wrap">
                        <button class="icon-btn" id="nt-btn" title="消息提醒">${IC.bell}<span class="nt-badge" id="nt-badge" style="display:none;">0</span></button>
                        <div class="nt-panel" id="nt-panel">
                            <div class="nt-head">消息提醒</div>
                            <div class="nt-list" id="nt-list"><div class="nt-empty">加载中…</div></div>
                        </div>
                    </div>
                    <div class="menu-wrap">
                        <button class="icon-btn" id="yt-menu-btn" style="width:auto;padding:0 4px;">
                            <span class="avatar">${esc((u.nickname || u.userId).slice(0, 1).toUpperCase())}</span>
                        </button>
                        <div class="menu" id="yt-menu">
                            <div class="m-name">${esc(u.nickname)}<br><span style="color:var(--text-tertiary);font-size:12px;">ID: ${esc(u.userId)}</span></div>
                            <a href="profile.html">我的频道</a>
                            <a href="message.html">私信</a>
                            <a href="upload.html">上传视频</a>
                            <a href="dynamic.html">我的动态</a>
                            <button id="yt-logout">退出登录</button>
                        </div>
                    </div>`
            : `<a href="login.html" class="btn primary">登录</a>
                   <a href="register.html" class="btn">注册</a>`}
            </div>
        </header>`;

        document.getElementById('yt-search').addEventListener('submit', e => {
            e.preventDefault();
            const kw = document.getElementById('yt-search-input').value.trim();
            location.href = kw ? 'index.html?q=' + encodeURIComponent(kw) : 'index.html';
        });
        renderSidebar(u);
        const mic = document.getElementById('yt-mic');

        //新增语音功能，便于搜索
        if (mic) {
            mic.addEventListener('click', async () => {
                // Web Speech API 兼容检测
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    // 浏览器不支持 -> 提示并可选择回退到录音上传
                    return YT.toast('当前浏览器不支持语音识别，建议使用 Chrome；或启用「录音上传」回退功能（开发中）。');
                }

                const inputEl = document.getElementById('yt-search-input');
                const form = document.getElementById('yt-search');
                const rec = new SpeechRecognition();
                rec.lang = 'zh-CN';         // 根据需要设置识别语言
                rec.interimResults = true;  // 显示临时结果（可选）
                rec.maxAlternatives = 1;
                let finalText = '';

                // 可选：改变按钮样式以表示正在录音
                mic.classList.add('listening');
                YT.toast('请开始说话…');

                rec.onresult = (ev) => {
                    let interim = '';
                    for (let i = ev.resultIndex; i < ev.results.length; i++) {
                        const r = ev.results[i];
                        if (r.isFinal) finalText += r[0].transcript;
                        else interim += r[0].transcript;
                    }
                    // 把临时/最终识别结果显示在输入框（不自动提交，用户可编辑）
                    inputEl.value = (finalText + interim).trim();
                };

                rec.onerror = (e) => {
                    mic.classList.remove('listening');
                    YT.toast('语音识别出错：' + (e.error || e.message || '未知错误'));
                };

                rec.onend = () => {
                    mic.classList.remove('listening');
                    // 识别结束后，如果有结果就提交搜索
                    if (inputEl.value && inputEl.value.trim()) {
                        // 自动跳转到搜索结果页面（与已有搜索一致）
                        const kw = inputEl.value.trim();
                        location.href = kw ? 'index.html?q=' + encodeURIComponent(kw) : 'index.html';
                    } else {
                        YT.toast('未识别到有效文本');
                    }
                };

                try {
                    rec.start();
                } catch (err) {
                    mic.classList.remove('listening');
                    YT.toast('无法开始语音识别：' + err.message);
                }
            });
        }

        const btn = document.getElementById('yt-menu-btn');
        if (btn) {
            const menu = document.getElementById('yt-menu');
            btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
            document.addEventListener('click', () => menu.classList.remove('open'));
            document.getElementById('yt-logout').addEventListener('click', logout);
        }
        if (typeof YT_THEME !== 'undefined') YT_THEME.bind();
        bindSbToggle();
        ntBind();          // 铃铛只在登录态下渲染出来，未登录时函数内部自动跳过
    }

    document.addEventListener('DOMContentLoaded', renderHeader);

    return { api, randId, user, requireLogin, logout, esc, pick, mediaUrl, thumb, timeAgo, fmtNum,
        fmtFull, toast, safeFrom, currentPath, FROM_KEY, IC };})();
//截止2026/10/16/8:34，我已经修复了通知红点bug，以上的红点bug注释作废
//2026/10/21/14:48 修复通知图标丢失及文字重复问题