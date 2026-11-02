/* 动态页
 * POST /api/dynamic/dynamic/write (content, id, userId)
 * GET  /api/dynamic/dynamic/select/all (id, content, createTime) —— 三字段精确匹配
 * DEL  /api/dynamic/dynamic/delete (id, createTime)
 * POST /api/dynamic/dynamic/edit (newContent, id, createTime)
 * 由于后端没有"列出我的动态"接口，列表用 localStorage 镜像（yt_dyn_mine）
 */
(async function () {
    const me = YT.user();
    if (!me) {
        try { sessionStorage.setItem('yt_from', 'dynamic.html'); } catch (e) { /* 忽略 */ }
        YT.toast('登录后即可管理动态');
        setTimeout(() => { location.href = 'login.html'; }, 600);
        return;
    }

    const $ = s => document.querySelector(s);
    const tip = $('#dyn-tip');
    const list = $('#dyn-list'), emptyEl = $('#dyn-empty');

    const mirrorKey = 'yt_dyn_mine_' + me.userId;
    const getMirror = () => JSON.parse(localStorage.getItem(mirrorKey) || '[]');
    const setMirror = arr => localStorage.setItem(mirrorKey, JSON.stringify(arr.slice(0, 100)));

    function show(msg, ok) { tip.textContent = msg; tip.className = 'tip ' + (ok ? 'ok' : 'err'); }

    function itemEl(d) {
        return `
        <div class="dyn-item">
            <div class="d-content">${YT.esc(d.content)}</div>
            <div class="d-meta">
                <span>ID: ${YT.esc(d.id)}</span>
                <span>时间: ${YT.esc(d.createTime)}</span>
                <span>${YT.timeAgo(d.createTime)}</span>
            </div>
            <div class="d-ops">
                <span data-del="${YT.esc(d.id)}" data-time="${YT.esc(d.createTime)}" style="color:var(--danger);">删除</span>
                <span data-edit="${YT.esc(d.id)}" data-time="${YT.esc(d.createTime)}">修改</span>
            </div>
        </div>`;
    }

    function render() {
        const arr = getMirror();
        list.innerHTML = arr.map(itemEl).join('');
        emptyEl.style.display = arr.length ? 'none' : 'block';
    }

    // 发布时间：用本机此刻（与服务器 CURRENT_TIMESTAMP 通常同秒），ISO 格式 LocalDateTime 可解析
    function nowISO() {
        const d = new Date(), p = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    $('#dyn-write').onclick = async () => {
        const content = $('#dyn-content').value.trim();
        if (!content) return show('动态内容不能为空', false);
        const id = YT.randId();
        const createTime = nowISO();
        try {
            const r = await YT.api.post('/api/dynamic/dynamic/write', { content, id, userId: me.userId });
            const data = r.data || {};
            if (r.success && data.success !== false) {
                setMirror([{ id, content, createTime }, ...getMirror()]);
                $('#dyn-content').value = '';
                show('发布成功', true);
                render();
            } else {
                show(data.message || r.message || '发布失败', false);
            }
        } catch (e) { show('网络错误：' + e.message, false); }
    };

    list.addEventListener('click', async e => {
        const t = e.target, ds = t.dataset;
        if (ds.del) {
            if (!confirm('删除这条动态？')) return;
            const r = await YT.api.del('/api/dynamic/dynamic/delete', { id: ds.del, createTime: ds.time });
            const data = r.data || {};
            if (r.success && data.success !== false) {
                setMirror(getMirror().filter(d => d.id !== ds.del));
                YT.toast('已删除'); render();
            } else YT.toast(data.message || r.message || '删除失败（后端按 ID+创建时间精确匹配，时间不一致时删不掉）');
        }
        if (ds.edit) {
            const cur = getMirror().find(d => d.id === ds.edit);
            const nc = prompt('修改动态内容：', cur ? cur.content : '');
            if (nc === null || !nc.trim()) return;
            const r = await YT.api.post('/api/dynamic/dynamic/edit', { newContent: nc.trim(), id: ds.edit, createTime: ds.time });
            const data = r.data || {};
            if (r.success && data.success !== false) {
                setMirror(getMirror().map(d => d.id === ds.edit ? { ...d, content: nc.trim() } : d));
                YT.toast('已修改'); render();
            } else YT.toast(data.message || r.message || '修改失败（时间不匹配时后端无法定位该动态）');
        }
    });

    $('#dyn-query').onclick = async () => {
        const id = $('#q-id').value.trim(), content = $('#q-content').value.trim(), time = $('#q-time').value.trim();
        const out = $('#q-result');
        if (!id || !content || !time) { out.innerHTML = '<div class="note">三个条件都要填写（后端要求精确匹配）</div>'; return; }
        try {
            const r = await YT.api.get('/api/dynamic/dynamic/select/all', { id, content, createTime: time });
            const arr = r.data || [];
            out.innerHTML = arr.length
                ? arr.map(d => itemEl({ id: YT.pick(d, 'myid', 'id'), content: YT.pick(d, 'content'), createTime: YT.pick(d, 'create_time') })).join('')
                : '<div class="note">没有匹配的动态（ID、内容、创建时间需与数据库完全一致）</div>';
        } catch (e) { out.innerHTML = '<div class="note">查询失败：' + YT.esc(e.message) + '</div>'; }
    };

    render();
})();
