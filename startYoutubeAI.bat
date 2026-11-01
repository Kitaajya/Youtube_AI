@echo off
chcp 65001 >nul
title Youtube_AI 一键启动脚本
color 0A

:: 【关键修复】直接强制进入你的项目绝对路径
cd /d "E:\2026IDEAJava\Youtube"

echo ===================================================
echo            Youtube_AI 项目一键启动与环境检测
echo ===================================================
echo 当前工作路径: %cd%
echo.

:: 1. 检查 Java 环境
echo [1/5] 正在检查 Java 环境...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Java！请先安装 JDK 21 并配置环境变量。
    pause
    exit
)
echo √ Java 环境正常。
echo.

:: 2. 检查 Redis
echo [2/5] 正在检查 Redis 运行状态...
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo √ Redis 已经在后台运行。
) else (
    echo [!] 警告：Redis 似乎没有运行。
    echo     请确保你自己手动启动了 Redis（双击 redis-server.exe），否则项目启动会报错！
    timeout /t 4 >nul
)
echo.

:: 3. 检查 Ollama
echo [3/5] 正在检查 Ollama 运行状态...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo √ Ollama 已经在后台运行。
) else (
    echo [!] 未检测到 Ollama 进程。
    echo     请手动双击桌面或任务栏的 Ollama 图标启动它，否则 AI 功能无法使用。
    timeout /t 4 >nul
)
echo.

:: 4. 检查 MySQL
echo [4/5] 请确保本地 MySQL 服务已经启动！
timeout /t 2 >nul
echo.

:: 5. 打包并启动项目
echo [5/5] 正在打包并启动项目...
call mvnw.cmd clean package -DskipTests
if %errorlevel% neq 0 (
    echo [错误] 项目打包失败，请检查代码或网络。
    pause
    exit
)
echo.
echo ===================================================
echo 启动成功后，请访问: http://localhost:8080
echo ===================================================
java -jar target\Youtube-0.0.1-SNAPSHOT.jar

echo.
echo 程序已停止运行。
pause