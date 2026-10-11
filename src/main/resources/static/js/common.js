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
    function thumb(v, extraCls) {
        const url = mediaUrl(pick(v, 'video_path', 'videoPath'));
        const cls = 'thumb ' + (extraCls || '');
        const ic = '<div class="play-ic"></div>';
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

    // ---------- 顶栏渲染 ----------
    function renderHeader() {
        const box = document.getElementById('app-header');
        if (!box) return;
        const u = user();
        const q = new URLSearchParams(location.search).get('q') || '';
        box.innerHTML = `
        <header class="hd">
            <a class="logo" href="index.html">
                <svg viewBox="0 0 90 20" height="20"><path d="M27.97 3.12A3.51 3.51 0 0 0 25.5.64C23.27.07 14.6.07 14.6.07S5.93.07 3.7.64A3.51 3.51 0 0 0 1.23 3.12C.66 5.35.66 10 .66 10s0 4.65.57 6.88a3.51 3.51 0 0 0 2.47 2.48c2.23.57 10.9.57 10.9.57s8.67 0 10.9-.57a3.51 3.51 0 0 0 2.47-2.48c.57-2.23.57-6.88.57-6.88s0-4.65-.57-6.88z" fill="#FF0000"/><path d="M11.73 14.29L19.06 10l-7.33-4.29z" fill="#fff"/></svg>
                <span>YouTube</span>
            </a>
            <form class="search" id="yt-search">
                <input id="yt-search-input" placeholder="搜索视频" value="${esc(q)}">
                <button type="submit" title="搜索">&#128269;</button>
            </form>
            <div class="hd-right">
                ${typeof YT_THEME !== 'undefined' ? YT_THEME.toggleHtml() : ''}
                ${u ? `
                    <a href="upload.html" class="icon-btn" title="上传视频">&#8679;</a>
                    <a href="dynamic.html" class="icon-btn" title="动态">&#9993;</a>
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
        const btn = document.getElementById('yt-menu-btn');
        if (btn) {
            const menu = document.getElementById('yt-menu');
            btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
            document.addEventListener('click', () => menu.classList.remove('open'));
            document.getElementById('yt-logout').addEventListener('click', logout);
        }
        if (typeof YT_THEME !== 'undefined') YT_THEME.bind();
    }

    document.addEventListener('DOMContentLoaded', renderHeader);

    return { api, randId, user, requireLogin, logout, esc, pick, mediaUrl, thumb, timeAgo, fmtNum, fmtFull, toast, safeFrom, currentPath, FROM_KEY };
})();
