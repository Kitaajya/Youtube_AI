/* 上传页
 * POST /api/video/upload/file   multipart：userId, title, file   —— 文件真正落盘（首选）
 * POST /api/video/upload        urlencoded：userId, title, videoPath —— 仅登记路径（备用）
 */
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

    submit.onclick = () => {
        tip.textContent = ''; tip.className = 'tip';
        const title = $('#title').value.trim();
        const f = fileIn.files[0];
        if (!f) return show('请先选择视频文件', false);
        if (!title) return show('请填写视频标题', false);
        if (!OK.test(f.name)) return show('该格式浏览器无法在线播放，请改传 mp4 或 webm', false);

        const fd = new FormData();
        fd.append('userId', me.userId);
        fd.append('title', title);
        fd.append('file', f, f.name);

        submit.disabled = true; submit.textContent = '上传中…';
        prog.style.display = 'block'; fill.style.width = '0%';
        ptxt.textContent = `上传中… 0%（共 ${(f.size / 1048576).toFixed(1)} MB）`;

        // 用 XHR 而不是 fetch：只有它能拿到上传进度事件
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
        xhr.onload = () => {
            let r = {};
            try { r = JSON.parse(xhr.responseText); } catch (e) { /* 非 JSON 响应 */ }
            const data = r.data || {};
            if (r.success && data.videoId) {
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

    // 备用：只登记路径，不传文件本体
    $('#old-submit').onclick = async () => {
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
})();
