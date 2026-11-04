/* 观看历史页：数据源 GET /api/video/select/history?userId=
 * 返回 Result<List<Map>>，单条字段：video_id / watch_time / title / video_path /
 * cover_path / view_count / like_quantity / create_time / uploader（后端按 watch_time 倒序，最多 200 条）
 * 说明：后端暂未提供"删除历史"接口，故本页面只做展示，不放置会报错的删除按钮。 */
(async function () {
    const u = YT.user();
    if (!YT.requireLogin('登录后查看观看历史')) return;

    const list = document.getElementById('his-list');
    const empty = document.getElementById('his-empty');
    const count = document.getElementById('his-count');

    function card(v) {
        const id = YT.pick(v, 'video_id', 'videoId');
        const title = YT.pick(v, 'title');
        const up = YT.pick(v, 'uploader') || '未知UP主';
        const views = YT.pick(v, 'view_count', 'viewCount');
        const watched = YT.pick(v, 'watch_time', 'watchTime');
        return `
        <div class="card" onclick="location.href='watch.html?id=${encodeURIComponent(id)}'">
            ${YT.thumb(v)}
            <div class="meta">
                <span class="avatar">${YT.esc(String(up).slice(0, 1).toUpperCase())}</span>
                <div class="txt">
                    <div class="title">${YT.esc(title) || '（视频已不存在）'}</div>
                    <div class="sub">${YT.esc(up)}</div>
                    <div class="sub">${YT.fmtNum(views)} 次观看</div>
                    <div class="sub">观看于 ${YT.esc(YT.timeAgo(watched) || YT.fmtFull(watched))}</div>
                </div>
            </div>
        </div>`;
    }

    list.innerHTML = '<div class="empty">加载中…</div>';
    try {
        const res = await YT.api.get('/api/video/select/history', { userId: u.userId });
        const rows = Array.isArray(res && res.data) ? res.data : [];
        if (!rows.length) {
            list.innerHTML = '';
            empty.textContent = '还没有观看记录，去随便看几个视频吧';
            empty.style.display = 'block';
            return;
        }
        count.textContent = `· 共 ${rows.length} 条`;
        list.innerHTML = '<div class="grid">' + rows.map(card).join('') + '</div>';
    } catch (e) {
        list.innerHTML = '';
        empty.textContent = '加载失败：' + e.message;
        empty.style.display = 'block';
    }
})();
