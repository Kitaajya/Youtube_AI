@echo off
chcp 65001 >nul
title Youtube_AI 一键启动脚本（前后端分离版）
color 0A

:: 【前后端分离版】backend 跑 Spring Boot(:8080)，frontend 跑 Vite(:5173)
:: 原 startYoutubeAI.bat 仍保留，但其内部路径已失效（工程已拆分为 backend/ 与 frontend/），
:: 请改用本脚本。
set "ROOT_DIR=E:\2026IDEAJava\Youtube"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"
cd /d "%ROOT_DIR%"

echo ===================================================
echo        Youtube_AI 项目一键启动与环境检测
echo        （前后端分离版：backend + frontend）
echo ===================================================
echo 当前工作路径: %cd%
echo.

:: 1. 检查 Java 环境
echo [1/7] 正在检查 Java 环境...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Java！请先安装 JDK 21 并配置环境变量。
    pause
    exit
)
echo √ Java 环境正常。
echo.

:: 2. 检查 Node 环境（前端 Vite 需要）
echo [2/7] 正在检查 Node 环境...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js！前端开发服务器需要 Node 18+，请先安装。
    pause
    exit
)
echo √ Node 环境正常。
echo.

:: 3. 检查 Redis
echo [3/7] 正在检查 Redis 运行状态...
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo √ Redis 已经在后台运行。
) else (
    echo [!] 警告：Redis 似乎没有运行。
    echo     请确保你自己手动启动了 Redis（双击 redis-server.exe），否则项目启动会报错！
    timeout /t 4 >nul
)
echo.

:: 4. 检查 Ollama
echo [4/7] 正在检查 Ollama 运行状态...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo √ Ollama 已经在后台运行。
) else (
    echo [!] 未检测到 Ollama 进程。
    echo     请手动双击桌面或任务栏的 Ollama 图标启动它，否则 AI 功能无法使用。
    timeout /t 4 >nul
)
echo.

:: 5. 检查 MySQL
echo [5/7] 请确保本地 MySQL 服务已经启动！
timeout /t 2 >nul
echo.

:: 6. 安装前端依赖（仅首次或依赖缺失时）
echo [6/7] 正在检查前端依赖...
if not exist "%FRONTEND_DIR%\node_modules" (
    echo     首次运行，正在安装前端依赖，请稍候...
    pushd "%FRONTEND_DIR%"
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败，请检查网络。
        popd
        pause
        exit
    )
    popd
)
echo √ 前端依赖就绪。
echo.

:: 7. 打包后端，并同时拉起前后端
echo [7/7] 正在打包后端项目...
pushd "%BACKEND_DIR%"
call mvnw.cmd clean package -DskipTests
if %errorlevel% neq 0 (
    echo [错误] 后端打包失败，请检查代码或网络。
    popd
    pause
    exit
)
popd
echo.

:: 新开一个窗口跑前端 Vite 开发服务器（/D 指定工作目录，窗口内直接 npm run dev）
start "Youtube_AI 前端 (Vite :5173)" /D "%FRONTEND_DIR%" cmd /k "npm run dev"

echo ===================================================
echo  后端 API  : http://localhost:8080
echo  前端页面  : http://localhost:5173   ← 请从这里访问
echo ===================================================
echo  说明：前端通过 Vite 代理把 /api、/captcha、/checkCaptcha、/videos
echo        转发到后端 8080，浏览器视角同源，无需配置跨域。
echo  关闭本窗口会停止后端，前端窗口需单独关闭。
echo ===================================================
echo.

pushd "%BACKEND_DIR%"
java -jar target\Youtube-0.0.1-SNAPSHOT.jar
popd

echo.
echo 后端程序已停止运行。
pause
