/* 举报历史页
 *
 * 依赖后端：
 *   GET  /api/video/select/my/reports?userId=&videoId=   我举报过的评论（videoId 省略/0 = 全部）
 *   POST /api/video/check/reported/comments             让 DeepSeek 审核所有 status=0 的举报
 *
 * 状态：0=待处理  1=已通过(评论被删)  2=已驳回(不违规)
 * 注意：评论被删时，video_comment_report 会按外键 ON DELETE CASCADE 一起删掉，
 *       所以 status=1 实际很少能查到，页面按上面三类渲染，查不到就说明"已删除"。
 */
(async function () {
    const me = YT.user();
    if (!YT.requireLogin('登录后查看你的举报记录')) return;

    const $ = s => document.querySelector(s);
    const listEl  = $('#rep-list');
    const emptyEl = $('#rep-empty');
    const statEl  = $('#rep-stat');
    const auditBtn = $('#rep-audit');

    // 举报原因枚举（必须与后端 reason 字段保持一致）
    const REASON = {
        porn:    '色情低俗',
        abuse:   '谩骂攻击',
        ad:      '垃圾广告',
        spam:    '重复刷屏',
        illegal: '违法有害',
        other:   '其他'
    };
    const STATUS = {
        0: { text: '待处理',           cls: 'wait' },
        1: { text: '已通过 · 已删除',  cls: 'pass' },
        2: { text: '已驳回 · 不违规',  cls: 'rej'  }
    };

    const str = v => (v === null || v === undefined) ? '' : String(v);

    function rowHtml(r) {
        const cid     = str(YT.pick(r, 'commentId', 'comment_id'));
        const vid     = str(YT.pick(r, 'videoId', 'video_id'));
        const reason  = str(YT.pick(r, 'reason'));
        const detail  = str(YT.pick(r, 'detail')).trim();
        const status  = Number(YT.pick(r, 'status') || 0);
        const created = str(YT.pick(r, 'createTime', 'create_time'));
        const handled = str(YT.pick(r, 'handleTime', 'handle_time'));
        const text    = str(YT.pick(r, 'commentContents', 'comment_contents')).trim();
        const who     = str(YT.pick(r, 'commentUserName', 'comment_user_name') || YT.pick(r, 'commentUserId', 'comment_user_id'));

        const st = STATUS[status] || { text: '未知状态', cls: 'rej' };
        const reasonText = REASON[reason] || reason || '未说明';

        // 评论正文：被删了（或是空内容）给个占位，别显示成空白
        const quote = text
            ? `<div class="rep-quote">${YT.esc(text.length > 200 ? text.slice(0, 200) + '…' : text)}</div>`
            : `<div class="rep-quote gone">（原评论已删除，或评论内容为空）</div>`;

        return `
        <div class="rep-item">
            <div class="rep-top">
                <span class="rep-reason">${YT.esc(reasonText)}</span>
                <span class="rep-chip ${st.cls}">${YT.esc(st.text)}</span>
                <span class="rep-time">${YT.esc(created ? YT.timeAgo(created) || created : '')}</span>
            </div>
            ${quote}
            ${detail ? `<div class="rep-detail">补充说明：${YT.esc(detail)}</div>` : ''}
            <div class="rep-foot">
                ${who ? `<span>被举报人：${YT.esc(who)}</span>` : ''}
                ${vid ? `<a href="watch.html?id=${encodeURIComponent(vid)}">查看视频</a>` : ''}
                <span>评论ID：${YT.esc(cid || '—')}</span>
                ${handled ? `<span>处理于 ${YT.esc(handled)}</span>` : ''}
            </div>
        </div>`;
    }

    function render(rows) {
        if (!rows.length) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            statEl.textContent = '共 0 条举报记录';
            return;
        }
        emptyEl.style.display = 'none';
        listEl.innerHTML = rows.map(rowHtml).join('');

        const wait = rows.filter(r => Number(YT.pick(r, 'status') || 0) === 0).length;
        const pass = rows.filter(r => Number(YT.pick(r, 'status') || 0) === 1).length;
        const rej  = rows.filter(r => Number(YT.pick(r, 'status') || 0) === 2).length;
        statEl.textContent = `共 ${rows.length} 条 · 待处理 ${wait} · 已通过 ${pass} · 已驳回 ${rej}`;
    }

    async function load() {
        listEl.innerHTML = '<div class="empty" style="padding:20px;">加载中…</div>';
        emptyEl.style.display = 'none';
        try {
            const r = await YT.api.get('/api/video/select/my/reports', { userId: me.userId });
            // 接口异常时不要把"加载失败"说成"没有举报记录"
            if (!r || r.success === false || !Array.isArray(r.data)) {
                throw new Error((r && r.message) || '接口返回异常');
            }
            render(r.data);
        } catch (e) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            emptyEl.textContent = '加载失败：' + (e && e.message ? e.message : '网络错误');
            statEl.textContent = '';
        }
    }

    // 手动触发一次 AI 审核：本地 ollama 可能比较慢，所以按钮先禁用并提示"审核中"
    if (auditBtn) {
        auditBtn.onclick = async () => {
            if (auditBtn.disabled) return;
            auditBtn.disabled = true;
            const old = auditBtn.textContent;
            auditBtn.textContent = '审核中…（本地大模型可能要十几秒）';
            try {
                const r = await YT.api.post('/api/video/check/reported/comments');
                // 后端 Result.success("审核完毕：…") 是单参重载 → 摘要放在 data，message 是"操作成功"
                const msg = (r && (r.data || r.message)) || '审核完成';
                if (r && r.success) YT.toast(msg);
                else YT.toast((r && (r.data || r.message)) || '审核失败');
            } catch (e) {
                YT.toast('审核请求失败：' + (e && e.message ? e.message : '网络错误'));
            } finally {
                auditBtn.disabled = false;
                auditBtn.textContent = old;
                load();   // 审核完重新拉一次，状态会变
            }
        };
    }

    load();
})();
