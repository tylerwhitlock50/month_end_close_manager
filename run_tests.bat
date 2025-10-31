@echo off
REM =============================================================================
REM Test Runner Script for Month-End Close API (Windows)
REM =============================================================================
REM This script provides convenient commands for running tests in Docker
REM on Windows systems.
REM
REM Usage:
REM   run_tests.bat [options]
REM
REM Options:
REM   --coverage      Generate coverage report
REM   --verbose       Run with verbose output
REM   --file FILE     Run specific test file
REM =============================================================================

setlocal enabledelayedexpansion

REM Default options
set COVERAGE=false
set VERBOSE=false
set SPECIFIC_FILE=

REM Parse command line arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--coverage" (
    set COVERAGE=true
    shift
    goto parse_args
)
if "%~1"=="--verbose" (
    set VERBOSE=true
    shift
    goto parse_args
)
if "%~1"=="--file" (
    set SPECIFIC_FILE=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--help" (
    echo Usage: run_tests.bat [options]
    echo.
    echo Options:
    echo   --coverage      Generate coverage report
    echo   --verbose       Run with verbose output
    echo   --file FILE     Run specific test file
    echo   --help          Show this help message
    echo.
    echo Examples:
    echo   run_tests.bat
    echo   run_tests.bat --coverage
    echo   run_tests.bat --file backend/tests/test_auth.py
    echo   run_tests.bat --verbose --coverage
    exit /b 0
)
echo Unknown option: %~1
echo Use --help for usage information
exit /b 1

:end_parse

REM Build pytest command
set PYTEST_CMD=pytest

if "%VERBOSE%"=="true" (
    set PYTEST_CMD=!PYTEST_CMD! -v
)

if "%COVERAGE%"=="true" (
    set PYTEST_CMD=!PYTEST_CMD! --cov=backend --cov-report=term-missing --cov-report=html
)

if not "%SPECIFIC_FILE%"=="" (
    set PYTEST_CMD=!PYTEST_CMD! %SPECIFIC_FILE%
)

REM Print header
echo ========================================
echo   Month-End Close API Test Runner
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running
    echo Please start Docker Desktop and try again
    exit /b 1
)

echo Running tests in Docker container...
echo.

REM Check if container is running
docker-compose ps | findstr /C:"monthend_backend" | findstr /C:"Up" >nul
if errorlevel 1 (
    echo Warning: Backend container is not running
    echo Starting containers...
    docker-compose up -d
    echo Containers started
    echo.
    echo Waiting for services to be ready...
    timeout /t 5 /nobreak >nul
)

REM Run tests
echo Executing: docker-compose exec backend %PYTEST_CMD%
echo.
docker-compose exec backend %PYTEST_CMD%

REM Print summary
echo.
echo ========================================
echo   Test Run Complete
echo ========================================

if "%COVERAGE%"=="true" (
    echo.
    echo Coverage report generated in container
    echo To view, copy from container or use Docker volumes
)

echo.
pause

