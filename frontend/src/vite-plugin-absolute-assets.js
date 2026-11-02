/* ===== Vite 构建期插件：把 HTML 里的相对资源引用改写为绝对路径 =====
 *
 * 背景：本项目的前端是从 Spring Boot 的 static 目录原样迁移过来的，
 * 10 个 HTML 页面里对 css / js / 图片的引用都是「相对路径」，例如：
 *     <link rel="stylesheet" href="css/vars.css">
 *     <script src="js/common.js?v=14"></script>
 *
 * 这些资源统一放在 public/ 下，public 的内容在运行时被挂在站点根路径，
 * 所以从根目录的页面看，"css/vars.css" 和 "/css/vars.css" 指向同一个文件，
 * 浏览器里两种写法都能正常加载。
 *
 * 但 Vite 在构建时会把 HTML 中的相对引用当作「源码模块」去解析并打包。
 * 这会带来两个致命问题：
 *   1. public/ 下的文件不在源码解析范围内，构建直接报 Failed to resolve；
 *   2. 即便解析成功，js/common.js 这类全局 IIFE 脚本一旦被当作 ES Module 打包，
 *      顶层的 const YT = (() => {...})() 会变成模块作用域变量，不再挂到 window 上，
 *      其它页面脚本里的 YT.xxx 会全部报 YT is not defined。
 *
 * 解决办法：在 Vite 处理 HTML 之前（order: 'pre'），把这些相对引用改写成以 "/"
 * 开头的绝对路径。Vite 见到绝对路径就认定是 public 静态资源，原样保留、原样拷贝，
 * 既不会打包也不会改名，运行时行为与迁移前完全一致。
 *
 * 只改写 href / src 属性，且只处理 css/ 与 js/ 开头的相对路径；
 * 已经以 "/"、"http"、"//" 开头的引用一律不动，页面内联脚本也不受影响。
 */

// 需要改写为绝对路径的相对前缀
const REWRITE_PREFIXES = ['css/', 'js/'];

/** 把 href="css/x.css" / src="js/x.js?v=1" 改写成以 / 开头 */
function rewriteAttributes(html) {
    return html.replace(
        /\b(href|src)\s*=\s*(["'])([^"']+)\2/gi,
        (match, attr, quote, value) => {
            // 绝对路径、协议地址、协议相对地址、锚点、data URI 都不处理
            if (/^(\/|https?:|\/\/|#|data:|mailto:)/i.test(value)) return match;
            if (!REWRITE_PREFIXES.some((p) => value.startsWith(p))) return match;
            return `${attr}=${quote}/${value}${quote}`;
        }
    );
}

/**
 * @returns {import('vite').Plugin}
 */
export function absolutePublicAssets() {
    return {
        name: 'youtube-ai:absolute-public-assets',
        // 必须在 vite:build-html / vite:dev-html 之前执行
        enforce: 'pre',
        transformIndexHtml: {
            order: 'pre',
            handler(html) {
                return rewriteAttributes(html);
            },
        },
    };
}
