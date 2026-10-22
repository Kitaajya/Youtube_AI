/* 播放页 */
(async function () {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { location.href = 'index.html'; return; }

    const $ = s => document.querySelector(s);
    let video = null;

    // 直接读取本地存储的当前用户 ID
    const currentUserId = localStorage.getItem('userId') || '';

    // ---------- 视频详情 ----------
    try {
        const res = await YT.api.get('/api/video/select/video/single/infor', { id });
        video = (res.data || [])[0];
    } catch (e) { YT.toast('详情加载失败：' + e.message); }

    if (!video) {
        $('#w-title').textContent = '视频不存在或已被删除';
        return;
    }

    const title = String(YT.pick(video, 'title'));
    const upName = String(YT.pick(video, 'uploader') || YT.pick(video, 'user_id'));
    const upId = String(YT.pick(video, 'user_id'));
    document.title = title + ' - YouTube';
    $('#w-title').textContent = title;
    $('#w-stats').textContent = `${YT.fmtNum(YT.pick(video, 'view_count'))} 次观看 · ${YT.fmtFull(YT.pick(video, 'create_time'))}`;
    $('#w-up-name').textContent = upName;
    $('#w-up-id').textContent = 'ID: ' + upId;
    $('#w-up-av').textContent = upName.slice(0, 1).toUpperCase();
    $('#w-up').style.cursor = 'pointer';
    $('#w-up').title = '查看 ' + upName + ' 的频道';
    $('#w-up').onclick = () => location.href = 'profile.html?userId=' + encodeURIComponent(upId) + '&name=' + encodeURIComponent(upName);

    if (currentUserId && upId && currentUserId !== upId) {
        const pmBtn = $('#w-pm');
        pmBtn.style.display = '';
        pmBtn.onclick = e => {
            e.stopPropagation();
            location.href = 'message.html?peer=' + encodeURIComponent(upId) + '&name=' + encodeURIComponent(upName);
        };
    }

    // ---------- 关注模块 ----------
    const followBtn = $('#btn-follow'), fansEl = $('#w-up-fans');
    let following = false, fansCount = 0, followBusy = false;
    function paintFollow() {
        followBtn.classList.toggle('light', following);
        followBtn.innerHTML = following ? '已关注' : '关注';
        followBtn.disabled = followBusy;
        fansEl.textContent = fansCount > 0 ? `${YT.fmtNum(fansCount)} 位粉丝` : '';
    }
    if (currentUserId && upId && currentUserId !== upId) {
        followBtn.style.display = '';
        paintFollow();
    }
    YT.api.get('/api/user/select/me/fans', { me: upId })
        .then(r => {
            const fans = (r && r.data) || [];
            fansCount = fans.length;
            following = !!(currentUserId && fans.some(f => String(YT.pick(f, 'user_id')) === currentUserId));
            paintFollow();
        }).catch(() => { });

    if (currentUserId && upId && currentUserId !== upId) {
        followBtn.onclick = async e => {
            e.stopPropagation();
            if (followBusy) return;
            followBusy = true; paintFollow();
            const wasFollowing = following;
            try {
                const url = wasFollowing ? '/api/user/unfollow' : '/api/user/follow';
                const res = await YT.api.post(url, { me: currentUserId, upId: upId });
                if (res.success) {
                    following = !wasFollowing;
                    fansCount = Math.max(0, fansCount + (following ? 1 : -1));
                    YT.toast(res.message || (wasFollowing ? '已取关' : '关注成功'));
                } else YT.toast(res.message || '操作失败，请重试');
            } catch (err) {
                YT.toast('请求失败：' + err.message);
            } finally {
                followBusy = false; paintFollow();
            }
        };
    }

    $('#w-desc').innerHTML = `<b>视频文件路径：</b>${YT.esc(YT.pick(video, 'video_path'))}<br>
        <b>视频 ID：</b>${YT.esc(id)}　<b>点赞数：</b>${YT.esc(YT.pick(video, 'like_count') || 0)}`;

    // ---------- 播放计数 ----------
    YT.api.post('/api/video/add/view', { id })
        .then(r => {
            if (!r.success) return;
            const v = Number(r.data && r.data.view_count);
            if (Number.isFinite(v)) {
                $('#w-stats').textContent = `${YT.fmtNum(v)} 次观看 · ${YT.fmtFull(YT.pick(video, 'create_time'))}`;
            }
        }).catch(() => { });

    const isMine = currentUserId && currentUserId === upId;
    if (isMine) { $('#btn-edit').style.display = ''; $('#btn-del').style.display = ''; }

    // ---------- 播放器 ----------
    let path = String(YT.pick(video, 'video_path'));
    if (!path) {
        try {
            const r = await YT.api.get('/api/video/select/path', { id });
            path = String((r.data || [])[0]?.video_path || (r.data || [])[0]?.videoPath || '');
        } catch (e) { }
    }
    const fb = $('#fallback'), player = $('#player');
    function showFallback(msg) {
        player.style.display = 'none';
        fb.style.display = 'flex';
        fb.innerHTML = msg;
    }
    if (!path) {
        showFallback('该视频没有登记文件路径，无法播放');
    } else {
        const url = YT.mediaUrl(path);
        player.src = url;
        player.style.display = 'block';
        fb.style.display = 'none';
        player.addEventListener('error', () => {
            showFallback(`浏览器取不到这个文件<br><span style="font-size:12px;">服务器已把视频目录挂到 <b>/videos/</b> 网址下，请检查文件是否在目录中。</span>`);
        });
    }

    // ---------- 侧栏推荐 ----------
    try {
        const r = await YT.api.get('/api/video/select/videos/upinfor');
        const list = (r.data || []).filter(v => String(YT.pick(v, 'id')) !== String(id)).slice(0, 12);
        $('#side').innerHTML = list.map(v => `
            <div class="card" onclick="location.href='watch.html?id=${encodeURIComponent(YT.pick(v, 'id'))}'">
                ${YT.thumb(v)}
                <div class="txt">
                    <div class="title">${YT.esc(YT.pick(v, 'title'))}</div>
                    <div class="sub">${YT.esc(YT.pick(v, 'uploader') || '')}</div>
                    <div class="sub">${YT.fmtNum(YT.pick(v, 'view_count'))} 次观看</div>
                </div>
            </div>`).join('') || '<div class="empty" style="padding:20px;">暂无其他视频</div>';
    } catch (e) { }

    // ---------- 视频点赞 ----------
    const likeBtn = $('#btn-like'), likeIc = $('#like-ic'), likeNum = $('#like-num');

    const svgLike = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19"/><path d="M4 10.5h3V19H4z"/></svg>';
    const svgLiked = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19" fill="none"/><path d="M4 10.5h3V19H4z"/></svg>';

    // 强制转换 1/0/"true"
    function normalizeLiked(v) {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            if (['true', '1', 'yes', 'y'].includes(s)) return true;
        }
        return false;
    }

    function forceRenderVideoLike(isLiked, count) {
        if (!likeBtn) return;
        likeBtn.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
        likeBtn.classList.toggle('light', isLiked);
        if (likeIc) likeIc.innerHTML = isLiked ? svgLiked : svgLike;
        if (likeNum) {
            const n = Number(count) || 0;
            likeNum.textContent = n > 0 ? YT.fmtNum(n) : '0';
        }
    }

    // 初始渲染
    forceRenderVideoLike(normalizeLiked(video.liked), Number(YT.pick(video, 'like_count')) || 0);

    // 如果登录了，查真实状态
    if (currentUserId) {
        YT.api.get('/api/video/select/like/count', { id, userId: currentUserId })
            .then(r => {
                if (r.success && r.data) {
                    forceRenderVideoLike(normalizeLiked(r.data.liked), Number(r.data.like_count));
                }
            }).catch(e => console.log('查询点赞状态失败', e));
    }

    if (likeBtn) {
        let busy = false;
        likeBtn.onclick = async () => {
            if (!YT.requireLogin() || busy) return;
            busy = true;
            likeBtn.disabled = true;
            const isNowLiked = likeBtn.getAttribute('aria-pressed') === 'true';
            try {
                const url = isNowLiked ? '/api/video/cancel/like' : '/api/video/add/like';
                const r = await YT.api.post(url, { id, userId: currentUserId });
                if (r.success && r.data) {
                    forceRenderVideoLike(normalizeLiked(r.data.liked), Number(r.data.like_count));
                    YT.toast(normalizeLiked(r.data.liked) ? '已点赞' : '已取消');
                }
            } catch (e) {
                YT.toast('操作失败');
            } finally {
                busy = false;
                likeBtn.disabled = false;
            }
        };
    }

    // ---------- 收藏 ----------
    const favBtn = $('#btn-fav');
    if (currentUserId) favBtn.style.display = '';

    let favModal = null;
    let favPublic = true;
    function paintVis(btn) {
        if (!btn) return;
        btn.classList.toggle('private', !favPublic);
        btn.innerHTML = favPublic ? '&#127760; 公开' : '&#128274; 私密';
        btn.title = favPublic ? '当前公开，点击改为仅自己可见' : '当前私密，点击改为公开';
    }
    function buildFavModal() {
        const el = document.createElement('div');
        el.className = 'fav-modal';
        el.innerHTML = `
            <div class="fav-mask"></div>
            <div class="fav-box">
                <div class="fav-head">收藏到</div>
                <div class="fav-list" id="fav-list"><div class="w-stats">加载中…</div></div>
                <div class="fav-new">
                    <input type="text" id="fav-name" maxlength="100" placeholder="新建收藏夹名称">
                    <button class="btn sm fav-vis" id="fav-vis" type="button"></button>
                    <button class="btn sm primary" id="fav-create">创建</button>
                </div>
                <button class="btn sm fav-close" id="fav-close">关闭</button>
            </div>`;
        document.body.appendChild(el);
        el.querySelector('.fav-mask').addEventListener('click', closeFav);
        el.querySelector('#fav-close').addEventListener('click', closeFav);
        el.querySelector('#fav-create').addEventListener('click', createPlaylist);
        el.querySelector('#fav-name').addEventListener('keydown', e => { if (e.key === 'Enter') createPlaylist(); });
        const visBtn = el.querySelector('#fav-vis');
        paintVis(visBtn);
        visBtn.addEventListener('click', () => { favPublic = !favPublic; paintVis(visBtn); });
        el.querySelector('#fav-list').addEventListener('click', e => {
            const item = e.target.closest('.fav-item');
            if (item) toggleFav(item);
        });
        return el;
    }
    async function openFav() {
        if (!favModal) favModal = buildFavModal();
        favModal.style.display = '';
        paintVis(favModal.querySelector('#fav-vis'));
        await renderFavList();
    }
    function closeFav() { if (favModal) favModal.style.display = 'none'; }

    async function renderFavList() {
        const box = favModal.querySelector('#fav-list');
        box.innerHTML = '<div class="w-stats">加载中…</div>';
        try {
            const r = await YT.api.get('/api/video/select/like/format', { owner: currentUserId, viewer: currentUserId, videoId: id });
            const rows = r.data || [];
            if (!rows.length) { box.innerHTML = '<div class="w-stats">还没有收藏夹，先创建一个</div>'; return; }
            box.innerHTML = rows.map(p => {
                const pid = String(YT.pick(p, 'playlist_id'));
                const inList = Number(YT.pick(p, 'in_list') || 0) > 0;
                return `
                <div class="fav-item ${inList ? 'on' : ''}" data-pid="${YT.esc(pid)}">
                    <span class="fi-check">${inList ? '✓' : ''}</span>
                    <span class="fi-name">${YT.esc(YT.pick(p, 'name'))}</span>
                    <span class="w-stats">${YT.fmtNum(YT.pick(p, 'video_count') || 0)} 个视频${Number(YT.pick(p, 'is_public') || 0) ? '' : ' · 私密'}</span>
                </div>`;
            }).join('');
        } catch (e) {
            box.innerHTML = `<div class="w-stats">加载失败：${YT.esc(e.message)}</div>`;
        }
    }

    async function toggleFav(item) {
        const pid = item.dataset.pid;
        const wasOn = item.classList.contains('on');
        item.style.opacity = '.5';
        try {
            const r = wasOn
                ? await YT.api.del('/api/video/remove/from/like', { pList: pid, videoId: id })
                : await YT.api.post('/api/video/add/to/like', { pList: pid, videoId: id, userId: currentUserId });
            if (r.success) {
                item.classList.toggle('on', !wasOn);
                item.querySelector('.fi-check').textContent = wasOn ? '' : '✓';
                const cntEl = item.querySelector('.w-stats');
                const m = cntEl.textContent.match(/^([\d.]+万?) 个视频/);
                if (m) {
                    const raw = m[1].endsWith('万') ? parseFloat(m[1]) * 10000 : Number(m[1]);
                    const n = Math.max(0, raw + (wasOn ? -1 : 1));
                    cntEl.textContent = cntEl.textContent.replace(m[1] + ' 个视频', YT.fmtNum(n) + ' 个视频');
                }
            } else YT.toast(r.message || '操作失败');
        } catch (e) {
            YT.toast('请求失败：' + e.message);
        } finally {
            item.style.opacity = '';
        }
    }

    async function createPlaylist() {
        const input = favModal.querySelector('#fav-name');
        const name = input.value.trim();
        if (!name) { YT.toast('收藏夹名称不能为空'); return; }
        input.value = '';
        try {
            const r = await YT.api.post('/api/video/create/like/format', {
                pList: YT.randId(), userId: currentUserId, name, description: '',
                isPublic: favPublic ? 1 : 0,
            });
            if (r.success) { YT.toast(`已创建：${name}（${favPublic ? '公开' : '私密'}）`); await renderFavList(); }
            else YT.toast(r.message || '创建失败');
        } catch (e) { YT.toast('请求失败：' + e.message); }
    }

    favBtn.onclick = () => { if (YT.requireLogin()) openFav(); };

    // ---------- 自己视频操作 ----------
    $('#btn-edit').onclick = async () => {
        const t = prompt('输入新的视频标题：', title);
        if (t === null || !t.trim()) return;
        const r = await YT.api.post('/api/video/edit/title', { newTitle: t.trim(), id, userId: currentUserId });
        if (r.success) { YT.toast('标题已修改'); setTimeout(() => location.reload(), 700); }
        else YT.toast(r.message || '修改失败');
    };
    $('#btn-del').onclick = async () => {
        if (!confirm('确定删除这个视频吗？评论会一并删除，且不可恢复。')) return;
        const r = await YT.api.del('/api/video/delete/videos', { id, userId: currentUserId });
        if (r.success) { YT.toast('已删除'); setTimeout(() => location.href = 'profile.html', 800); }
        else YT.toast(r.message || '删除失败');
    };

    // ---------- 评论区 ----------
    if (currentUserId) {
        $('#me-av1').textContent = (localStorage.getItem('nickname') || currentUserId).slice(0, 1).toUpperCase();
    } else {
        $('#me-av1').textContent = '\uD83D\uDD12';
        $('#me-av1').style.filter = 'grayscale(1)';
        $('#me-av1').style.opacity = '.6';
        const ta = $('#root-content');
        ta.readOnly = true;
        ta.placeholder = '登录后即可发表评论…';
        $('#root-cancel').style.display = 'none';
    }

    const list = $('#c-list');

    const cmtSvgLike = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19"/><path d="M4 10.5h3V19H4z"/></svg>';
    const cmtSvgLiked = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19" fill="none"/><path d="M4 10.5h3V19H4z"/></svg>';

    function opBtns(c, isMine) {
        const cid = YT.esc(YT.pick(c, 'comment_id'));
        const cLikeCount = Number(c.like_count || 0);
        // 读取后端的 my_liked，如果是 1 就是已赞
        const myLiked = Number(c.my_liked || 0) > 0;

        // 根据状态决定颜色和图标
        const color = myLiked ? 'var(--link)' : 'var(--text-secondary)';
        const icon = myLiked ? cmtSvgLiked : cmtSvgLike;

        return `<div class="ops">
            <button class="js-cmt-like" data-comment-like="${cid}" type="button" style="display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:${color};cursor:pointer;padding:0;font-size:13px;margin-right:8px;transition:color 0.2s;">
                <span class="cmt-like-ic" style="display:flex;align-items:center;">${icon}</span>
                <span class="cmt-like-count">${cLikeCount > 0 ? YT.fmtNum(cLikeCount) : ''}</span>
            </button>
            <span class="op-btn" data-reply="${cid}">回复</span>
            ${isMine ? `<span class="op-btn" data-edit="${cid}">修改</span>
                       <span class="op-btn" style="color:var(--danger);" data-del="${cid}">删除</span>` : ''}
        </div>`;
    }

    function item(c, isReply) {
        const cid = String(YT.pick(c, 'comment_id'));
        const who = String(YT.pick(c, 'commenter') || YT.pick(c, 'user_id') || '匿名用户');
        const isMine = !!currentUserId && String(YT.pick(c, 'user_id')) === currentUserId;
        const roAttr = currentUserId ? '' : ' readonly';
        const roPh = currentUserId ? `回复 ${YT.esc(who)}…` : '登录后即可回复…';
        const rootAttr = isReply ? ` data-root="${YT.esc(cid)}"` : '';
        const av = String(YT.pick(c, 'commenter_avatar', 'commenterAvatar') || '');
        const avInner = av ? `<img src="${YT.mediaUrl(av)}" alt="">` : YT.esc(who.slice(0, 1).toUpperCase());
        return `
        <div class="comment${isReply ? ' is-reply' : ''}" data-cid="${YT.esc(cid)}" data-who="${YT.esc(who)}"${rootAttr}>
            <span class="avatar">${avInner}</span>
            <div class="body">
                <div class="who">@${YT.esc(who)}<span class="time">${YT.timeAgo(YT.pick(c, 'create_time'))}</span></div>
                <div class="text">${YT.esc(YT.pick(c, 'contents'))}</div>
                ${opBtns(c, isMine)}
                ${isReply ? '' : `<button class="toggle-replies" data-toggle="${YT.esc(cid)}" hidden></button>`}
                <div class="edit-form" style="display:none;"></div>
                <div class="reply-form">
                    <textarea placeholder="${roPh}" rows="2"${roAttr} style="width:100%;font-family:inherit;font-size:13px;border:1px solid var(--input-border);border-radius:8px;padding:8px;outline:none;background:var(--input-bg);color:var(--text-primary);"></textarea>
                    <div class="cf-btns" style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
                        <button class="btn sm" data-cancel-reply>取消</button>
                        <button class="btn sm primary" data-send-reply="${YT.esc(cid)}">回复</button>
                    </div>
                </div>
                <div class="replies" data-replies="${YT.esc(cid)}"></div>
            </div>
        </div>`;
    }

    function mountReplies(rootCid, replyList) {
        const root = list.querySelector(`.comment[data-cid="${CSS.escape(rootCid)}"]`);
        if (!root) return;
        const box = root.querySelector(`:scope > .body > [data-replies="${CSS.escape(rootCid)}"]`);
        const toggle = root.querySelector(`:scope > .body > .toggle-replies[data-toggle="${CSS.escape(rootCid)}"]`);
        if (!box || !toggle) return;
        box.innerHTML = replyList.map(c => item(c, true)).join('');
        box.classList.remove('open');
        toggle.hidden = replyList.length === 0;
        toggle.dataset.count = replyList.length;
        toggle.innerHTML = `查看 ${replyList.length} 条回复 <span class="tri">▾</span>`;
    }

    async function loadComments() {
        list.innerHTML = '<div class="empty" style="padding:20px;">加载评论…</div>';
        let data = [];
        try {
            // 加上 currentUserId 传给后端
            const r = await YT.api.get('/api/video/get/all/comments', { videoId: id, userId: currentUserId });
            data = r.data || [];
        } catch (e) {
            list.innerHTML = `<div class="empty" style="padding:20px;">评论加载失败：${YT.esc(e.message)}</div>`;
            return;
        }
        const roots = data.filter(c => !c.parent_id && !c.parentId);
        const replies = data.filter(c => c.parent_id || c.parentId);
        $('#c-head').textContent = `评论 ${data.length}`;
        if (!data.length) { list.innerHTML = '<div class="empty" style="padding:20px;">还没有评论，来说两句吧</div>'; return; }
        list.innerHTML = roots.map(c => item(c, false)).join('');

        const byId = new Map(data.map(c => [String(YT.pick(c, 'comment_id')), c]));
        const rootOf = c => {
            let cur = c, guard = 0;
            while (cur && (cur.parent_id || cur.parentId) && guard++ < 50) {
                cur = byId.get(String(cur.parent_id || cur.parentId));
            }
            return cur;
        };
        const groups = new Map();
        replies.forEach(rc => {
            const root = rootOf(rc);
            if (!root) return;
            const rid = String(YT.pick(root, 'comment_id'));
            (groups.get(rid) || groups.set(rid, []).get(rid)).push(rc);
        });
        groups.forEach((arr, rid) => mountReplies(rid, arr));
    }

    $('#root-cancel').onclick = () => { $('#root-content').value = ''; };
    $('#root-submit').onclick = async () => {
        if (!YT.requireLogin()) return;
        const content = $('#root-content').value.trim();
        if (!content) return YT.toast('评论内容不能为空');
        const r = await YT.api.post('/api/video/add/my/comments', {
            commentId: YT.randId(), videoId: id, userId: currentUserId, content, parentId: null
        });
        if (r.success) { $('#root-content').value = ''; YT.toast('评论成功'); loadComments(); }
        else YT.toast(r.message || '评论失败');
    };

    // =========================================================
    // 终极防弹版：直接监听整个文档的点击事件
    // =========================================================
    document.addEventListener('click', async function(e) {
        const t = e.target;

        // 1. 强行拦截【评论点赞】
        const likeBtn = t.closest('.js-cmt-like');
        if (likeBtn) {
            if (!YT.requireLogin()) return;
            if (likeBtn.dataset.busy) return;

            likeBtn.dataset.busy = '1';
            likeBtn.disabled = true;

            const commentId = likeBtn.dataset.commentLike;
            try {
                const r = await YT.api.post('/api/video/add/comment/like', { me: currentUserId, commentId });

                if (r.success && r.data) {
                    const countEl = likeBtn.querySelector('.cmt-like-count');
                    const icEl = likeBtn.querySelector('.cmt-like-ic');

                    if (normalizeLiked(r.data.liked)) {
                        likeBtn.style.color = 'var(--link)';
                        icEl.innerHTML = cmtSvgLiked;
                    } else {
                        likeBtn.style.color = 'var(--text-secondary)';
                        icEl.innerHTML = cmtSvgLike;
                    }

                    if (countEl) {
                        countEl.textContent = r.data.count > 0 ? YT.fmtNum(r.data.count) : '';
                    }
                    YT.toast(r.data.liked ? '已点赞' : '已取消');
                } else {
                    YT.toast(r.message || '操作失败');
                }
            } catch (err) {
                console.error('评论点赞失败', err);
                YT.toast('点赞失败：' + err.message);
            } finally {
                likeBtn.dataset.busy = '';
                likeBtn.disabled = false;
            }
            return;
        }

        // 2. 强行拦截【回复/删除/修改等操作】
        const cid = t.dataset;
        if (cid.toggle) {
            const root = t.closest('.comment');
            const box = root.querySelector(`:scope > .body > [data-replies="${CSS.escape(cid.toggle)}"]`);
            const open = box.classList.toggle('open');
            const n = box.children.length;
            t.innerHTML = open ? `收起回复 <span class="tri">▴</span>`
                : `查看 ${n} 条回复 <span class="tri">▾</span>`;
            return;
        }

        if (cid.reply) {
            const box = t.closest('.comment').querySelector('.reply-form');
            box.classList.toggle('open');
            if (box.classList.contains('open')) {
                const root = t.closest('.comment');
                const rp = root.querySelector(`:scope > .body > [data-replies="${CSS.escape(cid.reply)}"]`);
                const tg = root.querySelector(`:scope > .body > .toggle-replies[data-toggle="${CSS.escape(cid.reply)}"]`);
                if (rp && tg && !tg.hidden && !rp.classList.contains('open')) {
                    rp.classList.add('open');
                    tg.innerHTML = `收起回复 <span class="tri">▴</span>`;
                }
            }
            return;
        }
        if (cid.cancelReply !== undefined) { t.closest('.reply-form').classList.remove('open'); return; }

        if (cid.sendReply) {
            if (!YT.requireLogin()) return;
            const form = t.closest('.reply-form');
            const ta = form.querySelector('textarea');
            let content = ta.value.trim();
            if (!content) return YT.toast('回复不能为空');
            const target = t.closest('.comment');
            if (target.classList.contains('is-reply')) {
                const who = target.dataset.who || '';
                if (who && !content.startsWith('@' + who)) content = `@${who} ${content}`;
            }
            const r = await YT.api.post('/api/video/add/my/comments', {
                commentId: YT.randId(), videoId: id, userId: currentUserId, content, parentId: cid.sendReply
            });
            if (r.success) { ta.value = ''; form.classList.remove('open'); YT.toast('回复成功'); loadComments(); }
            else YT.toast(r.message || '回复失败');
            return;
        }

        if (cid.del) {
            if (!confirm('删除这条评论？')) return;
            const r = await YT.api.del('/api/video/delete/my/comments', { myUserId: currentUserId, videoId: id, commentId: cid.del });
            if (r.success) { YT.toast('已删除'); loadComments(); } else YT.toast(r.message || '删除失败');
            return;
        }

        if (cid.edit) {
            const body = t.closest('.body');
            const box = body.querySelector('.edit-form');
            const textEl = body.querySelector('.text');
            if (box.style.display === 'block') return;
            box.style.display = 'block';
            box.innerHTML = `<textarea>${YT.esc(textEl.textContent)}</textarea>
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
                    <button class="btn sm" data-edit-cancel>取消</button>
                    <button class="btn sm primary" data-edit-save="${cid.edit}">保存</button>
                </div>`;
            return;
        }

        if (t.dataset.editCancel !== undefined) { t.closest('.edit-form').style.display = 'none'; return; }

        if (t.dataset.editSave) {
            const box = t.closest('.edit-form');
            const content = box.querySelector('textarea').value.trim();
            if (!content) return YT.toast('内容不能为空');
            const r = await YT.api.post('/api/video/edit/my/comments', { newContent: content, commentId: t.dataset.editSave, myUserId: currentUserId });
            if (r.success) { YT.toast('已修改'); loadComments(); } else YT.toast(r.message || '修改失败');
            return;
        }
    });

    // 最后加载评论
    loadComments();
})();
// ---------AI一键总结评论----------
const aiSummaryBtn = document.getElementById('btn-ai-summary');
if (aiSummaryBtn) {
    aiSummaryBtn.onclick = async () => {
        // 先检查有没有评论
        const countText = document.getElementById('c-head').innerText;
        if (countText.includes('评论 0')) {
            return YT.toast('当前视频还没有评论哦');
        }

        // 创建一个 AI 总结弹窗（或者直接在评论区上方插入一个 div）
        let summaryBox = document.getElementById('ai-summary-box');
        if (!summaryBox) {
            summaryBox = document.createElement('div');
            summaryBox.id = 'ai-summary-box';
            summaryBox.className = 'w-desc';
            summaryBox.style.marginTop = '10px';
            summaryBox.style.marginBottom = '20px';
            summaryBox.style.background = 'var(--surface-2)';
            summaryBox.style.border = '1px solid var(--link)';
            // 插在评论区列表上方
            const cList = document.getElementById('c-list');
            cList.parentNode.insertBefore(summaryBox, cList);
        }

        summaryBox.innerHTML = '<b>AI 正在阅读并总结评论...</b>';
        aiSummaryBtn.disabled = true;

        try {
            // 调用你在 Controller 里写好的接口
            // 传当前视频的 id (vid) 和一个预设的提问 (question)
            const question = "请帮我用三句话总结一下大家对这个视频的看法，并提炼出3个核心关键词。";
            const response = await fetch(`/api/deepseek/analyze/video/comments?vid=${id}&question=${encodeURIComponent(question)}`);

            if (!response.ok) throw new Error('网络请求失败');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let isFirstChunk = true;
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                if (isFirstChunk) {
                    summaryBox.innerHTML = '✨ <b>AI 总结：</b><br>';
                    isFirstChunk = false;
                }
                fullText += chunk;
                summaryBox.innerHTML = '✨ <b>AI 总结：</b><br>' + YT.esc(fullText).replace(/\n/g, '<br>');
            }
        } catch (error) {
            summaryBox.innerHTML = 'AI 总结失败：' + error.message;
        } finally {
            aiSummaryBtn.disabled = false;
        }
    };
    const id = new URLSearchParams(location.search).get('id');
}
// -------------------------------------------
//2026/10/20/20:00->localtime 20:53解决了评论点赞后再次刷新页面导致赞样式变成空心的bug
//2026/10/23/7:25->添加了AI总结视频评论区功能