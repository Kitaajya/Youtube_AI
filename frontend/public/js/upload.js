/* 上传页 */
(async function () {
    const me = YT.user();
    if (!me) {
        try { sessionStorage.setItem('yt_from', 'upload.html'); } catch (e) { /* 忽略 */ }
        YT.toast('登录后即可上传视频');
        setTimeout(() => { location.href = 'login.html'; }, 600);
        return;
    }

    const $ = s => document.querySelector(s);
    const tip = $('#tip'), submit = $('#submit'), fileIn = $('#file');
    const drop = $('#drop-zone'), prog = $('#prog'), fill = $('#prog-fill'), ptxt = $('#prog-txt');

    // 获取 @ 功能的元素
    const shieldInput = $('#shield-ids');
    const dropdown = $('#user-dropdown');

    // ================= 1. 绑定 @ 搜索功能 =================
    if (shieldInput && dropdown) {
        let searchTimer = null;

        shieldInput.addEventListener('input', function() {
            const val = this.value;
            const match = val.match(/@([^\s,，]*)$/);
            if (match) {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => fetchUsers(match[1].trim()), 300);
            } else {
                dropdown.style.display = 'none';
            }
        });

        async function fetchUsers(keyword) {
            try {
                const res = await YT.api.get('/api/user/search', { keyword });
                const list = res.data || [];

                if (list.length === 0) {
                    dropdown.innerHTML = '<div style="padding:10px; color:var(--text-secondary); text-align:center;">未找到用户</div>';
                } else {
                    dropdown.innerHTML = list.map(u => {
                        const uid = YT.pick(u, 'userId') || YT.pick(u, 'user_id');
                        const nick = YT.pick(u, 'nickname') || YT.pick(u, 'username') || uid;
                        const av = String(YT.pick(u, 'avatar') || '');
                        const initial = YT.esc(nick.slice(0,1).toUpperCase());
                        const avInner = av
                            ? `<span class="av-fb">${initial}</span><img src="${YT.esc(YT.mediaUrl(av))}" alt="" loading="lazy">`
                            : initial;
                        return `
                        <div class="user-item" data-id="${uid}" data-name="${YT.esc(nick)}" 
                             style="padding:10px 14px; cursor:pointer; display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--divider);">
                            <span class="avatar" style="width:24px; height:24px; font-size:12px;">
                                ${avInner}
                            </span>
                            <div>
                                <div style="font-size:14px; color:var(--text-primary);">${YT.esc(nick)}</div>
                                <div style="font-size:12px; color:var(--text-tertiary);">ID: ${YT.esc(uid)}</div>
                            </div>
                        </div>`;
                    }).join('');
                }
                dropdown.style.display = 'block';
            } catch (e) {
                console.error("搜索用户失败", e);
            }
        }

        // 用 mousedown 防止下拉框提前消失，并把选中的用户ID填入输入框
        dropdown.addEventListener('mousedown', function(e) {
            const item = e.target.closest('.user-item');
            if (!item) return;
            e.preventDefault();

            const uid = item.dataset.id;
            // 关键：把 "@xxx" 替换成 "对方的ID, "
            shieldInput.value = shieldInput.value.replace(/@([^\s,，]*)$/, uid + ', ');
            dropdown.style.display = 'none';
            shieldInput.focus();
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== shieldInput) {
                dropdown.style.display = 'none';
            }
        });
    }

    // ================= 2. 上传表单逻辑 =================
    const OK = /\.(mp4|webm|mov|m4v|ogv|ogg)$/i;

    function show(msg, ok) { tip.textContent = msg; tip.className = 'tip ' + (ok ? 'ok' : 'err'); }

    function reflect() {
        const f = fileIn.files[0];
        drop.classList.toggle('has', !!f);
        $('#file-hint').innerHTML = f
            ? `已选择：<b>${YT.esc(f.name)}</b>（${(f.size / 1048576).toFixed(1)} MB）`
            : '支持 mp4 / webm / mov 等浏览器可播放格式，最大 1GB';
    }
    fileIn.addEventListener('change', reflect);

    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => {
        e.preventDefault(); drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
        e.preventDefault(); drop.classList.remove('over');
    }));
    drop.addEventListener('drop', e => {
        const f = e.dataTransfer.files[0];
        if (!f) return;
        fileIn.files = e.dataTransfer.files;
        reflect();
        if (!$('#title').value.trim()) {
            $('#title').value = f.name.replace(/\.[^.]+$/, '');
        }
    });

    function remember(id, title, videoPath) {
        try {
            const mine = JSON.parse(localStorage.getItem('yt_my_videos') || '[]');
            mine.unshift({ id, title, video_path: videoPath, create_time: new Date().toISOString() });
            localStorage.setItem('yt_my_videos', JSON.stringify(mine.slice(0, 50)));
        } catch (e) { /* 缓存失败不影响主流程 */ }
    }

    function probeByBrowser(f, timeoutMs) {
        return new Promise(resolve => {
            const v = document.createElement('video');
            const url = URL.createObjectURL(f);
            let done = false;
            const finish = (dur, vert) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                v.removeAttribute('src'); v.load();
                URL.revokeObjectURL(url);
                resolve({ durationSec: dur, isVertical: vert });
            };
            const timer = setTimeout(() => finish(-1, -1), timeoutMs || 15000);
            v.preload = 'metadata';
            v.muted = true;
            v.onloadedmetadata = () => {
                const dur = Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration) : -1;
                const vert = (v.videoWidth && v.videoHeight && v.videoHeight > v.videoWidth) ? 1 : 0;
                finish(dur, dur < 0 ? -1 : vert);
            };
            v.onerror = () => finish(-1, -1);
            v.src = url;
        });
    }

    // ================= 3. 点击上传并处理屏蔽 =================
    submit.onclick = async () => {
        tip.textContent = ''; tip.className = 'tip';
        const title = $('#title').value.trim();
        const f = fileIn.files[0];
        if (!f) return show('请先选择视频文件', false);
        if (!title) return show('请填写视频标题', false);
        if (!OK.test(f.name)) return show('该格式浏览器无法在线播放，请改传 mp4 或 webm', false);

        submit.disabled = true; submit.textContent = '读取视频信息…';
        const probe = await probeByBrowser(f);
        submit.textContent = '上传中…';

        const fd = new FormData();

        const isVipOnly = document.getElementById('is-vip-only').checked ? 1 : 0;

        fd.append('isVipOnly', isVipOnly);
        fd.append('userId', me.userId);
        fd.append('title', title);
        fd.append('file', f, f.name);
        fd.append('clientDurationSec', probe.durationSec);
        fd.append('clientVertical', probe.isVertical);

        prog.style.display = 'block'; fill.style.width = '0%';
        ptxt.textContent = `上传中… 0%（共 ${(f.size / 1048576).toFixed(1)} MB）`;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/video/upload/file');

        xhr.upload.onprogress = e => {
            if (!e.lengthComputable) return;
            const pct = Math.round(e.loaded / e.total * 100);
            fill.style.width = pct + '%';
            ptxt.textContent = pct < 100
                ? `上传中… ${pct}%（${(e.loaded / 1048576).toFixed(1)} / ${(e.total / 1048576).toFixed(1)} MB）`
                : '上传完成，服务器处理中…';
        };

        // 🚨 核心修复：onload 变成了 async，并且用 await 等待后端保存完毕
        xhr.onload = async () => {
            let r = {};
            try { r = JSON.parse(xhr.responseText); } catch (e) { /* 非 JSON 响应 */ }
            const data = r.data || {};

            if (r.success && data.videoId) {
                // ====== 处理屏蔽名单（只对刚发布的这个视频生效） ======
                if (shieldInput && shieldInput.value.trim()) {
                    // 如果输入框里有内容，按逗号或空格拆分成数组
                    const ids = shieldInput.value.split(/[,\s]+/).map(id => id.trim()).filter(id => id);

                    if (ids.length > 0) {
                        ptxt.textContent = '视频已发布，正在应用屏蔽设置…';
                        try {
                            // 必须带上 videoId：屏蔽只作用于这条视频，不会再把这些人挡在你的所有视频外
                            // 注意这里加了 await，确保网络请求发完并拿到结果，再去执行 setTimeout 跳转
                            const res = await YT.api.post('/api/video/obscure/users', {
                                upId: me.userId,
                                videoId: data.videoId,
                                userIds: ids
                            });
                            if (!res.success) {
                                YT.toast('部分用户屏蔽失败：' + (res.message || '未知错误'));
                            } else {
                                YT.toast(`已限制 ${ids.length} 位用户观看该视频`);
                            }
                        } catch (err) {
                            console.error('屏蔽请求失败', err);
                            YT.toast('屏蔽设置网络异常');
                        }
                    }
                }
                // ==========================

                fill.style.width = '100%';
                ptxt.textContent = '发布成功，正在跳转…';
                show('发布成功！', true);
                remember(data.videoId, title, data.filePath);
                setTimeout(() => location.href = 'watch.html?id=' + data.videoId, 900);
                return;
            }

            show(data.message || r.message || ('上传失败（HTTP ' + xhr.status + '）'), false);
            reset();
        };

        xhr.onerror = () => {
            show('网络错误，上传中断。大文件上传失败也可能是超过了服务器的大小上限', false);
            reset();
        };
        xhr.onabort = () => { reset(); };
        xhr.send(fd);

        function reset() {
            submit.disabled = false; submit.textContent = '上传并发布';
            setTimeout(() => prog.style.display = 'none', 1500);
        }
    };

    // ================= 4. 兼容旧的上传路径功能（如果 HTML 里没有就跳过）=================
    const oldSubmit = $('#old-submit');
    if (oldSubmit) {
        oldSubmit.onclick = async () => {
            const title = $('#title').value.trim();
            const videoPath = $('#old-path').value.trim();
            if (!title || !videoPath) return show('标题和路径都要填', false);
            const r = await YT.api.post('/api/video/upload', { userId: me.userId, title, videoPath });
            const data = r.data || {};
            if (r.success && data.videoId) {
                show('登记成功，视频 ID：' + data.videoId, true);
                remember(data.videoId, title, videoPath);
                setTimeout(() => location.href = 'watch.html?id=' + data.videoId, 900);
            } else {
                show(data.message || r.message || '登记失败', false);
            }
        };
    }
})();