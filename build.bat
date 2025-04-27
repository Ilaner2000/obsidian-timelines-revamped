@echo off
setlocal enabledelayedexpansion

echo [1/6] Cleaning dist folder...
if exist dist (
    rmdir /s /q dist || (echo Failed to delete dist folder & exit /b 1)
)
mkdir dist || (echo Failed to create dist folder & exit /b 1)

echo [2/6] Building with Rollup...
call npx rollup --config rollup.config.js --bundleConfigAsCjs || (echo Rollup build failed & exit /b 1)

echo [3/6] Compiling SCSS to CSS...
call npx sass styles\global.scss dist\styles.css --no-source-map || (echo Sass compilation failed & exit /b 1)

echo [4/6] Copying manifest.json to dist...
copy manifest.json dist\manifest.json >nul || (echo Failed to copy manifest.json & exit /b 1)

echo [5/6] Copying build results to project root...
copy dist\main.js . >nul || (echo Failed to copy main.js to root & exit /b 1)
copy dist\styles.css . >nul || (echo Failed to copy styles.css to root & exit /b 1)
copy dist\manifest.json . >nul || (echo Failed to copy manifest.json to root & exit /b 1)

echo [6/6] Build completed successfully!
pause
