/* 播放页
 * GET  /api/video/select/video/single/infor?id=      视频详情（已含 like_count）
 * GET  /api/video/select/path?id=                    视频路径
 * GET  /api/video/select/videos/upinfor              侧栏推荐
 * GET  /api/video/get/all/comments?videoId=          评论
 * GET  /api/video/select/parent/comments?parentId=   楼中楼
 * POST /api/video/add/my/comments                    发表评论/回复
 * POST /api/video/edit/my/comments                   修改我的评论
 * DEL  /api/video/delete/my/comments                 删除我的评论
 * POST /api/video/edit/title                         修改视频标题
 * DEL  /api/video/delete/videos                      删除视频
 * GET  /api/video/select/like/count?id=&userId=      点赞数 + 我是否赞过
 * POST /api/video/add/like                           点赞（重复点赞返回已赞状态）
 * POST /api/video/cancel/like                        取消点赞
 * POST /api/video/add/view                           播放计数 +1（进页面上报一次，返回数据库真实播放量）
 */
(async function () {
    const id = new URLSearchParams(location.search).get('id');
    const me = YT.user();
    if (!id) { location.href = 'index.html'; return; }

    const $ = s => document.querySelector(s);
    let video = null;

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
    // 发私信入口：登录且不是本人时才显示
    if (me && upId && me.userId !== upId) {
        const pmBtn = $('#w-pm');
        pmBtn.style.display = '';
        pmBtn.onclick = e => {
            e.stopPropagation();
            location.href = 'message.html?peer=' + encodeURIComponent(upId) + '&name=' + encodeURIComponent(upName);
        };
    }

    // ---------- 关注模块（后端 /api/user，与频道页同一口径）----------
    // 后端只有"粉丝列表/关注列表"查询，没有计数接口，
    // 所以粉丝数=列表长度，"我是否已关注"=粉丝列表里有没有我
    const followBtn = $('#btn-follow'), fansEl = $('#w-up-fans');
    let following = false, fansCount = 0, followBusy = false;
    function paintFollow() {
        followBtn.classList.toggle('light', following);
        followBtn.innerHTML = following ? '已关注' : '关注';
        followBtn.disabled = followBusy;
        fansEl.textContent = fansCount > 0 ? `${YT.fmtNum(fansCount)} 位粉丝` : '';
    }
    if (me && upId && me.userId !== upId) {
        followBtn.style.display = '';
        paintFollow();
    }
    // 粉丝数游客也展示；登录时顺带判断"我是否已关注"
    YT.api.get('/api/user/select/me/fans', { me: upId })
        .then(r => {
            const fans = (r && r.data) || [];
            fansCount = fans.length;
            following = !!(me && fans.some(f => String(YT.pick(f, 'user_id')) === me.userId));
            paintFollow();
        })
        .catch(() => { /* 拉不到就不显示数字，不影响看视频 */ });

    if (me && upId && me.userId !== upId) {
        followBtn.onclick = async e => {
            e.stopPropagation();            // 别触发 #w-up 的跳转
            if (followBusy) return;
            followBusy = true; paintFollow();
            const wasFollowing = following;
            try {
                const url = wasFollowing ? '/api/user/unfollow' : '/api/user/follow';
                const res = await YT.api.post(url, { me: me.userId, upId: upId });
                if (res.success) {
                    following = !wasFollowing;
                    fansCount = Math.max(0, fansCount + (following ? 1 : -1));
                    YT.toast(res.message || (wasFollowing ? '已取关' : '关注成功'));
                } else {
                    YT.toast(res.message || '操作失败，请重试');
                }
            } catch (err) {
                YT.toast('请求失败：' + err.message);
            } finally {
                followBusy = false; paintFollow();
            }
        };
    }
    $('#w-desc').innerHTML = `<b>视频文件路径：</b>${YT.esc(YT.pick(video, 'video_path'))}<br>
        <b>视频 ID：</b>${YT.esc(id)}　<b>点赞数：</b>${YT.esc(YT.pick(video, 'like_count') || 0)}`;

    // ---------- 播放计数：进页面上报一次，用后端回读的真实值就地刷新 ----------
    // 不 await，计数失败不影响看视频；重复计数（刷新页面）目前是已知偏差，未做去重
    YT.api.post('/api/video/add/view', { id })
        .then(r => {
            if (!r.success) return;
            const v = Number(r.data && r.data.view_count);
            if (Number.isFinite(v)) {
                $('#w-stats').textContent = `${YT.fmtNum(v)} 次观看 · ${YT.fmtFull(YT.pick(video, 'create_time'))}`;
            }
        })
        .catch(() => { /* 保持详情里带过来的播放量 */ });

    const isMine = me && me.userId === upId;
    if (isMine) { $('#btn-edit').style.display = ''; $('#btn-del').style.display = ''; }

    // ---------- 播放器：后端只存了本地绝对路径，未做静态资源映射时无法直接播放 ----------
    let path = String(YT.pick(video, 'video_path'));
    if (!path) {
        try {
            const r = await YT.api.get('/api/video/select/path', { id });
            path = String((r.data || [])[0]?.video_path || (r.data || [])[0]?.videoPath || '');
        } catch (e) { /* 忽略 */ }
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
            showFallback(`浏览器取不到这个文件<br>
                <code style="font-size:12px;color:#ddd;word-break:break-all;">${YT.esc(path)}</code><br>
                <code style="font-size:12px;color:#ddd;word-break:break-all;">${YT.esc(url)}</code><br>
                <span style="font-size:12px;">服务器已把视频目录挂到 <b>/videos/</b> 网址下。<br>
                播不出来通常是<b>文件名不在那个目录里</b>：这条记录登记的路径与实际存放位置不一致。<br>
                重新上传一次即可（新上传的文件会自动落到正确目录）。</span>`);
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
    } catch (e) { /* 忽略 */ }

    // ---------- 点赞（后端 video_like 表为准，支持点赞/取消） ----------
    const likeBtn = $('#btn-like'), likeNum = $('#w-likes');
    let likeCount = Number(YT.pick(video, 'like_count') || 0);
    let liked = false;        // 以服务端返回为准，未登录时恒为 false
    let likeBusy = false;

    function paintLike() {
        likeBtn.classList.toggle('light', liked);
        likeBtn.innerHTML = liked ? '&#128077; 已赞' : '&#128077; 点赞';
        likeNum.textContent = likeCount > 0 ? `${YT.fmtNum(likeCount)} 人点赞` : '';
    }
    function applyLike(d) {
        if (d && d.like_count !== undefined && d.like_count !== null) likeCount = Number(d.like_count) || 0;
        if (d && typeof d.liked === 'boolean') liked = d.liked;
        paintLike();
    }
    paintLike();

    // 拉一次服务端真实点赞数（登录时附带 userId 以获取"我是否赞过"）；不 await，避免拖慢评论区加载
    YT.api.get('/api/video/select/like/count', me ? { id, userId: me.userId } : { id })
        .then(r => { if (r.success) applyLike(r.data); })
        .catch(() => { /* 保持详情里带过来的点赞数 */ });

    likeBtn.onclick = async () => {
        if (!YT.requireLogin()) return;
        if (likeBusy) return;
        likeBusy = true;
        likeBtn.disabled = true;
        const wasLiked = liked;
        try {
            const url = liked ? '/api/video/cancel/like' : '/api/video/add/like';
            const r = await YT.api.post(url, { id, userId: me.userId });
            if (r.success) {
                applyLike(r.data);
                YT.toast(r.message || (wasLiked ? '已取消点赞' : '点赞成功'));
            } else {
                YT.toast(r.message || '操作失败，请重试');
            }
        } catch (e) {
            YT.toast('请求失败：' + e.message);
        } finally {
            likeBusy = false;
            likeBtn.disabled = false;
        }
    };

    // ---------- 自己的视频：改标题 / 删除 ----------
    $('#btn-edit').onclick = async () => {
        const t = prompt('输入新的视频标题：', title);
        if (t === null || !t.trim()) return;
        const r = await YT.api.post('/api/video/edit/title', { newTitle: t.trim(), id, userId: me.userId });
        if (r.success) { YT.toast('标题已修改'); setTimeout(() => location.reload(), 700); }
        else YT.toast(r.message || '修改失败');
    };
    $('#btn-del').onclick = async () => {
        if (!confirm('确定删除这个视频吗？评论会一并删除，且不可恢复。')) return;
        const r = await YT.api.del('/api/video/delete/videos', { id, userId: me.userId });
        if (r.success) { YT.toast('已删除'); setTimeout(() => location.href = 'profile.html', 800); }
        else YT.toast(r.message || '删除失败');
    };

    // ---------- 评论区 ----------
    if (me) {
        $('#me-av1').textContent = (me.nickname || me.userId).slice(0, 1).toUpperCase();
    } else {
        // 游客：表单保持可见但禁用，让游客知道"这里可以评论"，点击提交时再引导登录
        $('#me-av1').textContent = '\uD83D\uDD12';
        $('#me-av1').style.filter = 'grayscale(1)';
        $('#me-av1').style.opacity = '.6';
        const ta = $('#root-content');
        ta.readOnly = true;
        ta.placeholder = '登录后即可发表评论…';
        $('#root-cancel').style.display = 'none';
    }

    const list = $('#c-list');

    function opBtns(c, isMine) {
        return `<div class="ops">
            <span data-reply="${YT.esc(YT.pick(c, 'comment_id'))}">回复</span>
            ${isMine ? `<span data-edit="${YT.esc(YT.pick(c, 'comment_id'))}">修改</span>
                       <span data-del="${YT.esc(YT.pick(c, 'comment_id'))}" style="color:var(--danger);">删除</span>` : ''}
        </div>`;
    }

    function item(c, isReply) {
        const cid = String(YT.pick(c, 'comment_id'));
        const who = String(YT.pick(c, 'commenter') || YT.pick(c, 'user_id') || '匿名用户');
        const isMine = !!me && String(YT.pick(c, 'user_id')) === me.userId;
        // 游客：回复框仍可查看已有回复，但输入框设为只读，避免打完字提交时才被拦导致内容丢失
        const roAttr = me ? '' : ' readonly';
        const roPh = me ? `回复 ${YT.esc(who)}…` : '登录后即可回复…';
        return `
        <div class="comment" data-cid="${YT.esc(cid)}">
            <span class="avatar ${isReply ? '' : ''}">${YT.esc(who.slice(0, 1).toUpperCase())}</span>
            <div class="body">
                <div class="who">${YT.esc(who)}<span class="time">${YT.timeAgo(YT.pick(c, 'create_time'))}</span></div>
                <div class="text">${YT.esc(YT.pick(c, 'contents'))}</div>
                ${opBtns(c, isMine)}
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

    async function loadReplies(cid, box) {
        try {
            const r = await YT.api.get('/api/video/select/parent/comments', { parentId: cid });
            const rs = r.data || [];
            box.innerHTML = rs.map(c => item(c, true)).join('');
        } catch (e) { /* 忽略 */ }
    }

    async function loadComments() {
        list.innerHTML = '<div class="empty" style="padding:20px;">加载评论…</div>';
        let data = [];
        try {
            const r = await YT.api.get('/api/video/get/all/comments', { videoId: id });
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

        // 把已查到的回复直接归位（省一次请求），同时支持展开楼中楼
        roots.forEach(rc => {
            const cid = String(YT.pick(rc, 'comment_id'));
            const box = list.querySelector(`[data-replies="${CSS.escape(cid)}"]`);
            const mine = replies.filter(r => String(YT.pick(r, 'parent_id') || YT.pick(r, 'parentId')) === cid);
            if (box && mine.length) box.innerHTML = mine.map(c => item(c, true)).join('');
        });
    }

    // ---------- 交互 ----------
    $('#root-cancel').onclick = () => { $('#root-content').value = ''; };
    $('#root-submit').onclick = async () => {
        if (!YT.requireLogin()) return;
        const content = $('#root-content').value.trim();
        if (!content) return YT.toast('评论内容不能为空');
        const r = await YT.api.post('/api/video/add/my/comments', {
            commentId: YT.randId(), videoId: id, userId: me.userId, content, parentId: null
        });
        if (r.success) { $('#root-content').value = ''; YT.toast('评论成功'); loadComments(); }
        else YT.toast(r.message || '评论失败');
    };

    list.addEventListener('click', async e => {
        const t = e.target, cid = t.dataset;

        if (cid.reply) {
            const box = t.closest('.comment').querySelector('.reply-form');
            box.classList.toggle('open');
            if (box.classList.contains('open') && !box.dataset.loaded) {
                await loadReplies(cid.reply, box.closest('.body').querySelector(`[data-replies="${CSS.escape(cid.reply)}"]`));
                box.dataset.loaded = '1';
            }
            return;
        }
        if (cid.cancelReply !== undefined) { t.closest('.reply-form').classList.remove('open'); return; }

        if (cid.sendReply) {
            if (!YT.requireLogin()) return;
            const form = t.closest('.reply-form');
            const content = form.querySelector('textarea').value.trim();
            if (!content) return YT.toast('回复不能为空');
            const r = await YT.api.post('/api/video/add/my/comments', {
                commentId: YT.randId(), videoId: id, userId: me.userId, content, parentId: cid.sendReply
            });
            if (r.success) { form.querySelector('textarea').value = ''; form.classList.remove('open'); YT.toast('回复成功'); loadComments(); }
            else YT.toast(r.message || '回复失败');
            return;
        }

        if (cid.del) {
            if (!confirm('删除这条评论？')) return;
            const r = await YT.api.del('/api/video/delete/my/comments', { myUserId: me.userId, videoId: id, commentId: cid.del });
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
            const r = await YT.api.post('/api/video/edit/my/comments', { newContent: content, commentId: t.dataset.editSave, myUserId: me.userId });
            if (r.success) { YT.toast('已修改'); loadComments(); } else YT.toast(r.message || '修改失败');
            return;
        }
    });

    loadComments();
})();
