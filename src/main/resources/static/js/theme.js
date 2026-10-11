/* ===== YouTube 仿站 深浅色主题切换 =====
 * 用法：
 *  - 各页面 <head> 内有一小段内联脚本，在样式加载前把 data-theme 写到 <html> 上（防闪烁）
 *  - 引入顺序：css/vars.css → 各页面样式 → css/dark.css；脚本 theme.js 在 common.js 之前
 *  - 带顶栏的页面由 common.js renderHeader 注入按钮；登录/注册页由本脚本注入 .yt-header
 */
const YT_THEME = (() => {
    const KEY = 'yt-theme';

    const ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    const ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

    function stored() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }
    // 当前生效主题（以内联脚本/用户选择后的 DOM 属性为准）
    function mode() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    function apply(m) {
        document.documentElement.setAttribute('data-theme', m);
    }

    function toggleHtml() {
        const dark = mode() === 'dark';
        return '<button class="theme-toggle" id="yt-theme-toggle" type="button" aria-pressed="' + dark + '"'
            + ' title="' + (dark ? '切换为浅色模式' : '切换为深色模式') + '" aria-label="切换深浅色模式">'
            + (dark ? ICON_SUN : ICON_MOON) + '</button>';
    }

    function bind() {
        const b = document.getElementById('yt-theme-toggle');
        if (b && !b.dataset.bound) {
            b.dataset.bound = '1';
            b.addEventListener('click', toggle);
        }
    }
    function refreshButton() {
        const b = document.getElementById('yt-theme-toggle');
        if (!b) return;
        b.outerHTML = toggleHtml();
        bind();
    }
    function toggle() {
        const next = mode() === 'dark' ? 'light' : 'dark';
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) { /* 隐私模式忽略 */ }
        refreshButton();
        document.dispatchEvent(new CustomEvent('yt-theme-change', { detail: { mode: next } }));
    }

    // 登录/注册等静态顶栏页面：把按钮挂到 .yt-header 右侧
    function ensureButton() {
        if (document.getElementById('yt-theme-toggle')) return;
        const bar = document.querySelector('.yt-header');
        if (!bar) return; // 公共顶栏页面由 common.js renderHeader 注入
        bar.insertAdjacentHTML('beforeend', toggleHtml());
    }
    function init() {
        ensureButton();
        bind();
    }

    // 当前应生效的主题：手动选择优先，否则跟随系统偏好
    function desired() {
        const s = stored();
        if (s === 'dark' || s === 'light') return s;
        if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    }
    function recompute() {
        apply(desired());
        refreshButton();
    }

    // 其他标签页改了主题 → 本页跟随
    window.addEventListener('storage', e => {
        if (e.key === KEY) recompute();
    });
    if (window.matchMedia) {
        const mq = matchMedia('(prefers-color-scheme: dark)');
        const onSys = () => { if (!stored()) recompute(); };
        if (mq.addEventListener) mq.addEventListener('change', onSys);
        else if (mq.addListener) mq.addListener(onSys);
    }

    document.addEventListener('DOMContentLoaded', init);

    return { init, bind, mode, toggle, toggleHtml, apply };
})();
