/* 频道页：profile.html[?userId=xxx&name=yyy]
 * 不带参数 = 我的频道；带 userId = 看别人（从播放页 UP 主进入时可用）
 * GET /api/video/select?userId=  该用户的视频
 * POST /api/video/edit/title     改自己视频标题
 * DEL  /api/video/delete/videos  删自己视频
 */
(async function () {
    const me = YT.user();
    const qs = new URLSearchParams(location.search);
    const userId = qs.get('userId') || (me && me.userId);
    if (!userId) { YT.requireLogin('登录后访问你的频道'); return; }
    const isMine = !!me && userId === me.userId;
    const name = qs.get('name') || (isMine ? (me && me.nickname) : 'UP主');

    $('#ch-name').textContent = name || 'UP主';
    $('#ch-id').textContent = 'ID: ' + userId;
    $('#ch-av').textContent = String(name || userId).slice(0, 1).toUpperCase();
    document.title = (name || '频道') + ' - YouTube';
    if (isMine) $('#ch-upload').style.display = '';

    function $(s) { return document.querySelector(s); }

    const box = $('#vlist'), empty = $('#empty');
    box.innerHTML = '<div class="empty" style="padding:20px;">加载中…</div>';

    let list = [];
    try {
        const r = await YT.api.get('/api/video/select', { userId });
        list = r.data || [];
    } catch (e) {
        box.innerHTML = '';
        empty.textContent = '加载失败：' + e.message;
        empty.style.display = 'block';
        return;
    }

    if (!list.length) {
        box.innerHTML = '';
        empty.textContent = isMine ? '你还没有发布任何视频' : '这位UP主还没有视频';
        empty.style.display = 'block';
        return;
    }

    $('#ch-count').textContent = list.length + ' 个视频';
    box.innerHTML = list.map(v => {
        const id = YT.pick(v, 'id');
        return `
        <div class="vitem">
            <div class="thumb-s" style="cursor:pointer;" onclick="location.href='watch.html?id=${encodeURIComponent(id)}'">${
                YT.mediaUrl(YT.pick(v, 'video_path'))
                ? `<video muted preload="metadata" playsinline src="${YT.mediaUrl(YT.pick(v, 'video_path'))}#t=0.1"></video>`
                : '&#9654;'
            }</div>
            <div class="vi-body" style="cursor:pointer;" onclick="location.href='watch.html?id=${encodeURIComponent(id)}'">
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

    if (!isMine) return;
    box.addEventListener('click', async e => {
        const t = e.target;
        if (t.dataset.edit) {
            const nt = prompt('新的视频标题：', t.dataset.title);
            if (nt === null || !nt.trim()) return;
            const r = await YT.api.post('/api/video/edit/title', { newTitle: nt.trim(), id: t.dataset.edit, userId: me.userId });
            if (r.success) { YT.toast('已修改'); setTimeout(() => location.reload(), 600); }
            else YT.toast(r.message || '修改失败');
        }
        if (t.dataset.del) {
            if (!confirm('确定删除这个视频？')) return;
            const r = await YT.api.del('/api/video/delete/videos', { id: t.dataset.del, userId: me.userId });
            if (r.success) { YT.toast('已删除'); setTimeout(() => location.reload(), 600); }
            else YT.toast(r.message || '删除失败');
        }
    });
})();
