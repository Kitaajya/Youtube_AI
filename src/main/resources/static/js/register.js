const form = document.getElementById("registerForm");
const submitBtn = document.getElementById("submitBtn");
const tip = document.getElementById("tip");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    tip.textContent = "";
    tip.className = "tip";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const nickname = document.getElementById("nickname").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!username || !password || !nickname || !phone) {
        showTip("带 * 的项为必填", false);
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "注册中...";

    try {
        const fd = new FormData();
        fd.append("username", username);
        fd.append("password", password);
        fd.append("nickname", nickname);
        fd.append("email", email);
        fd.append("phone", phone);

        const res = await fetch("/api/user/create/user/account", {
            method: "POST",
            body: fd
        });
        const result = await res.json();
        // 外层 Result.success 恒为 true，业务结果在 result.data 里
        const inner = result.data || {};
        if (result.success && inner.success !== false) {
            showTip(inner.message || "注册成功！请前往登录", true);
            form.reset();
            setTimeout(() => { location.href = "login.html"; }, 1200);
        } else {
            showTip(inner.message || result.message || "注册失败", false);
        }
    } catch (err) {
        showTip("网络错误，请稍后重试", false);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "注册";
    }
});

function showTip(msg, ok) {
    tip.textContent = msg;
    tip.className = "tip " + (ok ? "ok" : "err");
}