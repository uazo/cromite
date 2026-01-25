#!/bin/bash
# Configure GitHub Actions self-hosted runner for SFL Browser builds

set -e

echo "=== GitHub Actions Runner Configuration ==="
echo ""

# Check if runner exists
if [ ! -d "$HOME/actions-runner" ]; then
    echo "ERROR: actions-runner directory not found at $HOME/actions-runner"
    echo "Please run: mkdir -p ~/actions-runner && cd ~/actions-runner"
    echo "Then: curl -o actions-runner-linux-x64-2.312.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.312.0/actions-runner-linux-x64-2.312.0.tar.gz"
    echo "And: tar xzf actions-runner-linux-x64-2.312.0.tar.gz"
    exit 1
fi

cd $HOME/actions-runner

# Get runner token from GitHub
echo "To register the runner, you need:"
echo "1. Go to: https://github.com/YOUR-USERNAME/SFL-Browser-Chromium/settings/actions/runners"
echo "2. Click 'New self-hosted runner'"
echo "3. Follow the steps and copy the registration token"
echo ""
read -p "Enter your GitHub repository URL (e.g., https://github.com/username/repo): " REPO_URL
read -p "Enter the registration token: " TOKEN
read -p "Enter runner name (default: sfl-builder): " RUNNER_NAME
RUNNER_NAME=${RUNNER_NAME:-sfl-builder}

# Configure the runner
./config.sh --url "$REPO_URL" --token "$TOKEN" --name "$RUNNER_NAME" --unattended --replace

# Install as service
sudo ./svc.sh install

# Start the service
sudo ./svc.sh start

echo ""
echo "=== Configuration Complete ==="
echo "Runner is now configured and should appear in GitHub Actions settings."
echo "Service status:"
sudo ./svc.sh status
