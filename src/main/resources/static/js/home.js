/* 首页：视频流 + 搜索（游客模式：未登录也能浏览与搜索）
 * 数据源：
 *  GET /api/video/select/videos/upinfor  全部视频+UP主信息
 *  GET /api/video/select/like?keyword=   模糊搜索
 */
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
        const likes = YT.pick(v, 'like_count');
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
