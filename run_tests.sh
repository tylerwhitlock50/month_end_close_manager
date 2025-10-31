#!/bin/bash

# =============================================================================
# Test Runner Script for Month-End Close API
# =============================================================================
# This script provides convenient commands for running tests both locally
# and in Docker containers.
#
# Usage:
#   ./run_tests.sh [options]
#
# Options:
#   --docker        Run tests in Docker container
#   --coverage      Generate coverage report
#   --verbose       Run with verbose output
#   --file FILE     Run specific test file
#   --help          Show this help message
# =============================================================================

set -e  # Exit on error

# Default options
DOCKER=false
COVERAGE=false
VERBOSE=false
SPECIFIC_FILE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --docker)
      DOCKER=true
      shift
      ;;
    --coverage)
      COVERAGE=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --file)
      SPECIFIC_FILE="$2"
      shift 2
      ;;
    --help)
      echo "Usage: ./run_tests.sh [options]"
      echo ""
      echo "Options:"
      echo "  --docker        Run tests in Docker container"
      echo "  --coverage      Generate coverage report"
      echo "  --verbose       Run with verbose output"
      echo "  --file FILE     Run specific test file (e.g., backend/tests/test_auth.py)"
      echo "  --help          Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./run_tests.sh"
      echo "  ./run_tests.sh --docker"
      echo "  ./run_tests.sh --docker --coverage"
      echo "  ./run_tests.sh --docker --file backend/tests/test_auth.py"
      echo "  ./run_tests.sh --docker --verbose --coverage"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Build pytest command
build_pytest_command() {
  local cmd="pytest"
  
  if [ "$VERBOSE" = true ]; then
    cmd="$cmd -v"
  fi
  
  if [ "$COVERAGE" = true ]; then
    cmd="$cmd --cov=backend --cov-report=term-missing --cov-report=html"
  fi
  
  if [ -n "$SPECIFIC_FILE" ]; then
    cmd="$cmd $SPECIFIC_FILE"
  fi
  
  echo "$cmd"
}

# Print header
print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  Month-End Close API Test Runner${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

# Check if Docker is running (for Docker mode)
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
  fi
}

# Check if backend container is running
check_container() {
  if ! docker-compose ps | grep -q "monthend_backend.*Up"; then
    echo -e "${YELLOW}Warning: Backend container is not running${NC}"
    echo -e "${YELLOW}Starting containers...${NC}"
    docker-compose up -d
    echo -e "${GREEN}Containers started${NC}"
    echo ""
    # Wait for services to be ready
    echo "Waiting for services to be ready..."
    sleep 5
  fi
}

# Run tests locally
run_local_tests() {
  echo -e "${BLUE}Running tests locally...${NC}"
  echo ""
  
  # Check if virtual environment is activated
  if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}Warning: Virtual environment not activated${NC}"
    echo "Attempting to activate venv..."
    
    if [ -f "venv/Scripts/activate" ]; then
      # Windows (Git Bash)
      source venv/Scripts/activate
    elif [ -f "venv/bin/activate" ]; then
      # Unix/Mac
      source venv/bin/activate
    else
      echo -e "${RED}Error: Could not find virtual environment${NC}"
      echo "Please activate your virtual environment or use --docker flag"
      exit 1
    fi
  fi
  
  # Run pytest
  pytest_cmd=$(build_pytest_command)
  echo -e "${GREEN}Executing: $pytest_cmd${NC}"
  echo ""
  eval $pytest_cmd
}

# Run tests in Docker
run_docker_tests() {
  echo -e "${BLUE}Running tests in Docker container...${NC}"
  echo ""
  
  check_docker
  check_container
  
  # Build pytest command
  pytest_cmd=$(build_pytest_command)
  
  echo -e "${GREEN}Executing: docker-compose exec backend $pytest_cmd${NC}"
  echo ""
  
  # Run pytest in container
  docker-compose exec backend $pytest_cmd
}

# Print summary
print_summary() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  Test Run Complete${NC}"
  echo -e "${BLUE}========================================${NC}"
  
  if [ "$COVERAGE" = true ]; then
    echo ""
    echo -e "${GREEN}Coverage report generated:${NC}"
    if [ "$DOCKER" = true ]; then
      echo "  - Terminal output above"
      echo "  - HTML report: Check container at backend/tests/coverage_html/index.html"
    else
      echo "  - Terminal output above"
      echo "  - HTML report: backend/tests/coverage_html/index.html"
      
      # Try to open coverage report if on Mac
      if [[ "$OSTYPE" == "darwin"* ]]; then
        echo ""
        read -p "Open coverage report in browser? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
          open backend/tests/coverage_html/index.html
        fi
      fi
    fi
  fi
  
  echo ""
}

# Main execution
main() {
  print_header
  
  if [ "$DOCKER" = true ]; then
    run_docker_tests
  else
    run_local_tests
  fi
  
  print_summary
}

# Run main function
main

