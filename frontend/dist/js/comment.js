// commentItem.js
(function () {
    'use strict';

    // 格式化按钮显示与无障碍属性
    function renderButton(button, liked, count) {
        button.classList.toggle('liked', liked);
        button.classList.toggle('not-liked', !liked);
        button.disabled = false;
        button.setAttribute('aria-pressed', liked ? 'true' : 'false');
        button.textContent = (liked ? '已点赞 ' : '点赞 ') + count;
        button.setAttribute('aria-label', liked ? `取消点赞，当前 ${count} 个赞` : `点赞，当前 ${count} 个赞`);
    }

    // 拉取单条评论状态（若页面未渲染 liked/likes_count）
    async function fetchCommentState(commentId) {
        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: 'GET',
                credentials: 'same-origin', // 保持同源的 cookie/session
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error('fetch failed ' + res.status);
            const data = await res.json();
            // 期望返回 { id, text, likes_count, liked_by_user }
            return {
                likesCount: typeof data.likes_count === 'number' ? data.likes_count : (data.likesCount ?? 0),
                liked: !!data.liked_by_user
            };
        } catch (err) {
            console.warn('无法拉取评论初始状态', err);
            return { likesCount: 0, liked: false };
        }
    }

    // 初始化所有评论项
    function initComments() {
        const items = document.querySelectorAll('.js-comment-item[data-comment-id]');
        if (!items || !items.length) return;

        items.forEach(item => {
            const commentId = item.dataset.commentId;
            if (!commentId) return;

            const btn = item.querySelector('.js-like-btn');
            if (!btn) return;

            // 读取 data-attrs（优先使用服务端渲染的初始值）
            let likesCount = (typeof item.dataset.likesCount !== 'undefined') ? parseInt(item.dataset.likesCount, 10) || 0 : null;
            let liked = (typeof item.dataset.liked !== 'undefined') ? (item.dataset.liked === 'true') : null;

            // 如果没有初始数据，先禁用按钮并异步获取
            if (likesCount === null || liked === null) {
                btn.disabled = true;
                // fetch initial state
                fetchCommentState(commentId).then(state => {
                    likesCount = state.likesCount;
                    liked = state.liked;
                    // 保存到 DOM dataset，渲染
                    item.dataset.likesCount = likesCount;
                    item.dataset.liked = liked;
                    renderButton(btn, liked, likesCount);
                });
            } else {
                renderButton(btn, liked, likesCount);
            }

            // 点击处理（乐观更新）
            btn.addEventListener('click', async function (e) {
                e.preventDefault();
                if (btn.disabled) return;

                // 确保我们有值（如果 still null，先禁止并返回）
                if (likesCount === null || liked === null) return;

                // 防重复点击
                btn.disabled = true;

                const prevLiked = liked;
                const prevCount = likesCount;

                // 乐观切换
                liked = !liked;
                likesCount = Math.max(0, likesCount + (liked ? 1 : -1));
                renderButton(btn, liked, likesCount);

                try {
                    const method = liked ? 'POST' : 'DELETE';
                    const res = await fetch(`/api/comments/${commentId}/likes`, {
                        method: method,
                        credentials: 'same-origin',
                        headers: { 'Accept': 'application/json' }
                    });

                    if (!res.ok) throw new Error('请求失败 ' + res.status);

                    // 若后端返回 JSON（推荐返回最新状态），则以后端为准
                    let data = null;
                    try { data = await res.json(); } catch (err) { /* ignore if no json */ }

                    if (data) {
                        if (typeof data.likes_count === 'number') likesCount = data.likes_count;
                        if (typeof data.liked_by_user === 'boolean') liked = data.liked_by_user;
                        // 更新 DOM dataset
                        item.dataset.likesCount = likesCount;
                        item.dataset.liked = liked;
                        renderButton(btn, liked, likesCount);
                    } else {
                        // 如果没有返回数据，则保持乐观更新（已设置）
                        item.dataset.likesCount = likesCount;
                        item.dataset.liked = liked;
                    }
                } catch (err) {
                    console.error('点赞/取消点赞失败', err);
                    // 回滚到先前状态
                    liked = prevLiked;
                    likesCount = prevCount;
                    item.dataset.likesCount = likesCount;
                    item.dataset.liked = liked;
                    renderButton(btn, liked, likesCount);
                    alert('操作失败，请稍后重试');
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }







    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initComments);
    } else {
        initComments();
    }
})();