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
    // 如果不是自己，显示私信按钮
    if (!isMine) {
        const pmBtn = $('#ch-pm');
        if (pmBtn) {
            pmBtn.style.display = '';
            pmBtn.onclick = (e) => {
                e.preventDefault();
                // 跳转到私信页，并带上对方的 userId 和昵称
                location.href = 'message.html?peer=' + encodeURIComponent(userId) + '&name=' + encodeURIComponent(name);
            };
        }
    }
    // ---------- 标签栏：首页 / 视频 / 收藏夹 / 关注与粉丝 ----------
    const panels = { home: $('#panel-home'), videos: $('#panel-videos'), plays: $('#panel-plays'), social: $('#panel-social'), shield: $('#panel-shield') };
    let activeTab = 'home';
    function switchTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.ch-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        for (const [k, el] of Object.entries(panels)) {
            if (!el) continue;
            el.style.display = k === tab ? '' : 'none';
        }
        if (tab === 'plays') loadPlaylists();
        if (tab === 'shield') loadShields();
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
            ${YT.avatarHtml(nm, YT.pick(u, 'avatar'))}
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
            // 自己的频道：可见性标签做成可点按钮（切换公开/私密）；看别人：只读标签
            const visEl = isMine
                ? `<button class="pl-tag ${pub ? '' : 'private'}" data-toggle-vis="${YT.esc(pid)}" data-pub="${pub ? 1 : 0}" type="button" title="点击切换公开/私密">${pub ? '&#127760; 公开' : '&#128274; 私密'}</button>`
                : `<span class="pl-tag ${pub ? '' : 'private'}">${pub ? '&#127760; 公开' : '&#128274; 私密'}</span>`;
            return `
            <div class="pl-card" data-pid="${YT.esc(pid)}" data-name="${YT.esc(YT.pick(p, 'name'))}">
                <div class="pl-cover">
                    <span class="pl-ic">&#9654;</span>
                    <span class="pl-count">${YT.fmtNum(YT.pick(p, 'video_count') || 0)}</span>
                </div>
                <div class="pl-body">
                    <div class="pl-name">${YT.esc(YT.pick(p, 'name'))}</div>
                    <div class="pl-sub">
                        ${visEl}
                        <span>${YT.timeAgo(YT.pick(p, 'create_time')) || YT.fmtFull(YT.pick(p, 'create_time'))}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // 切换收藏夹可见性（仅自己频道页有此按钮）：调用后端 edit/like/format/public
    document.addEventListener('click', async e => {
        const btn = e.target.closest('[data-toggle-vis]');
        if (!btn) return;
        e.stopPropagation();                 // 别触发卡片的"展开视频"
        const pid = btn.dataset.toggleVis;
        const next = btn.dataset.pub === '1' ? 0 : 1;   // 翻转到目标状态
        btn.disabled = true;
        try {
            const r = await YT.api.post('/api/video/edit/like/format/public', { pList: pid, userId: me.userId, isPublic: next });
            if (r.success) {
                btn.dataset.pub = String(next);
                btn.classList.toggle('private', next === 0);
                btn.innerHTML = next === 1 ? '&#127760; 公开' : '&#128274; 私密';
                YT.toast(r.message || (next === 1 ? '已设为公开' : '已设为私密'));
            } else {
                YT.toast(r.message || '切换失败');
            }
        } catch (err) {
            YT.toast('请求失败：' + err.message);
        } finally {
            btn.disabled = false;
        }
    });

    // 点收藏夹卡片 → 展开夹内视频
    document.addEventListener('click', async e => {
        // 点在"公开/私密"切换按钮上时不触发展开：
        // 两个监听器同挂在 document 上，stopPropagation 拦不住同级监听器，只能在这里判断
        if (e.target.closest('[data-toggle-vis]')) return;
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
                            <div class="thumb">${thumbHtml(v)}</div>
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
        // viewerId 传当前看的人：视频级屏蔽时，被这个视频屏蔽的人在这里也看不到它
        const r = await YT.api.get('/api/video/select', { userId, viewerId: me ? me.userId : '' });
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
    // 频道页封面：优先 cover_path，没有则回退视频首帧
    const thumbHtml = v => {
        const cover = YT.pick(v, 'cover_path', 'coverPath');
        if (cover) {
            return `<img src="${YT.mediaUrl(cover)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`;
        }
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

    // ---------- 屏蔽名单模块（视频级） ----------
    // 一行 = 一个视频屏蔽一个人，所以同一个人可能出现在多个视频分组里
    // GET  /api/video/select/my/obscured/user?upId=&videoId=   我屏蔽的人（带 video_id / video_title）
    // POST /api/video/cancel/obscure   (upId, videoId, userIds[]) 解除屏蔽（带 videoId = 只解除该视频的）
    // POST /api/video/obscure/users    (upId, videoId, userIds[]) 屏蔽（入口在播放页评论区 / 上传页）
    const shList = $('#sh-list');
    const shTitle = $('#sh-title');
    const shToolbar = $('#sh-toolbar');
    const shCheckAll = $('#sh-check-all');
    const shUnshield = $('#sh-unshield');
    let shields = [];      // 后端原始返回，一行一个 (video_id, user_id)
    let shieldBusy = false;
    let shieldLoaded = false;

    // 后端这条 SQL 已经 JOIN 了 user_information 和 video，正常能拿到 nickname/avatar/video_title；
    // 查不到昵称时退回关注/粉丝列表或直接显示 user_id，保证老数据也不至于空白。
    function shieldName(u) {
        const uid = String(YT.pick(u, 'user_id'));
        const direct = String(YT.pick(u, 'nickname') || '').trim();
        if (direct) return direct;
        const hit = followers.concat(followings)
            .find(x => String(YT.pick(x, 'user_id')) === uid);
        return hit ? String(YT.pick(hit, 'nickname') || uid) : uid;
    }
    function shieldAvatar(u) {
        const av = String(YT.pick(u, 'avatar', 'uploader_avatar') || '');
        return av ? `<img src="${YT.mediaUrl(av)}" alt="">` : YT.esc(shieldName(u).slice(0, 1).toUpperCase());
    }
    function hasProfile(u) {
        return !!String(YT.pick(u, 'nickname') || '').trim();
    }

    // 一行屏蔽记录：勾选框的 value 用 "videoId|userId" 保证同一个人在不同视频下不会被混成一条
    function shieldCard(u) {
        const uid = String(YT.pick(u, 'user_id'));
        const vid = String(YT.pick(u, 'video_id') || '');
        const nm = shieldName(u);
        return `
        <div class="sh-card" data-uid="${YT.esc(uid)}" data-video-id="${YT.esc(vid)}">
            <input type="checkbox" data-sh-check="${YT.esc(vid)}|${YT.esc(uid)}" aria-label="选择 ${YT.esc(nm)}">
            <span class="avatar">${shieldAvatar(u)}</span>
            <div class="uc-txt">
                <div class="uc-name">${YT.esc(nm)}</div>
                <div class="w-stats">ID: ${YT.esc(uid)}${YT.pick(u, 'create_time') ? ' · 屏蔽于 ' + YT.timeAgo(YT.pick(u, 'create_time')) : ''}</div>
            </div>
            <button class="btn sm" data-unshield="${YT.esc(uid)}" data-video-id="${YT.esc(vid)}" type="button">解除屏蔽</button>
        </div>`;
    }

    // 按视频分组：一个视频一个区块，区块头显示视频标题 + 该视频屏蔽了多少人
    function groupByVideo(rows) {
        const map = new Map();
        rows.forEach(u => {
            const vid = String(YT.pick(u, 'video_id') || '');
            if (!map.has(vid)) {
                map.set(vid, {
                    videoId: vid,
                    title: String(YT.pick(u, 'video_title') || ('视频 #' + vid)),
                    rows: [],
                });
            }
            map.get(vid).rows.push(u);
        });
        return Array.from(map.values());
    }

    function renderGroup(g) {
        return `
        <div class="sh-group" data-group-video="${YT.esc(g.videoId)}">
            <div class="sh-group-head">
                <a class="sh-group-title" href="watch.html?id=${encodeURIComponent(g.videoId)}"
                   title="${YT.esc(g.title)}">${YT.esc(g.title)}</a>
                <span class="w-stats">#${YT.esc(g.videoId)} · 已屏蔽 ${g.rows.length} 人</span>
                <button class="btn sm" type="button" data-unshield-video="${YT.esc(g.videoId)}">解除该视频全部</button>
            </div>
            ${g.rows.map(shieldCard).join('')}
        </div>`;
    }

    function paintShieldTip() {
        const tip = $('#sh-tip');
        if (!tip) return;
        const needJoin = shields.length > 0 && !shields.every(hasProfile);
        tip.textContent = needJoin
            ? '屏蔽是「按视频」的：只在某个视频下屏蔽 TA，TA 仍然能看你其它视频。下方部分条目因缺少昵称只显示用户 ID。'
            : '屏蔽是「按视频」的：只在某个视频下屏蔽 TA，TA 仍然能看你其它视频。';
    }

    // 勾选框 value 形如 "视频ID|用户ID"
    function checkedPairs() {
        return Array.from(shList.querySelectorAll('input[data-sh-check]:checked'))
            .map(i => String(i.dataset.shCheck || ''))
            .filter(v => v.includes('|'))
            .map(v => {
                const [videoId, uid] = v.split('|');
                return { videoId, uid };
            });
    }
    function syncToolbar() {
        const n = checkedPairs().length;
        shUnshield.disabled = n === 0 || shieldBusy;
        shUnshield.textContent = n > 0 ? `解除屏蔽（${n}）` : '解除屏蔽';
        const boxes = shList.querySelectorAll('input[data-sh-check]');
        shCheckAll.checked = boxes.length > 0 && n === boxes.length;
        shCheckAll.indeterminate = n > 0 && n < boxes.length;
    }

    function renderShields() {
        const groups = groupByVideo(shields);
        shTitle.textContent = shields.length
            ? `屏蔽名单 · ${groups.length} 个视频 / ${shields.length} 条`
            : '屏蔽名单';
        shToolbar.style.display = shields.length ? 'flex' : 'none';
        shList.innerHTML = shields.length
            ? groups.map(renderGroup).join('')
            : '<div class="w-stats">你还没有屏蔽任何人。在自己视频的评论区点「屏蔽此人」，屏蔽只对那条视频生效。</div>';
        paintShieldTip();
        syncToolbar();
    }

    async function loadShields(force) {
        if (shieldBusy) return;
        if (shieldLoaded && !force) return;
        shieldBusy = true;
        shList.innerHTML = '<div class="w-stats">加载屏蔽名单…</div>';
        try {
            const r = await YT.api.get('/api/video/select/my/obscured/user', { upId: me.userId });
            shields = (r && r.data) || [];
            shieldLoaded = true;
            renderShields();
        } catch (e) {
            shList.innerHTML = `<div class="w-stats">屏蔽名单加载失败：${YT.esc(e.message)}</div>`;
        } finally {
            shieldBusy = false;
        }
    }

    // 解除屏蔽（单个按钮 / 视频分组按钮 / 批量勾选都走这里）
    // pairs: [{videoId, uid}] —— 后端一次只接受一个 videoId，所以按视频分组后并发提交
    async function doUnshield(pairs) {
        if (!pairs.length || shieldBusy) return;
        const n = pairs.length;
        if (!confirm(`确定解除这 ${n} 条屏蔽？解除后 TA 又能看到对应视频（只影响这些视频，其它视频下的屏蔽保留）。`)) return;
        shieldBusy = true;
        shUnshield.disabled = true;
        try {
            const byVideo = new Map();
            pairs.forEach(p => {
                const vid = String(p.videoId);
                if (!byVideo.has(vid)) byVideo.set(vid, []);
                byVideo.get(vid).push(String(p.uid));
            });
            const results = await Promise.all(Array.from(byVideo.entries()).map(([videoId, uids]) =>
                YT.api.post('/api/video/cancel/obscure', { upId: me.userId, videoId, userIds: uids })
            ));
            const bad = results.find(r => !(r && r.success));
            if (!bad) {
                YT.toast(`已解除 ${n} 条屏蔽`);
                const done = new Set(pairs.map(p => `${p.videoId}|${p.uid}`));
                shields = shields.filter(u => !done.has(`${YT.pick(u, 'video_id')}|${YT.pick(u, 'user_id')}`));
                renderShields();
            } else {
                YT.toast((bad && bad.message) || '解除屏蔽失败');
            }
        } catch (e) {
            YT.toast('解除屏蔽失败：' + (e.message || '网络错误'));
        } finally {
            shieldBusy = false;
            shUnshield.disabled = false;
            syncToolbar();
        }
    }

    // ---- 给「某个视频」添加屏蔽：不依赖评论区，对方没评论过也能屏蔽 ----
    // 入口在屏蔽名单顶部：先选视频，再搜人（或直接填用户 ID），最后提交
    const shAddSel = $('#sh-add-video');
    const shAddInput = $('#sh-add-input');
    const shAddDrop = $('#sh-add-drop');
    const shAddBtn = $('#sh-add-btn');
    let shAddPicked = null;   // 从搜索下拉里点中的用户 {userId, nickname}

    function fillShieldVideoSelect() {
        if (!shAddSel) return;
        shAddSel.innerHTML = list.map(v =>
            `<option value="${YT.esc(YT.pick(v, 'id'))}">${YT.esc(YT.pick(v, 'title'))}</option>`
        ).join('');
    }

    async function addShield() {
        if (!me || shieldBusy) return;
        const videoId = shAddSel && shAddSel.value;
        const typed = ((shAddInput && shAddInput.value) || '').trim();
        const uid = shAddPicked ? String(shAddPicked.userId) : typed;
        if (!videoId) return YT.toast('请选择要屏蔽的视频');
        if (!uid) return YT.toast('请选择或输入要屏蔽的用户');
        shieldBusy = true;
        shAddBtn.disabled = true;
        let ok = false;
        try {
            const r = await YT.api.post('/api/video/obscure/users', {
                upId: me.userId, videoId, userIds: [uid],
            });
            ok = !!(r && r.success);
            if (ok) {
                YT.toast('已加入屏蔽名单：TA 看不到这个视频');
                shAddInput.value = '';
                shAddPicked = null;
            } else {
                YT.toast((r && r.message) || '屏蔽失败');
            }
        } catch (e) {
            YT.toast('屏蔽失败：' + (e.message || '网络错误'));
        } finally {
            shieldBusy = false;
            if (shAddBtn) shAddBtn.disabled = false;
        }
        // 必须等 shieldBusy 放开后再刷，否则 loadShields 会直接 return
        if (ok) {
            shieldLoaded = false;
            await loadShields(true);
        }
    }

    if (isMine) {
        const tabShield = $('#tab-shield');
        if (tabShield) tabShield.style.display = '';

        // 添加屏蔽：视频下拉 + 用户搜索 / 直接输入 ID
        if (shAddSel && shAddInput && shAddDrop && shAddBtn) {
            fillShieldVideoSelect();
            let searchTimer = null;
            shAddInput.addEventListener('input', () => {
                shAddPicked = null;
                const kw = shAddInput.value.trim();
                clearTimeout(searchTimer);
                if (!kw) { shAddDrop.style.display = 'none'; return; }
                searchTimer = setTimeout(async () => {
                    try {
                        const r = await YT.api.get('/api/user/search', { keyword: kw });
                        const users = (r.data || []).slice(0, 8);
                        shAddDrop.innerHTML = users.length
                            ? users.map(u => {
                                const uid = YT.pick(u, 'userId') || YT.pick(u, 'user_id');
                                const nm = YT.pick(u, 'nickname') || uid;
                                return `<div class="item" data-uid="${YT.esc(uid)}" data-name="${YT.esc(nm)}">${YT.esc(nm)}<span class="w-stats">ID: ${YT.esc(uid)}</span></div>`;
                            }).join('')
                            : '<div class="item" style="color:var(--text-tertiary);cursor:default;">没有找到用户，可直接输入用户 ID</div>';
                        shAddDrop.style.display = 'block';
                    } catch (e) {
                        shAddDrop.style.display = 'none';
                    }
                }, 300);
            });
            shAddDrop.addEventListener('mousedown', e => {
                const it = e.target.closest('.item[data-uid]');
                if (!it) return;
                e.preventDefault();
                shAddPicked = { userId: it.dataset.uid, nickname: it.dataset.name };
                shAddInput.value = it.dataset.name;
                shAddDrop.style.display = 'none';
            });
            document.addEventListener('click', e => {
                if (!shAddDrop.contains(e.target) && e.target !== shAddInput) shAddDrop.style.display = 'none';
            });
            shAddBtn.addEventListener('click', addShield);
        }

        shCheckAll.addEventListener('change', () => {
            shList.querySelectorAll('input[data-sh-check]').forEach(i => { i.checked = shCheckAll.checked; });
            syncToolbar();
        });
        shList.addEventListener('change', e => {
            if (e.target.dataset.shCheck !== undefined) syncToolbar();
        });
        shUnshield.addEventListener('click', () => doUnshield(checkedPairs()));
        shList.addEventListener('click', e => {
            const t = e.target;
            if (!t.dataset) return;
            // 视频分组头：解除这个视频下的全部屏蔽
            if (t.dataset.unshieldVideo) {
                const vid = String(t.dataset.unshieldVideo);
                const rows = shields.filter(u => String(YT.pick(u, 'video_id')) === vid);
                doUnshield(rows.map(u => ({ videoId: vid, uid: String(YT.pick(u, 'user_id')) })));
                return;
            }
            // 单条：解除某人在某个视频下的屏蔽
            if (t.dataset.unshield) {
                doUnshield([{ videoId: String(t.dataset.videoId || ''), uid: String(t.dataset.unshield) }]);
            }
        });
    }

    // ---------- 生日模块 ----------
    // 后端：POST /api/user/add/birthday?birthday=yyyy-MM-ddTHH:mm:ss（@RequestParam LocalDateTime）
    // 目前后端只有写入接口、没有查询接口，所以回显先用 localStorage 兜底；
    // 换设备或清缓存后会显示"未设置"，这是后端还缺 GET 接口导致的，不是前端 bug。
    const BDAY_KEY = 'yt-birthday';
    const bdayRow = $('#ch-bday');
    const bdayVal = $('#ch-bday-val');
    const bdayBtn = $('#ch-bday-edit');
    const bdayModal = $('#bday-modal');
    const bdayInput = $('#bday-input');
    const bdaySave = $('#bday-save');

    const pad2 = n => String(n).padStart(2, '0');
    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    function readBday() {
        try { return localStorage.getItem(BDAY_KEY) || ''; } catch (e) { return ''; }
    }
    function paintBday() {
        const v = readBday();
        bdayVal.textContent = v ? v.replace(/-/g, ' / ') : '未设置';
        bdayVal.classList.toggle('bday-empty', !v);
        bdayBtn.textContent = v ? '修改' : '设置';
    }
    function openBday() {
        bdayInput.max = todayStr();          // 不允许选未来日期
        bdayInput.value = readBday() || '';
        bdayModal.style.display = 'flex';
        bdayInput.focus();
    }
    function closeBday() { bdayModal.style.display = 'none'; }

    if (isMine) {
        bdayRow.style.display = 'flex';
        paintBday();
        // 后端有记录时以服务器为准：换设备 / 清缓存后也能回显
        YT.birthdayOf(me.userId).then(paintBday).catch(() => { });
        bdayBtn.addEventListener('click', openBday);
        $('#bday-cancel').addEventListener('click', closeBday);
        bdayModal.addEventListener('click', e => { if (e.target === bdayModal) closeBday(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && bdayModal.style.display !== 'none') closeBday();
        });

        bdaySave.addEventListener('click', async () => {
            const v = bdayInput.value;
            if (!v) return YT.toast('请选择生日');
            if (v > todayStr()) return YT.toast('生日不能晚于今天');

            bdaySave.disabled = true;
            try {
                // 与 dynamic.js 的 nowISO() 同款格式，后端 LocalDateTime 可直接解析
                // 后端已改成按 userId 更新，必须带上当前登录用户
                const r = await YT.api.post('/api/user/add/birthday', {
                    birthday: v + 'T00:00:00',
                    userId: me.userId,
                });
                if (r && r.success) {
                    try { localStorage.setItem(BDAY_KEY, v); } catch (e) { /* 隐私模式忽略 */ }
                    paintBday();
                    closeBday();
                    YT.toast(r.message || '生日已保存');
                } else {
                    YT.toast((r && (r.message || r.error)) || '保存失败');
                }
            } catch (e) {
                YT.toast('保存失败：' + (e.message || '网络错误'));
            } finally {
                bdaySave.disabled = false;
            }
        });
    }
    // ---------- 头像上传模块 ----------
    const avEl = $('#ch-av');

    // 把头像地址渲染成圆形图片；地址为空时保留首字母占位
    function paintAvatar(url) {
        const u = YT.mediaUrl(url);
        if (!u) return;
        avEl.innerHTML = `<img src="${YT.esc(u)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }

    // 以后端为准读头像：换浏览器、清缓存、换设备后依然能显示；
    // 后端没存头像时（avatar 为 null）就继续用首字母占位，不写坏本地缓存
    async function loadAvatar() {
        try {
            const r = await YT.api.get('/api/user/select/avatar', { userId });
            const row = r && Array.isArray(r.data) ? r.data[0] : null;
            const av = row ? YT.pick(row, 'avatar') : '';
            if (av) {
                paintAvatar(av);
                if (isMine) {
                    try { localStorage.setItem('avatar', av); } catch (e) { /* 隐私模式忽略 */ }
                }
            }
        } catch (e) { /* 接口不可用时保持首字母占位 */ }
    }

    if (isMine) {
        const fileIn = $('#avatar-input');

        // 点击头像触发文件选择
        avEl.onclick = () => fileIn.click();

        // 选择文件后上传
        fileIn.onchange = async () => {
            const file = fileIn.files[0];
            if (!file) return;

            // 大小校验 (限制 2MB)
            if (file.size > 2 * 1024 * 1024) return YT.toast('头像不能超过 2MB');

            const form = new FormData();
            form.append('file', file);

            // 后端 /api/user/upload/avatar 用 @RequestParam 同时收 userId 和文件，
            // 所以两者都放进同一个 FormData 里
            form.append('userId', me.userId);

            avEl.style.opacity = '0.5'; // 变暗提示正在上传
            try {
                // 一步完成：图片落盘 + 写回 user_information.avatar
                const r = await YT.api.post('/api/user/upload/avatar', form);
                const avatarUrl = r && r.data ? (r.data.avatarUrl || '') : '';

                if (r && r.success && avatarUrl) {
                    YT.toast(r.message || '头像更换成功！');
                    // 立即渲染新头像
                    paintAvatar(avatarUrl);
                    // 缓存一份，供顶栏等其他位置读取
                    try { localStorage.setItem('avatar', avatarUrl); } catch (e) { /* 隐私模式忽略 */ }
                } else {
                    // 后端返回的是 Result 结构，失败原因在 message 里
                    YT.toast((r && (r.message || r.error)) || '上传失败');
                }
            } catch (e) {
                YT.toast('网络错误：' + e.message);
            } finally {
                avEl.style.opacity = '1';
                fileIn.value = ''; // 清空 input 允许重复选同一个文件
            }
        };

    }
    // 页面加载时以后端为准读一次头像（自己的：换浏览器/清缓存后依然显示；
    // 别人的：直接显示对方头像，而不只是首字母）
    loadAvatar();
    // --------------------------------

    switchTab('home');
})();
