@echo off
rem Authentication checks use isolated fixtures, never real account credentials.
rem Public signup cannot provision administrators.
pushd "%~dp0..\server"
call npm.cmd run test:auth
set "auth_test_exit=%ERRORLEVEL%"
popd
exit /b %auth_test_exit%
