/* 频道页（仿 YouTube 频道布局）：profile.html[?userId=xxx&name=yyy]
 * 不带参数 = 我的频道；带 userId = 看别人（从播放页 UP 主进入时可用）
 * 布局：横幅 → 居中头像+名称+订阅数/视频数+简介+关注按钮 → 标签栏（首页/视频/关注与粉丝）
 *   首页 = 精选大卡（最新一条）+ 其余网格；视频 = 列表视图（保留改标题/删除操作）
 * GET /api/video/select?userId=      该用户的视频
 * POST /api/video/edit/title         改自己视频标题
 * DEL  /api/video/delete/videos      删自己视频
 * 关注模块（后端 /api/user）：
 * GET  /select/me/fans?me=他     TA 的粉丝列表（长度=粉丝数；含我 userId=我已关注）
 * GET  /select/me/follow?me=他   TA 关注的人（长度=关注数）
 * POST /follow   (me,upId)       关注
 * POST /unfollow (me,upId)       取关
 */
(async function () {
    const me = YT.user();
    const qs = new URLSearchParams(location.search);
    const userId = qs.get('userId') || (me && me.userId);
    if (!userId) { YT.requireLogin('登录后访问你的频道'); return; }
    const isMine = !!me && userId === me.userId;
    const name = qs.get('name') || (isMine ? (me && me.nickname) : 'UP主');

    const $ = s => document.querySelector(s);
    $('#ch-name').textContent = name || 'UP主';
    $('#ch-id').textContent = '@' + userId;
    $('#ch-av').textContent = String(name || userId).slice(0, 1).toUpperCase();
    document.title = (name || '频道') + ' - YouTube';
    if (isMine) $('#ch-upload').style.display = '';

    // ---------- 标签栏：首页 / 视频 / 收藏夹 / 关注与粉丝 ----------
    const panels = { home: $('#panel-home'), videos: $('#panel-videos'), plays: $('#panel-plays'), social: $('#panel-social') };
    let activeTab = 'home';
    function switchTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.ch-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        for (const [k, el] of Object.entries(panels)) el.style.display = k === tab ? '' : 'none';
        if (tab === 'plays') loadPlaylists();
    }
    document.querySelectorAll('.ch-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // ---------- 关注模块 ----------
    // 后端只有"粉丝列表/关注列表"两个查询接口，没有计数接口，
    // 所以粉丝数、关注数由列表长度推导，"我是否已关注 TA"= TA 的粉丝列表里有没有我
    let following = false;
    let fansCount = 0;
    let followCount = 0;
    let followBusy = false;
    let followers = [];      // 关注 TA 的人（TA 的粉丝）
    let followings = [];     // TA 关注的人
    let videoCount = 0;
    const followBtn = $('#ch-follow'), chStats = $('#ch-stats');

    function paintFollow() {
        followBtn.classList.toggle('subscribed', following);
        followBtn.innerHTML = following ? '已关注' : '关注';
        followBtn.disabled = followBusy;
    }
    // 仿 YouTube 的 "@handle · 订阅数 · 视频数" 一行
    function paintStats() {
        const parts = [];
        if (fansCount > 0) parts.push(`${YT.fmtNum(fansCount)} 位粉丝`);
        if (videoCount > 0) parts.push(`${YT.fmtNum(videoCount)} 个视频`);
        chStats.textContent = parts.join(' · ');
    }

    // 关注/粉丝列表卡片：点击跳到那个人的频道（复用本页 ?userId= 的入参形式）
    function userCard(u) {
        const uid = String(YT.pick(u, 'user_id'));
        const nm = String(YT.pick(u, 'nickname') || uid);
        return `
        <div class="user-card" data-user="${YT.esc(uid)}" data-name="${YT.esc(nm)}">
            <span class="avatar">${YT.esc(nm.slice(0, 1).toUpperCase())}</span>
            <div class="uc-txt">
                <div class="uc-name">${YT.esc(nm)}</div>
                <div class="w-stats">ID: ${YT.esc(uid)}${YT.timeAgo(YT.pick(u, 'follow_time')) ? ' · ' + YT.timeAgo(YT.pick(u, 'follow_time')) : ''}</div>
            </div>
        </div>`;
    }

    function renderSocial() {
        $('#sc-follow-title').textContent = `关注 · ${followings.length}`;
        $('#sc-fans-title').textContent = `粉丝 · ${followers.length}`;
        $('#sc-follow').innerHTML = followings.length
            ? followings.map(userCard).join('')
            : '<div class="w-stats">还没有关注任何人</div>';
        $('#sc-fans').innerHTML = followers.length
            ? followers.map(userCard).join('')
            : '<div class="w-stats">还没有粉丝</div>';
    }

    // 一次拉全：两个列表 → 计数 + 关注状态 + 列表渲染
    async function loadSocial() {
        try {
            const [fansR, followR] = await Promise.all([
                YT.api.get('/api/user/select/me/fans', { me: userId }),
                YT.api.get('/api/user/select/me/follow', { me: userId }),
            ]);
            followers = (fansR && fansR.data) || [];
            followings = (followR && followR.data) || [];
        } catch (e) { return; /* 拉不到就不显示数字，不影响看视频 */ }
        fansCount = followers.length;
        followCount = followings.length;
        following = !!me && followers.some(f => String(YT.pick(f, 'user_id')) === me.userId);
        paintFollow();
        paintStats();
        renderSocial();
    }

    if (!isMine) {
        followBtn.style.display = '';
        paintFollow();
    }
    loadSocial();

    // 列表里点某个用户 → 进 TA 的频道
    document.addEventListener('click', e => {
        const card = e.target.closest('.user-card');
        if (!card) return;
        location.href = 'profile.html?userId=' + encodeURIComponent(card.dataset.user)
            + '&name=' + encodeURIComponent(card.dataset.name);
    });

    // ---------- 收藏夹模块（后端 /api/video/select/like/format*） ----------
    // viewer 传空串时 SQL 只放行 is_public=1 的夹子：看别人的频道自然只看到公开收藏夹
    async function loadPlaylists() {
        const grid = $('#pl-grid'), plEmpty = $('#pl-empty'), plDetail = $('#pl-detail');
        grid.innerHTML = '<div class="empty" style="padding:20px;">加载中…</div>';
        plEmpty.style.display = 'none';
        plDetail.innerHTML = '';
        let rows = [];
        try {
            const r = await YT.api.get('/api/video/select/like/format', {
                owner: userId, viewer: me ? me.userId : '', videoId: 0,
            });
            rows = r.data || [];
        } catch (e) {
            grid.innerHTML = '';
            plEmpty.textContent = '收藏夹加载失败：' + e.message;
            plEmpty.style.display = 'block';
            return;
        }
        if (!rows.length) {
            grid.innerHTML = '';
            plEmpty.textContent = isMine ? '还没有创建收藏夹（去任意视频页点"收藏"建一个）' : '这位UP主没有公开收藏夹';
            plEmpty.style.display = 'block';
            return;
        }
        grid.innerHTML = rows.map(p => {
            const pid = String(YT.pick(p, 'playlist_id'));
            const pub = Number(YT.pick(p, 'is_public') || 0) > 0;
            return `
            <div class="pl-card" data-pid="${YT.esc(pid)}" data-name="${YT.esc(YT.pick(p, 'name'))}">
                <div class="pl-cover">
                    <span class="pl-ic">&#9654;</span>
                    <span class="pl-count">${YT.fmtNum(YT.pick(p, 'video_count') || 0)}</span>
                </div>
                <div class="pl-body">
                    <div class="pl-name">${YT.esc(YT.pick(p, 'name'))}</div>
                    <div class="pl-sub">
                        <span class="pl-tag ${pub ? '' : 'private'}">${pub ? '&#127760; 公开' : '&#128274; 私密'}</span>
                        <span>${YT.timeAgo(YT.pick(p, 'create_time')) || YT.fmtFull(YT.pick(p, 'create_time'))}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // 点收藏夹卡片 → 展开夹内视频
    document.addEventListener('click', async e => {
        const card = e.target.closest('.pl-card');
        if (!card) return;
        const detail = $('#pl-detail');
        detail.innerHTML = `<div class="ch-col-title">${YT.esc(card.dataset.name)}</div><div class="empty" style="padding:20px;">加载中…</div>`;
        try {
            const r = await YT.api.get('/api/video/select/like/format/videos', { pList: card.dataset.pid });
            const vids = r.data || [];
            detail.innerHTML = `<div class="ch-col-title">${YT.esc(card.dataset.name)} · ${vids.length}</div>` + (vids.length
                ? `<div class="ch-grid">` + vids.map(v => {
                    const url = YT.mediaUrl(YT.pick(v, 'video_path'));
                    return `
                    <div class="ch-card" onclick="location.href='watch.html?id=${encodeURIComponent(YT.pick(v, 'id'))}'">
                        <div class="thumb">${url
                            ? `<video muted preload="metadata" playsinline src="${url}#t=0.1"></video>`
                            : '<div style="display:flex;align-items:center;justify-content:center;height:100%;">&#9654;</div>'}</div>
                        <div class="c-title">${YT.esc(YT.pick(v, 'title'))}</div>
                        <div class="c-sub">${YT.fmtNum(YT.pick(v, 'view_count'))} 次观看 · 收藏于 ${YT.timeAgo(YT.pick(v, 'fav_time')) || YT.fmtFull(YT.pick(v, 'fav_time'))}</div>
                    </div>`;
                }).join('') + `</div>`
                : '<div class="w-stats">这个收藏夹还是空的</div>');
            detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            detail.innerHTML = '<div class="w-stats">加载失败</div>';
        }
    });

    if (!isMine) {
        followBtn.onclick = async () => {
            if (!YT.requireLogin()) return;
            if (followBusy) return;
            followBusy = true;
            paintFollow();
            const wasFollowing = following;
            try {
                const url = wasFollowing ? '/api/user/unfollow' : '/api/user/follow';
                const r = await YT.api.post(url, { me: me.userId, upId: userId });
                if (r.success) {
                    YT.toast(r.message || (wasFollowing ? '已取关' : '关注成功'));
                    // 重新拉一次：列表区块和计数都要跟着变（我自己新增了/少了 TA 的关注）
                    await loadSocial();
                } else {
                    YT.toast(r.message || '操作失败，请重试');
                }
            } catch (e) {
                YT.toast('请求失败：' + e.message);
            } finally {
                followBusy = false;
                paintFollow();
            }
        };
    }

    // ---------- 视频 ----------
    const listBox = $('#vlist'), empty = $('#empty');
    listBox.innerHTML = '<div class="empty" style="padding:20px;">加载中…</div>';

    let list = [];
    try {
        const r = await YT.api.get('/api/video/select', { userId });
        list = r.data || [];
    } catch (e) {
        listBox.innerHTML = '';
        $('#ch-feature').innerHTML = '';
        $('#ch-grid').innerHTML = '';
        empty.textContent = '加载失败：' + e.message;
        empty.style.display = 'block';
        return;
    }
    videoCount = list.length;
    paintStats();

    if (!list.length) {
        listBox.innerHTML = '';
        $('#ch-feature').innerHTML = '';
        $('#ch-grid').innerHTML = '';
        empty.textContent = isMine ? '你还没有发布任何视频' : '这位UP主还没有视频';
        empty.style.display = 'block';
        switchTab('home');
        return;
    }

    // ---------- 首页：精选大卡（最新一条）+ 其余网格 ----------
    const thumbHtml = v => {
        const url = YT.mediaUrl(YT.pick(v, 'video_path'));
        return url
            ? `<video muted preload="metadata" playsinline src="${url}#t=0.1"></video>`
            : '<div style="display:flex;align-items:center;justify-content:center;height:100%;">&#9654;</div>';
    };
    const subLine = v => `${YT.fmtNum(YT.pick(v, 'view_count'))} 次观看 · ${YT.timeAgo(YT.pick(v, 'create_time')) || YT.fmtFull(YT.pick(v, 'create_time'))}`;
    const openVideo = id => `location.href='watch.html?id=${encodeURIComponent(id)}'`;

    const [feat, ...rest] = list;
    $('#ch-feature').innerHTML = `
        <div class="feature" onclick="${openVideo(YT.pick(feat, 'id'))}">
            <div class="thumb">${thumbHtml(feat)}</div>
            <div>
                <div class="f-title">${YT.esc(YT.pick(feat, 'title'))}</div>
                <div class="f-sub">${subLine(feat)} · ${YT.fmtNum(YT.pick(feat, 'like_count') || 0)} 点赞</div>
            </div>
        </div>`;
    $('#ch-grid').innerHTML = rest.map(v => {
        const id = YT.pick(v, 'id');
        return `
        <div class="ch-card" onclick="${openVideo(id)}">
            <div class="thumb">${thumbHtml(v)}</div>
            <div class="c-title">${YT.esc(YT.pick(v, 'title'))}</div>
            <div class="c-sub">${subLine(v)}</div>
        </div>`;
    }).join('');

    // ---------- 视频标签：列表视图（保留改标题/删除） ----------
    listBox.innerHTML = list.map(v => {
        const id = YT.pick(v, 'id');
        return `
        <div class="vitem">
            <div class="thumb-s" style="cursor:pointer;" onclick="${openVideo(id)}">${thumbHtml(v)}</div>
            <div class="vi-body" style="cursor:pointer;" onclick="${openVideo(id)}">
                <div class="vi-title">${YT.esc(YT.pick(v, 'title'))}</div>
                <div class="vi-sub">${YT.fmtNum(YT.pick(v, 'view_count'))} 次观看 · ${YT.fmtNum(YT.pick(v, 'like_count') || 0)} 点赞 · ${YT.fmtFull(YT.pick(v, 'create_time'))}</div>
                <div class="vi-sub" style="word-break:break-all;">${YT.esc(YT.pick(v, 'video_path'))}</div>
            </div>
            ${isMine ? `<div class="vi-ops">
                <button class="btn sm" data-edit="${id}" data-title="${YT.esc(YT.pick(v, 'title'))}">改标题</button>
                <button class="btn sm" data-del="${id}" style="color:var(--danger);">删除</button>
            </div>` : ''}
        </div>`;
    }).join('');

    if (isMine) {
        listBox.addEventListener('click', async e => {
            const t = e.target;
            if (t.dataset.edit) {
                e.stopPropagation();
                const nt = prompt('新的视频标题：', t.dataset.title);
                if (nt === null || !nt.trim()) return;
                const r = await YT.api.post('/api/video/edit/title', { newTitle: nt.trim(), id: t.dataset.edit, userId: me.userId });
                if (r.success) { YT.toast('已修改'); setTimeout(() => location.reload(), 600); }
                else YT.toast(r.message || '修改失败');
            }
            if (t.dataset.del) {
                e.stopPropagation();
                if (!confirm('确定删除这个视频？')) return;
                const r = await YT.api.del('/api/video/delete/videos', { id: t.dataset.del, userId: me.userId });
                if (r.success) { YT.toast('已删除'); setTimeout(() => location.reload(), 600); }
                else YT.toast(r.message || '删除失败');
            }
        });
    }

    switchTab('home');
})();
