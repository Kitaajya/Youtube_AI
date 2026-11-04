/* 短视频页
 * 数据源  GET  /api/video/select/short?size=&offset=   短视频推荐流（后端按 播放量*0.3+点赞*0.7 排序，最多 50/页）
 *         单条字段：id / user_id / title / video_path / cover_path / view_count / duration_sec /
 *                   create_time / like_count / comment_count / uploader / uploader_avatar / play_url
 * 交互接口  GET  /api/video/select/like/count?id=&userId=   点赞数 + 我是否赞过
 *           POST /api/video/add/like | /api/video/cancel/like   {id,userId}
 *           POST /api/video/add/view {id}                       播放计数 +1
 *           POST /api/video/insert/history {userId,videoId}      写入观看历史
 *           GET  /api/video/get/all/comments?videoId=            评论
 *           POST /api/video/add/my/comments {commentId,videoId,userId,content,parentId}
 */
(function () {
    const PAGE = 8;                 // 每页拉取条数
    const LOAD_AHEAD = 3;           // 距底部不足 3 条时预取下一页
    const ICON = {
        like: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 10.5 11 3a2.2 2.2 0 0 1 2.2 2.2V9h4.6a2.2 2.2 0 0 1 2.15 2.72l-1.8 7.2A2.2 2.2 0 0 1 16 20.5H7z"/><rect x="2.8" y="10.5" width="4.2" height="10" rx="1.2"/></svg>',
        comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5.5h16v11H9l-5 4z"/></svg>',
        share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="M8 8 12 4l4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
        sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
        mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
        pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/></svg>',
        play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5 20 12 7 19.5z"/></svg>',

        // 加上这两个专属于通知的图标
        cmtLike: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--link);"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19"/><path d="M4 10.5h3V19H4z"/></svg>',
        vidLike: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--link);"><path d="M7 10.5 12 4h1.6c.9 0 1.5.8 1.3 1.6L14 10h4.2a2 2 0 0 1 1.95 2.45l-1.3 5.5A2 2 0 0 1 16.9 19H7"/><path d="M7 10.5V19"/><path d="M4 10.5h3V19H4z"/></svg>'
    };

    const wrap = document.getElementById('sf-wrap');
    const loadTip = document.getElementById('sf-tip');
    const me = YT.user();

    let items = [];        // 已渲染的视频元数据
    let offset = 0;
    let loading = false;
    let done = false;      // 后端已无更多数据
    let current = null;    // 当前播放的 item DOM
    let likeSeen = {};     // videoId -> {liked, count}，切回时保持状态
    let viewSent = {};     // 防止同一页内重复计数
    let userMuted=false;
    // ---------- 拉取推荐流 ----------
    async function fetchFeed() {
        if (loading || done) return;
        loading = true;
        loadTip.style.display = 'flex';
        loadTip.textContent = done ? '' : '加载中…';
        try {
            const r = await YT.api.get('/api/video/select/short', { size: PAGE, offset });
            if (!r.success) throw new Error(r.message || '接口返回失败');
            const rows = r.data || [];
            if (rows.length < PAGE) done = true;
            offset += rows.length;
            rows.forEach(v => renderCard(v));
            if (!items.length && done) showEmpty();
            if (done && items.length) finishTip();
        } catch (e) {
            loadTip.textContent = '加载失败：' + e.message;
            done = true;
        } finally {
            loading = false;
            if (done) loadTip.style.display = 'flex';
            else if (items.length) loadTip.style.display = 'none';
        }
    }
    function finishTip() {
        loadTip.textContent = '没有更多短视频了';
    }
    function showEmpty() {
        items = [];
        const d = document.createElement('div');
        d.className = 'sf-end';
        d.style.cssText = 'height:60vh;font-size:15px;';
        d.textContent = '还没有人上传短视频（时长 60 秒以内的竖屏/横屏视频会自动归入这里）';
        wrap.appendChild(d);
    }

    // ---------- 渲染一条 ----------
    function renderCard(v) {
        const id = String(YT.pick(v, 'id'));
        const title = String(YT.pick(v, 'title') || '未命名短视频');
        const up = String(YT.pick(v, 'uploader') || '匿名');
        const upId = String(YT.pick(v, 'userId', 'user_id') || '');
        // 播放地址：优先前端自己截文件名（与首页一致，兼容反斜杠路径）；
        // 后端 play_url 是 SQL 按 '/' 截的，Windows 盘符路径下会拼坏，只做兜底
        const play = YT.mediaUrl(YT.pick(v, 'videoPath', 'video_path'))
                  || String(YT.pick(v, 'playUrl', 'play_url') || '');
        const views = Number(YT.pick(v, 'viewCount', 'view_count') || 0);
        const likes = Number(YT.pick(v, 'likeCount', 'like_count') || 0);
        const cmts = Number(YT.pick(v, 'commentCount', 'comment_count') || 0);
        const avatar = YT.mediaUrl(YT.pick(v, 'uploaderAvatar', 'uploader_avatar'));

        const el = document.createElement('section');
        el.className = 'sf-item';
        el.dataset.id = id;
        el.dataset.up = up;
        el.dataset.upid = upId;
        el.innerHTML =
            '<video playsinline webkit-playsinline preload="metadata" src="' + YT.esc(play) + '"></video>'
            + '<button class="sf-mute" type="button">' + ICON.mute + '</button>'
            + '<div class="sf-playhint">' + ICON.pause + '</div>'
            + '<div class="sf-prog"><i></i></div>'
            + '<div class="sf-info">'
            +   '<div class="sf-title">' + YT.esc(title) + '</div>'
            +   '<div class="sf-sub"><a class="sf-up" href="#">' + YT.esc(up) + '</a>'
            +     '<span class="sf-dot"> · </span><span class="sf-views">' + YT.fmtNum(views) + '</span> 次观看'
            +     '<span class="sf-dot"> · </span>' + YT.timeAgo(YT.pick(v, 'createTime', 'create_time'))
            +   '</div>'
            + '</div>'
            + '<div class="sf-bar">'
            +   '<div class="sf-avatar-wrap"><a class="sf-up-link" href="#"><img class="sf-avatar" '
            +     (avatar ? 'src="' + YT.esc(avatar) + '" alt=""' : 'alt="" style="opacity:.4"') + '></a></div>'
            +   '<button class="sf-act js-like" type="button" data-count="' + likes + '">'
            +     '<span class="sf-ic">' + ICON.like + '</span><span class="sf-n">' + YT.fmtNum(likes) + '</span></button>'
            +   '<button class="sf-act js-cmt" type="button">'
            +     '<span class="sf-ic">' + ICON.comment + '</span><span class="sf-n" data-cnt="' + cmts + '">' + YT.fmtNum(cmts) + '</span></button>'
            +   '<button class="sf-act js-share" type="button">'
            +     '<span class="sf-ic">' + ICON.share + '</span><span>分享</span></button>'
            + '</div>';

        // 封面：视频首帧（后端 cover_path 已有则用图片兜底，避免黑屏等待）
        const cover = YT.pick(v, 'coverPath', 'cover_path');
        if (cover) {
            const poster = document.createElement('img');
            poster.src = YT.mediaUrl(cover);
            poster.alt = '';
            poster.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;pointer-events:none;';
            el.insertBefore(poster, el.querySelector('.sf-mute'));
            const vd = el.querySelector('video');
            vd.addEventListener('playing', () => poster.remove(), { once: true });
            vd.addEventListener('error', () => poster.remove(), { once: true });
        }

        bindCard(el, id);
        wrap.appendChild(el);
        items.push(el);
        observe(el);
    }

    // ---------- 单条交互 ----------
    function bindCard(el, id) {
        const vd = el.querySelector('video');
        const hint = el.querySelector('.sf-playhint');
        const muteBtn = el.querySelector('.sf-mute');
        const bar = el.querySelector('.sf-prog i');

        // 素材是横屏还是竖屏，用真实分辨率判断（接口没返回 is_vertical）
        vd.addEventListener('loadedmetadata', () => {
            if (vd.videoWidth > vd.videoHeight) el.classList.add('landscape');
        });

        vd.addEventListener('timeupdate', () => {
            if (vd.duration) bar.style.width = (vd.currentTime / vd.duration * 100) + '%';
        });
        vd.addEventListener('ended', () => { vd.currentTime = 0; vd.play(); });  // 循环播放

        // 点击画面切换播放/暂停
        vd.addEventListener('click', () => toggle(el, hint));

        muteBtn.onclick = () => {
            vd.muted = !vd.muted;
            userMuted = vd.muted; // 记住用户的声音偏好，滑到下一条也保持有声

            muteBtn.innerHTML = vd.muted ? ICON.mute : ICON.sound;
            if (!vd.muted) hint.classList.remove('show');
        };

        el.querySelector('.js-like').onclick = () => doLike(el, id);
        el.querySelector('.js-cmt').onclick = () => openComments(el, id);
        el.querySelector('.js-share').onclick = async () => {
            const url = location.origin + location.pathname + '#v=' + id;
            try {
                await navigator.clipboard.writeText(url);
                YT.toast('链接已复制');
            } catch (e) {
                YT.toast('复制链接：' + url);
            }
        };

        const upLink = el.querySelector('.sf-up-link'), upName = el.querySelector('.sf-up');
        const goUp = (ev) => {
            ev.preventDefault();
            const uid = el.dataset.upid;
            if (!uid) return YT.toast('该视频没有 UP 主信息');
            location.href = 'profile.html?userId=' + encodeURIComponent(uid) + '&name=' + encodeURIComponent(el.dataset.up);
        };
        upLink.onclick = goUp;
        upName.onclick = goUp;

        // 点赞状态回填（滚动回来时保持）
        const seen = likeSeen[id];
        if (seen) paintLike(el, seen.liked, seen.count);
    }

    function toggle(el, hint) {
        const vd = el.querySelector('video');
        if (vd.paused) { vd.play().then(() => hint.classList.remove('show')).catch(() => hint.classList.add('show')); }
        else { vd.pause(); hint.classList.add('show'); }
    }

    // ---------- 点赞 ----------
    async function doLike(el, id) {
        if (!YT.requireLogin()) return;
        const btn = el.querySelector('.js-like');
        if (btn.dataset.busy) return;
        btn.dataset.busy = '1';
        const wasLiked = btn.classList.contains('on');
        try {
            const r = await YT.api.post(wasLiked ? '/api/video/cancel/like' : '/api/video/add/like',
                { id, userId: me.userId });
            if (r.success) {
                const liked = r.data && typeof r.data.liked === 'boolean' ? r.data.liked : !wasLiked;
                const count = r.data && r.data.like_count != null ? Number(r.data.like_count) : null;
                applyLike(el, id, liked, count);
                YT.toast(r.message || (liked ? '点赞成功' : '已取消点赞'));
            } else YT.toast(r.message || '操作失败，请重试');
        } catch (e) {
            YT.toast('请求失败：' + e.message);
        } finally {
            delete btn.dataset.busy;
        }
    }
    function applyLike(el, id, liked, count) {
        const btn = el.querySelector('.js-like');
        const cur = liked ?? btn.classList.contains('on');
        let n = count;
        if (n == null) n = Math.max(0, Number(btn.dataset.count || 0) + (cur ? 1 : -1));
        paintLike(el, cur, n);
        likeSeen[id] = { liked: cur, count: n };
    }
    function paintLike(el, liked, count) {
        const btn = el.querySelector('.js-like');
        btn.classList.toggle('on', !!liked);
        btn.dataset.count = count;
        btn.querySelector('.sf-n').textContent = YT.fmtNum(count);
    }
    // 登录态下补一次"我是否赞过"
    async function syncLike(el, id) {
        if (!me || likeSeen[id]) return;
        try {
            const r = await YT.api.get('/api/video/select/like/count', { id, userId: me.userId });
            if (r.success && r.data) {
                const liked = typeof r.data.liked === 'boolean' ? r.data.liked : undefined;
                const count = r.data.like_count != null ? Number(r.data.like_count) : undefined;
                applyLike(el, id, liked, count);
            }
        } catch (e) { /* 保持列表里带的点赞数 */ }
    }

    // ---------- 播放控制：进入视口才播，离开即停 ----------
    const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
            const el = en.target, vd = el.querySelector('video');
            if (en.isIntersecting && en.intersectionRatio > 0.6) {
                if (current && current !== el) stop(current);
                current = el;
                vd.muted = userMuted;                       // 浏览器策略：自动播放必须静音->
                                                            // 改了，改成根据上一条视频播放模式，下一条也跟着这样做
                el.querySelector('.sf-mute').innerHTML = ICON.mute;
                const p = vd.play();
                if (p && p.catch) p.catch(() => {});
                record(el, String(el.dataset.id));
                syncLike(el, String(el.dataset.id));
            } else {
                stop(el);
            }
        });
    }, { root: wrap, threshold: [0, 0.6, 1] });
    function observe(el) { io.observe(el); }
    function stop(el) {
        const vd = el.querySelector('video');
        if (vd && !vd.paused) vd.pause();
        if (current === el) current = null;
    }

    // 播放计数 + 观看历史（后端无去重，同一页内只做一次）
    function record(el, id) {
        if (viewSent[id]) return;
        viewSent[id] = 1;
        YT.api.post('/api/video/add/view', { id }).then(r => {
            if (r.success && r.data) {
                const n = r.data.view_count ?? r.data.viewCount ?? r.data.count;
                if (n != null) {
                    const el2 = el.querySelector('.sf-views');
                    if (el2) el2.textContent = YT.fmtNum(Number(n));
                }
            }
        }).catch(() => {});
        if (me) YT.api.post('/api/video/insert/history', { userId: me.userId, videoId: id }).catch(() => {});
    }

    // ---------- 评论抽屉 ----------
    const mask = document.getElementById('sf-mask');
    const drawer = document.getElementById('sf-drawer');
    const dlist = document.getElementById('sf-dlist');
    const dhead = document.getElementById('sf-dhead');
    const dinput = document.getElementById('sf-dinput');
    const dsend = document.getElementById('sf-dsend');
    let cmtFor = null;      // 当前评论归属的视频元素

    function openComments(el, id) {
        cmtFor = el;
        mask.classList.add('open');
        drawer.classList.add('open');
        loadComments(id);
        dinput.focus();
    }
    function closeComments() {
        mask.classList.remove('open');
        drawer.classList.remove('open');
        cmtFor = null;
    }
    mask.onclick = closeComments;
    document.getElementById('sf-dclose').onclick = closeComments;
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeComments(); });

    async function loadComments(id) {
        dlist.innerHTML = '<div class="empty" style="padding:20px;">加载评论…</div>';
        try {
            const r = await YT.api.get('/api/video/get/all/comments', { videoId: id });
            const rows = (r.data || []).filter(c => !c.parent_id && !c.parentId);
            dhead.textContent = '评论 ' + (r.data || []).length;
            if (!rows.length) { dlist.innerHTML = '<div class="empty" style="padding:20px;">还没有评论，来说两句吧</div>'; return; }
            dlist.innerHTML = rows.map(c => {
                const who = String(YT.pick(c, 'commenter') || YT.pick(c, 'userId', 'user_id') || '匿名用户');
                return '<div class="sf-cmt"><span class="sf-cav">' + YT.esc(who.slice(0, 1).toUpperCase()) + '</span>'
                    + '<div class="sf-cbody"><div class="sfcname">' + YT.esc(who)
                    + '<span style="float:right;color:var(--text-tertiary);font-size:12px;">' + YT.timeAgo(YT.pick(c, 'createTime', 'create_time')) + '</span></div>'
                    + '<div class="sfctext">' + YT.esc(YT.pick(c, 'contents') || YT.pick(c, 'content')) + '</div></div></div>';
            }).join('');
        } catch (e) {
            dlist.innerHTML = '<div class="empty" style="padding:20px;">评论加载失败：' + YT.esc(e.message) + '</div>';
        }
    }

    dsend.onclick = async () => {
        if (!YT.requireLogin()) return;
        if (!cmtFor) return;
        const content = dinput.value.trim();
        if (!content) return YT.toast('评论内容不能为空');
        dsend.disabled = true;
        try {
            const r = await YT.api.post('/api/video/add/my/comments', {
                commentId: YT.randId(), videoId: String(cmtFor.dataset.id),
                userId: me.userId, content, parentId: null
            });
            if (r.success) {
                dinput.value = '';
                YT.toast('评论成功');
                loadComments(String(cmtFor.dataset.id));
                const n = cmtFor.querySelector('.js-cmt .sf-n');
                if (n) { const c = Number(n.dataset.cnt || 0) + 1; n.dataset.cnt = c; n.textContent = YT.fmtNum(c); }
            } else YT.toast(r.message || '评论失败');
        } catch (e) {
            YT.toast('请求失败：' + e.message);
        } finally {
            dsend.disabled = false;
        }
    };

    // ---------- 滚动加载下一页 ----------
    wrap.addEventListener('scroll', () => {
        if (done || loading) return;
        if (items.length - visibleIndex() < LOAD_AHEAD) fetchFeed();
    });
    function visibleIndex() {
        if (!current) return 0;
        const i = items.indexOf(current);
        return i < 0 ? 0 : i;
    }

    // 键盘上下键翻页，接近 YouTube Shorts 的操作习惯
    document.addEventListener('keydown', e => {
        if (drawer.classList.contains('open')) return;
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
        if (!step || !current) return;
        const i = items.indexOf(current) + step;
        if (items[i]) { items[i].scrollIntoView({ behavior: 'smooth' }); e.preventDefault(); }
    });

    // 直达某条：#v=视频id（分享链接带过来的）
    const hm = location.hash.match(/^#v=(.+)$/);
    const hashId = hm ? decodeURIComponent(hm[1]) : '';
    async function jumpToTarget() {
        if (!hashId) return;
        while (!items.find(x => String(x.dataset.id) === hashId)) {
            if (done || loading) break;
            await fetchFeed();
        }
        const el = items.find(x => String(x.dataset.id) === hashId);
        if (el) el.scrollIntoView();
    }

    fetchFeed().then(jumpToTarget);
})();
