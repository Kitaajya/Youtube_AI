const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const tip = document.getElementById("tip");
const captchaImg = document.getElementById("captchaImg");

function refreshCaptcha() {
    captchaImg.src = "/captcha?" + Math.random();
    document.getElementById("captcha").value = "";
}

// ===== 登录后回跳来源页（与 common.js 的 safeFrom 同规则，login.html 未引 common.js，故内联一份） =====
// 只接受站内相对路径：拒绝 //evil.com、/\evil.com、带 scheme（http/https/javascript/data…）的值
function safeFrom(v) {
    if (typeof v !== 'string' || !v) return '';
    if (v.startsWith('//') || v.startsWith('/\\')) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return '';
    if (!/^[^/\\]/.test(v)) return '';
    if (v.startsWith('login') || v.startsWith('register')) return '';
    return v;
}
function consumeReturnTarget() {
    let v = '';
    try {
        v = sessionStorage.getItem('yt_from') || '';
        sessionStorage.removeItem('yt_from');
    } catch (e) { /* 隐私模式忽略 */ }
    return safeFrom(v);
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    tip.textContent = "";
    tip.className = "tip";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const captcha = document.getElementById("captcha").value.trim();

    if (!username || !password) {
        showTip("请输入用户名和密码", false);
        return;
    }
    if (!captcha) {
        showTip("请输入验证码", false);
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "登录中...";

    try {
        // 验证码由后端登录接口强制校验
        const fd = new FormData();
        fd.append("username", username);
        fd.append("password", password);
        fd.append("captcha", captcha);

        const res = await fetch("/api/user/login", {
            method: "POST",
            body: fd
        });
        const result = await res.json();
        const data = result.data || {};
        // 外层 Result.success 恒为 true，业务结果在 result.data 里
        const ok = (result.success === true) && (data.success !== false);
        const msg = data.message || result.message || "登录失败";

        if (ok) {
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("nickname", data.nickname || "");
            showTip("登录成功，正在跳转...", true);
            setTimeout(() => { location.href = consumeReturnTarget() || "index.html"; }, 600);
        } else {
            showTip(msg, false);
            refreshCaptcha();
        }
    } catch (err) {
        showTip("网络错误，请稍后重试", false);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "登录";
    }
});

function showTip(msg, ok) {
    tip.textContent = msg;
    tip.className = "tip " + (ok ? "ok" : "err");
}